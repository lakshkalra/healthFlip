import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { toByteArray, fromByteArray } from 'base64-js';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import {
  configureAudioSession,
  deactivateAudioSession,
  initializePlayer,
  onAudioChunk,
  onVoiceActivity,
  playChunk,
  releasePlayer,
  requestMicrophonePermission,
  startRecording,
  stopPlayback,
  stopRecording,
} from '@mindinventory/react-native-nitro-realtime-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createLiveSession, createMeal, estimateMeal, type AiMealEstimate } from './api/client';
import { dateKey, type MealType } from './meals';
import { Icon, PillButton, RoundIconButton, colors } from './ui';
import { buildAudioMessage, buildSetupMessage, looksLikeMeal, outputSampleRate, parseServerMessage } from './voiceProtocol';

type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
type Transcript = { id: string; role: 'kimbo' | 'user'; text: string };
type Turn = { kimbo: string; kimboId: string | null; user: string; userId: string | null };

type VoiceScreenProps = {
  mealType: MealType;
  onClose: () => void;
  onMealLogged: () => void;
};

const greeting: Transcript = { id: 'welcome', role: 'kimbo', text: 'Hi, I’m Kimbo. Start a conversation whenever you’re ready.' };
const emptyTurn = (): Turn => ({ kimbo: '', kimboId: null, user: '', userId: null });

export function VoiceConversationScreen({ mealType, onClose, onMealLogged }: VoiceScreenProps) {
  const insets = useSafeAreaInsets();
  const socketRef = useRef<WebSocket | null>(null);
  // Bumped on every start/stop so stale async work and socket callbacks can detect they were superseded.
  const attemptRef = useRef(0);
  // True only after Gemini sent setupComplete and the native recorder/player are running.
  const liveRef = useRef(false);
  const goAwayRef = useRef(false);
  const stateRef = useRef<VoiceState>('idle');
  const turnRef = useRef<Turn>(emptyTurn());
  const messageCount = useRef(0);
  const transcriptListRef = useRef<FlashListRef<Transcript> | null>(null);
  const level = useSharedValue(0);
  const [state, setState] = useState<VoiceState>('idle');
  const [message, setMessage] = useState('Tap Start conversation to let Kimbo listen.');
  const [transcripts, setTranscripts] = useState<Transcript[]>([greeting]);
  const [pendingEstimate, setPendingEstimate] = useState<AiMealEstimate | null>(null);
  const [logging, setLogging] = useState(false);

  // Audio chunks arrive many times per second; only re-render when the state actually changes.
  const updateState = useCallback((next: VoiceState) => {
    if (stateRef.current === next) return;
    stateRef.current = next;
    setState(next);
  }, []);

  // Pass null to append a new bubble; returns the bubble id so live fragments can keep updating it.
  const upsertTranscript = useCallback((id: string | null, role: Transcript['role'], text: string): string => {
    messageCount.current += id ? 0 : 1;
    const bubbleId = id ?? `live-${messageCount.current}`;
    setTranscripts(current => {
      const index = current.findIndex(item => item.id === bubbleId);
      if (index === -1) return [...current, { id: bubbleId, role, text }];
      const next = current.slice();
      next[index] = { ...next[index], text };
      return next;
    });
    return bubbleId;
  }, []);

  const stopSession = useCallback((nextMessage = 'Conversation ended. Your audio was not saved.', nextState: VoiceState = 'idle') => {
    attemptRef.current += 1;
    liveRef.current = false;
    goAwayRef.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    try { stopRecording(); } catch { /* The recorder may not have started. */ }
    try { stopPlayback(); } catch { /* The player may not have started. */ }
    try { releasePlayer(); deactivateAudioSession(); } catch { /* Best-effort native cleanup. */ }
    turnRef.current = emptyTurn();
    level.value = 0;
    updateState(nextState);
    setMessage(nextMessage);
  }, [level, updateState]);

  const createMealEstimate = useCallback(async (description: string) => {
    if (!looksLikeMeal(description)) return;
    try {
      const estimate = await estimateMeal(description, mealType);
      setPendingEstimate(estimate);
      upsertTranscript(null, 'kimbo', 'I prepared a meal review card. Please check it and confirm before I add anything to your day.');
    } catch {
      upsertTranscript(null, 'kimbo', 'I heard that meal, but I could not prepare its review card. Please try describing it again.');
    }
  }, [mealType, upsertTranscript]);

  const logEstimate = useCallback(async () => {
    if (!pendingEstimate || logging) return;
    setLogging(true);
    try {
      await createMeal({
        caloriesKcal: pendingEstimate.caloriesKcal,
        carbsGrams: pendingEstimate.carbsGrams ?? undefined,
        fatGrams: pendingEstimate.fatGrams ?? undefined,
        mealType,
        name: pendingEstimate.name,
        note: 'Estimated during a Kimbo voice conversation. Review the portion if needed.',
        proteinGrams: pendingEstimate.proteinGrams ?? undefined,
        source: 'voice',
      });
      setPendingEstimate(null);
      upsertTranscript(null, 'kimbo', 'Done—your meal is now in today’s log.');
      onMealLogged();
    } catch {
      upsertTranscript(null, 'kimbo', 'I could not save that meal. The review card is still available to try again.');
    } finally {
      setLogging(false);
    }
  }, [logging, mealType, onMealLogged, pendingEstimate, upsertTranscript]);

  // Gemini requires setupComplete before any realtime input, so native audio starts only here.
  const startNativeAudio = useCallback(() => {
    configureAudioSession({ mode: 'duplex', speaker: true });
    initializePlayer({ bufferSize: 4096, channels: 1, sampleRate: outputSampleRate });
    startRecording({
      channels: 1,
      chunkDurationMs: 100,
      processing: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
      sampleRate: 16000,
      vad: { enabled: true, minSilenceDurationMs: 550, minSpeechDurationMs: 150, threshold: 0.025 },
    });
    liveRef.current = true;
    updateState('listening');
    setMessage('Kimbo is listening. Speak naturally—English or Hinglish both work.');
  }, [updateState]);

  const handleServerMessage = useCallback((data: unknown) => {
    const payload = parseServerMessage(data);
    if (!payload) return;

    if (payload.setupComplete) {
      if (liveRef.current) return;
      try {
        startNativeAudio();
      } catch {
        stopSession('Kimbo could not start your microphone. Please try again.', 'error');
      }
      return;
    }
    if (payload.goAway) {
      goAwayRef.current = true;
      setMessage('This conversation is reaching its time limit. Kimbo will wrap up shortly.');
    }

    const content = payload.serverContent;
    if (!content || !liveRef.current) return;
    const turn = turnRef.current;

    if (content.interrupted) {
      try { stopPlayback(); } catch { /* Native player may already be idle. */ }
      turn.kimbo = '';
      turn.kimboId = null;
      updateState('listening');
    }
    // Transcriptions arrive as fragments; accumulate them per turn.
    if (content.inputTranscription?.text) {
      turn.user += content.inputTranscription.text;
      if (turn.user.trim()) turn.userId = upsertTranscript(turn.userId, 'user', turn.user.trim());
    }
    if (content.outputTranscription?.text) {
      turn.kimbo += content.outputTranscription.text;
      if (turn.kimbo.trim()) turn.kimboId = upsertTranscript(turn.kimboId, 'kimbo', turn.kimbo.trim());
      updateState('speaking');
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if (!part.inlineData?.data) continue;
      playChunk(toByteArray(part.inlineData.data).buffer as ArrayBuffer);
      updateState('speaking');
    }
    if (content.turnComplete) {
      const userText = turn.user.trim();
      turnRef.current = emptyTurn();
      updateState('listening');
      createMealEstimate(userText).catch(() => undefined);
    }
  }, [createMealEstimate, startNativeAudio, stopSession, updateState, upsertTranscript]);

  const startSession = useCallback(async () => {
    if (stateRef.current === 'connecting' || socketRef.current) return;
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    updateState('connecting');
    setMessage('Connecting Kimbo…');
    try {
      const permission = await requestMicrophonePermission();
      if (attempt !== attemptRef.current) return;
      if (permission !== 'granted') {
        updateState('error');
        setMessage('Microphone access is needed for a live conversation. Allow it in Settings and try again.');
        return;
      }
      const session = await createLiveSession(dateKey());
      if (attempt !== attemptRef.current) return;
      const socket = new WebSocket(`${session.websocketUrl}?access_token=${encodeURIComponent(session.token)}`);
      // RN supports this at runtime but its typings omit it; Gemini sends JSON in binary frames.
      (socket as WebSocket & { binaryType: 'arraybuffer' | 'blob' }).binaryType = 'arraybuffer';
      socketRef.current = socket;
      socket.onopen = () => {
        if (socketRef.current === socket) socket.send(buildSetupMessage(session.model));
      };
      socket.onmessage = event => {
        if (socketRef.current === socket) handleServerMessage(event.data);
      };
      socket.onerror = () => {
        if (socketRef.current !== socket) return;
        stopSession(liveRef.current
          ? 'Kimbo lost the connection. Check your network and try again.'
          : 'Kimbo could not connect. Check your network and try again.', 'error');
      };
      socket.onclose = event => {
        if (socketRef.current !== socket) return;
        if (!liveRef.current) {
          stopSession(setupFailureMessage(event.reason), 'error');
        } else if (goAwayRef.current) {
          stopSession('Kimbo’s session reached its time limit. Tap Start conversation to continue.');
        } else {
          stopSession('Kimbo ended the conversation. Tap Start conversation to reconnect.');
        }
      };
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      updateState('error');
      setMessage(error instanceof Error ? error.message : 'Kimbo could not start the live conversation.');
    }
  }, [handleServerMessage, stopSession, updateState]);

  useEffect(() => {
    onAudioChunk(buffer => {
      const socket = socketRef.current;
      if (!liveRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(buildAudioMessage(fromByteArray(new Uint8Array(buffer))));
    });
    onVoiceActivity(event => {
      if (!liveRef.current) return;
      level.value = withTiming(Math.min(event.rms, 1), { duration: 80 });
    });
    return () => stopSession();
  }, [level, stopSession]);

  const renderItem = useCallback(({ item }: { item: Transcript }) => <TranscriptBubble item={item} />, []);
  const keyExtractor = useCallback((item: Transcript) => item.id, []);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <RoundIconButton name="arrowLeft" label="Back from voice conversation" bg={colors.chip} size={42} iconSize={20} stroke={2.6} onPress={() => { stopSession(); onClose(); }} />
        <Text style={styles.headerTitle}>Talk with Kimbo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.hero}>
        <KimboAura state={state} level={level} />
        <Text style={styles.stateLabel}>{labelForState(state)}</Text>
        <Text style={styles.description}>{message}</Text>
      </View>

      <FlashList
        ref={transcriptListRef}
        data={transcripts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.transcripts}
        onContentSizeChange={() => transcriptListRef.current?.scrollToEnd({ animated: true })}
      />

      {pendingEstimate ? (
        <View style={styles.estimateCard}>
          <View style={styles.estimateHeading}><View style={styles.estimateGrow}><Text style={styles.estimateName}>{pendingEstimate.name}</Text><Text style={styles.estimateMeta}>{pendingEstimate.confidence} confidence · rough wellness estimate</Text></View><Text style={styles.estimateCalories}>{pendingEstimate.caloriesKcal} kcal</Text></View>
          <Text style={styles.estimateMacros}>Protein {pendingEstimate.proteinGrams ?? '—'}g · Carbs {pendingEstimate.carbsGrams ?? '—'}g · Fat {pendingEstimate.fatGrams ?? '—'}g</Text>
          <PillButton title="Confirm and log" variant="dark" height={44} busy={logging} busyLabel="Saving…" onPress={logEstimate} />
        </View>
      ) : null}

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {state === 'idle' || state === 'error' ? (
          <PillButton title="Start conversation" variant="dark" icon="mic" height={54} onPress={startSession} />
        ) : (
          <PillButton title={state === 'connecting' ? 'Connecting…' : 'End conversation'} variant="light" icon="close" height={54} busy={state === 'connecting'} busyLabel="Connecting…" onPress={() => stopSession()} />
        )}
        <Text style={styles.privacy}>Audio is live-only. healthFlip does not save recordings or transcripts.</Text>
      </View>
    </View>
  );
}

const TranscriptBubble = ({ item }: { item: Transcript }) => (
  <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.kimboBubble]}>
    <Text style={styles.bubbleLabel}>{item.role === 'user' ? 'You' : 'Kimbo'}</Text>
    <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>{item.text}</Text>
  </View>
);

// `level` is driven straight from the native VAD callback so mic levels never re-render React.
function KimboAura({ state, level }: { state: VoiceState; level: SharedValue<number> }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = state === 'listening' || state === 'speaking'
      ? withRepeat(withTiming(1, { duration: state === 'speaking' ? 700 : 1300, easing: Easing.inOut(Easing.quad) }), -1, true)
      : withTiming(0, { duration: 200 });
  }, [pulse, state]);
  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.76 + pulse.value * 0.24,
    transform: [{ scale: 1 + pulse.value * 0.05 + level.value * 0.18 }],
  }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + level.value * 0.1 }] }));
  return (
    <Animated.View style={[styles.auraOuter, auraStyle]}>
      <View style={styles.auraRingA} />
      <View style={styles.auraRingB} />
      <Animated.View style={[styles.auraCore, innerStyle]}><Icon name="leaf" color={colors.greenDark} size={32} stroke={2.3} /></Animated.View>
    </Animated.View>
  );
}

function labelForState(state: VoiceState): string {
  if (state === 'connecting') return 'Connecting';
  if (state === 'listening') return 'Listening';
  if (state === 'speaking') return 'Kimbo is speaking';
  if (state === 'error') return 'Connection needs attention';
  return 'Ready when you are';
}

function setupFailureMessage(reason?: string): string {
  const detail = reason?.trim().slice(0, 140);
  return detail
    ? `Kimbo could not start the live conversation (${detail}). Please try again.`
    : 'Kimbo could not start the live conversation. Please try again.';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.white, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 18 },
  headerTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 42 },
  hero: { alignItems: 'center', gap: 7, paddingHorizontal: 28, paddingTop: 26 },
  auraOuter: { alignItems: 'center', height: 178, justifyContent: 'center', width: 178 },
  auraRingA: { backgroundColor: 'rgba(159,211,74,.20)', borderRadius: 89, height: 178, position: 'absolute', width: 178 },
  auraRingB: { backgroundColor: 'rgba(183,227,106,.48)', borderRadius: 70, height: 140, position: 'absolute', width: 140 },
  auraCore: { alignItems: 'center', backgroundColor: colors.limeBright, borderColor: colors.white, borderRadius: 46, borderWidth: 7, boxShadow: '0 14px 28px rgba(61,90,18,.2)', height: 92, justifyContent: 'center', width: 92 },
  stateLabel: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19, maxWidth: 330, textAlign: 'center' },
  transcripts: { gap: 9, paddingBottom: 16, paddingHorizontal: 20, paddingTop: 20 },
  bubble: { borderRadius: 17, gap: 3, maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10 },
  kimboBubble: { alignSelf: 'flex-start', backgroundColor: colors.white, borderBottomLeftRadius: 5 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.greenDark, borderBottomRightRadius: 5 },
  bubbleLabel: { color: colors.greenText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  userBubbleText: { color: colors.white },
  controls: { backgroundColor: colors.white, borderTopColor: colors.chip, borderTopWidth: 1, gap: 9, paddingHorizontal: 20, paddingTop: 13 },
  privacy: { color: colors.faint, fontSize: 11, textAlign: 'center' },
  estimateCard: { backgroundColor: colors.pale, borderRadius: 18, gap: 8, marginHorizontal: 20, marginTop: 6, padding: 13 },
  estimateHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  estimateGrow: { flex: 1 },
  estimateName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  estimateMeta: { color: colors.muted2, fontSize: 11, marginTop: 2 },
  estimateCalories: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  estimateMacros: { color: colors.muted, fontSize: 12 },
});
