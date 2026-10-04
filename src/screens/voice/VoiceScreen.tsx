import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { toByteArray, fromByteArray } from 'base64-js';
import { useSharedValue } from 'react-native-reanimated';
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

import { type AiMealEstimate, createLiveSession, createMeal, estimateMeal, generatePlan, type GeneratePlanRequest, saveFood, saveMemory, savePlan } from '../../services/api';
import { TranscriptLine, type ChatRole } from '../../components/chat/TranscriptLine';
import { ParticleOrb, type OrbPhase } from '../../components/flip/ParticleOrb';
import { type MealType, mealTypeLabel } from '../../features/meals/meals';
import { dateKey } from '../../utils/date';
import { formatNumber } from '../../utils/format';
import type { MemoryCategory } from '../../types';
import { Icon, type IconName, PillButton, Spinner } from '../../components/ui';
import { colors } from '../../constants/theme';
import {
  buildAudioMessage,
  buildSetupMessage,
  buildTextMessage,
  buildToolResponseMessage,
  looksLikeMeal,
  mealTypeFromText,
  outputSampleRate,
  parseMealType,
  parseServerMessage,
  type LiveFunctionCall,
} from '../../features/voice/protocol';

type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
type Role = ChatRole;
type MealStatus = 'pending' | 'logging' | 'logged';
type Entry =
  | { id: string; kind: 'text'; role: Role; text: string }
  | { id: string; kind: 'note'; text: string }
  | { estimate: AiMealEstimate; id: string; kind: 'meal'; mealType: MealType; status: MealStatus };
type Turn = { flip: string; flipId: string | null; user: string; userId: string | null };

type VoiceScreenProps = {
  /** Sent to Flip as soon as the session is ready (e.g. "explain my report"), so the user doesn't have to ask. */
  initialQuestion?: string;
  mealType: MealType;
  onClose: () => void;
  onMealLogged: () => void;
  /** Opens the existing text chat (replaces the prototype's SIM/MIC toggle). */
  onOpenText?: () => void;
  /** kcal left today before this conversation's logs; null when no goal is set. */
  remainingCalories?: number | null;
  /** First name from the profile, used in the greeting. */
  userName?: string;
  /** Called after Flip creates and saves a plan, so the Plans tab can refresh. */
  onPlanSaved?: () => void;
};

const greetingFor = (name?: string): Entry => ({
  id: 'welcome',
  kind: 'text',
  role: 'flip',
  text: name ? `Hi ${name}, I’m Flip. Tell me what you ate and I’ll log it for you.` : 'Hi, I’m Flip. Tell me what you ate and I’ll log it for you.',
});
const SUGGESTIONS = ['I had roti, dal and curd for lunch', 'Poha and chai for breakfast', 'A paneer tikka wrap as a snack'];
const STATUS: Record<VoiceState, { dot: string; label: string }> = {
  connecting: { dot: '#e0a92a', label: 'Connecting…' },
  error: { dot: '#a5ab9e', label: 'Tap the mic to try again' },
  idle: { dot: '#a5ab9e', label: 'Tap the mic to talk' },
  listening: { dot: '#c4452f', label: 'Listening…' },
  speaking: { dot: '#6fbf3a', label: 'Flip is speaking' },
  thinking: { dot: '#e0a92a', label: 'Thinking…' },
};
const THINKING_TIMEOUT_MS = 6000;
const MEMORY_CATEGORIES: readonly MemoryCategory[] = ['diet', 'allergy', 'preference', 'routine', 'goal', 'other'];
const emptyTurn = (): Turn => ({ flip: '', flipId: null, user: '', userId: null });

export function VoiceScreen({ initialQuestion, mealType, onClose, onMealLogged, onOpenText, onPlanSaved, remainingCalories = null, userName }: VoiceScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const socketRef = useRef<WebSocket | null>(null);
  // Bumped on every start/stop so stale async work and socket callbacks can detect they were superseded.
  const attemptRef = useRef(0);
  // True only after Gemini sent setupComplete and the native recorder/player are running.
  const liveRef = useRef(false);
  const goAwayRef = useRef(false);
  const mutedRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const queuedTextRef = useRef<string | null>(null);
  // Once Gemini has called show_meal_card, the keyword fallback is switched off to avoid duplicate cards.
  const toolSeenRef = useRef(false);
  const thinkingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stateRef = useRef<VoiceState>('idle');
  const turnRef = useRef<Turn>(emptyTurn());
  const entryCount = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const level = useSharedValue(0);
  const pulse = useSharedValue(0);
  const [state, setState] = useState<VoiceState>('idle');
  const [muted, setMuted] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(() => [greetingFor(userName)]);

  const live = state === 'listening' || state === 'thinking' || state === 'speaking';
  const activeCard = entries.find((entry): entry is Extract<Entry, { kind: 'meal' }> => entry.kind === 'meal' && entry.status !== 'logged');

  // Audio chunks arrive many times per second; only re-render when the state actually changes.
  const updateState = useCallback((next: VoiceState) => {
    clearTimeout(thinkingTimer.current);
    // If Flip never answers, drop back to listening rather than spinning on "Thinking…".
    if (next === 'thinking') {
      thinkingTimer.current = setTimeout(() => {
        if (stateRef.current !== 'thinking') return;
        stateRef.current = 'listening';
        setState('listening');
      }, THINKING_TIMEOUT_MS);
    }
    if (stateRef.current === next) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const nextId = useCallback(() => {
    entryCount.current += 1;
    return `live-${entryCount.current}`;
  }, []);

  // Pass null to append a new line; returns the id so live fragments can keep updating it.
  const upsertText = useCallback((id: string | null, role: Role, text: string): string => {
    const entryId = id ?? nextId();
    setEntries(current => {
      const index = current.findIndex(entry => entry.id === entryId);
      if (index === -1) return [...current, { id: entryId, kind: 'text', role, text }];
      const next = current.slice();
      next[index] = { id: entryId, kind: 'text', role, text };
      return next;
    });
    return entryId;
  }, [nextId]);

  const stopSession = useCallback((note?: string, nextState: VoiceState = 'idle') => {
    attemptRef.current += 1;
    liveRef.current = false;
    goAwayRef.current = false;
    mutedRef.current = false;
    userSpeakingRef.current = false;
    queuedTextRef.current = null;
    toolSeenRef.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    try { stopRecording(); } catch { /* The recorder may not have started. */ }
    try { stopPlayback(); } catch { /* The player may not have started. */ }
    try { releasePlayer(); deactivateAudioSession(); } catch { /* Best-effort native cleanup. */ }
    turnRef.current = emptyTurn();
    level.value = 0;
    pulse.value = 0;
    setMuted(false);
    updateState(nextState);
    if (note) upsertText(null, 'flip', note);
  }, [level, pulse, updateState, upsertText]);

  // `announce` adds Flip's text line; skipped on the tool path because Flip speaks the estimate itself.
  // Resolves to the estimate, or to the API's readable reason (e.g. quota reached) so Flip can say it.
  const showEstimate = useCallback(async (description: string, type: MealType, announce: boolean): Promise<{ estimate: AiMealEstimate } | { error: string }> => {
    try {
      const estimate = await estimateMeal(description, type);
      const label = mealTypeLabel(type).toLowerCase();
      const protein = estimate.proteinGrams != null ? ` with ${formatNumber(estimate.proteinGrams)}g protein` : '';
      setEntries(current => [
        // A newer estimate replaces any card that was never confirmed.
        ...current.filter(entry => !(entry.kind === 'meal' && entry.status === 'pending')),
        ...(announce ? [{ id: nextId(), kind: 'text' as const, role: 'flip' as const, text: `Got it. That’s about ${formatNumber(estimate.caloriesKcal)} kcal${protein}. Should I add it to ${label}?` }] : []),
        { estimate, id: nextId(), kind: 'meal', mealType: type, status: 'pending' },
      ]);
      return { estimate };
    } catch (error) {
      const reason = error instanceof Error && error.message ? error.message : 'The estimate is unavailable right now.';
      if (announce) upsertText(null, 'flip', `I heard that meal, but I couldn’t prepare its card. ${reason}`);
      return { error: reason };
    }
  }, [nextId, upsertText]);

  // Keyword fallback for a session where Gemini has not used the meal tool.
  const createMealEstimate = useCallback(async (description: string) => {
    if (toolSeenRef.current || !looksLikeMeal(description)) return;
    await showEstimate(description, mealTypeFromText(description) ?? mealType, true);
  }, [mealType, showEstimate]);

  // Flip chose to remember a lasting fact; it is saved to the guest's memories and shown as a note.
  const rememberFact = useCallback(async (args: Record<string, unknown> | undefined, respond: (response: Record<string, unknown>) => void) => {
    const text = typeof args?.text === 'string' ? args.text.trim() : '';
    if (!text) {
      respond({ error: 'Nothing to remember was provided.' });
      return;
    }
    const category = MEMORY_CATEGORIES.includes(args?.category as MemoryCategory) ? args?.category as MemoryCategory : 'other';
    try {
      const memory = await saveMemory(text, category);
      setEntries(current => [...current, { id: nextId(), kind: 'note', text: `Remembered: ${memory.text}` }]);
      respond({ saved: true, text: memory.text });
    } catch (error) {
      respond({ error: error instanceof Error && error.message ? error.message : 'Could not save that memory.' });
    }
  }, [nextId]);

  // Flip was asked for a meal plan: generate it, save it, and show progress as a note.
  const createPlanByVoice = useCallback(async (args: Record<string, unknown> | undefined, respond: (response: Record<string, unknown>) => void) => {
    const request = planRequestFromArgs(args);
    if (!request) {
      respond({ error: 'Only meal plans are available right now. Offer to make a meal plan instead.' });
      return;
    }
    const noteId = nextId();
    const label = 'meal plan';
    setEntries(current => [...current, { id: noteId, kind: 'note', text: `Creating your ${label}…` }]);
    const setNote = (text: string) => setEntries(current => current.map(entry => (entry.id === noteId ? { id: noteId, kind: 'note', text } : entry)));
    updateState('thinking');
    try {
      const plan = await savePlan(await generatePlan(request));
      setNote(`Saved “${plan.title}” to Plans`);
      onPlanSaved?.();
      respond({ days: plan.content.days.length, kind: plan.kind, saved: true, summary: plan.content.summary, title: plan.title });
    } catch (error) {
      setNote(`Couldn’t create the ${label}`);
      respond({ error: error instanceof Error && error.message ? error.message : 'The plan could not be created.' });
    }
  }, [nextId, onPlanSaved, updateState]);

  // Gemini recognised a meal (in any language) and asked for a card; it waits for this response.
  const handleToolCall = useCallback(async (call: LiveFunctionCall) => {
    const attempt = attemptRef.current;
    const respond = (response: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (attempt !== attemptRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(buildToolResponseMessage(call.id, call.name, response));
    };
    if (call.name === 'save_memory') {
      await rememberFact(call.args, respond);
      return;
    }
    if (call.name === 'create_plan') {
      await createPlanByVoice(call.args, respond);
      return;
    }
    if (call.name !== 'show_meal_card') {
      respond({ error: `Unknown tool ${call.name ?? ''}`.trim() });
      return;
    }
    toolSeenRef.current = true;
    const description = typeof call.args?.description === 'string' ? call.args.description.trim() : '';
    if (!description) {
      respond({ error: 'No meal description was provided.' });
      return;
    }
    const type = parseMealType(call.args?.mealType) ?? mealTypeFromText(description) ?? mealType;
    updateState('thinking');
    const result = await showEstimate(description, type, false);
    if (attempt !== attemptRef.current) return;
    if ('error' in result) {
      respond({ error: result.error });
      return;
    }
    const { estimate } = result;
    respond({
        caloriesKcal: estimate.caloriesKcal,
        carbsGrams: estimate.carbsGrams,
        confidence: estimate.confidence,
        fatGrams: estimate.fatGrams,
        mealType: type,
        name: estimate.name,
        proteinGrams: estimate.proteinGrams,
        status: 'Card shown. Waiting for the user to tap Add; the meal is not logged yet.',
      });
  }, [createPlanByVoice, mealType, rememberFact, showEstimate, updateState]);

  const setCardStatus = useCallback((id: string, status: MealStatus) => {
    setEntries(current => current.map(entry => (entry.id === id && entry.kind === 'meal' ? { ...entry, status } : entry)));
  }, []);

  // Logging always requires this explicit confirmation (card button or mic tap).
  const logCard = useCallback(async (card: Extract<Entry, { kind: 'meal' }>) => {
    if (card.status !== 'pending') return;
    const { estimate } = card;
    setCardStatus(card.id, 'logging');
    try {
      await createMeal({
        caloriesKcal: estimate.caloriesKcal,
        carbsGrams: estimate.carbsGrams ?? undefined,
        fatGrams: estimate.fatGrams ?? undefined,
        mealType: card.mealType,
        name: estimate.name,
        note: 'Estimated during a Flip voice conversation. Review the portion if needed.',
        proteinGrams: estimate.proteinGrams ?? undefined,
        source: 'voice',
      });
      // Confirmed meals become "Pick from list" options; this never blocks logging.
      const serving = estimate.items?.map(item => `${item.name} ~${item.grams} g`).join(', ').slice(0, 200) || '1 serving';
      saveFood({ caloriesKcal: estimate.caloriesKcal, carbsGrams: estimate.carbsGrams, fatGrams: estimate.fatGrams, name: estimate.name, proteinGrams: estimate.proteinGrams, serving }).catch(() => undefined);
      setCardStatus(card.id, 'logged');
      upsertText(null, 'flip', loggedLine(card.mealType, remainingCalories, estimate.caloriesKcal));
      onMealLogged();
    } catch {
      setCardStatus(card.id, 'pending');
      upsertText(null, 'flip', 'I couldn’t save that meal. The card is still here, so you can try again.');
    }
  }, [onMealLogged, remainingCalories, setCardStatus, upsertText]);

  const sendText = useCallback((text: string) => {
    const socket = socketRef.current;
    if (!liveRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(buildTextMessage(text));
    // Typed turns have no input transcription, so seed the turn for meal detection.
    turnRef.current = { ...emptyTurn(), user: text, userId: upsertText(null, 'user', text) };
    updateState('thinking');
  }, [updateState, upsertText]);

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
  }, [updateState]);

  const handleServerMessage = useCallback((data: unknown) => {
    const payload = parseServerMessage(data);
    if (!payload) return;

    if (payload.setupComplete) {
      if (liveRef.current) return;
      try {
        startNativeAudio();
      } catch {
        stopSession('I couldn’t start your microphone. Please try again.', 'error');
        return;
      }
      const queued = queuedTextRef.current;
      queuedTextRef.current = null;
      if (queued) sendText(queued);
      return;
    }
    if (payload.toolCall) {
      for (const call of payload.toolCall.functionCalls ?? []) handleToolCall(call).catch(() => undefined);
      return;
    }
    if (payload.goAway) {
      goAwayRef.current = true;
      upsertText(null, 'flip', 'This conversation is reaching its time limit. I’ll wrap up shortly.');
    }

    const content = payload.serverContent;
    if (!content || !liveRef.current) return;
    const turn = turnRef.current;

    if (content.interrupted) {
      try { stopPlayback(); } catch { /* Native player may already be idle. */ }
      turn.flip = '';
      turn.flipId = null;
      updateState('listening');
    }
    // Transcriptions arrive as fragments; accumulate them per turn.
    if (content.inputTranscription?.text) {
      turn.user += content.inputTranscription.text;
      if (turn.user.trim()) turn.userId = upsertText(turn.userId, 'user', turn.user.trim());
    }
    if (content.outputTranscription?.text) {
      turn.flip += content.outputTranscription.text;
      if (turn.flip.trim()) turn.flipId = upsertText(turn.flipId, 'flip', turn.flip.trim());
      pulse.value = 1;
      updateState('speaking');
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if (!part.inlineData?.data) continue;
      playChunk(toByteArray(part.inlineData.data).buffer as ArrayBuffer);
      pulse.value = Math.max(pulse.value, 0.5);
      updateState('speaking');
    }
    if (content.turnComplete) {
      const userText = turn.user.trim();
      turnRef.current = emptyTurn();
      updateState('listening');
      createMealEstimate(userText).catch(() => undefined);
    }
  }, [createMealEstimate, handleToolCall, pulse, sendText, startNativeAudio, stopSession, updateState, upsertText]);

  const startSession = useCallback(async (firstText?: string) => {
    if (stateRef.current === 'connecting' || socketRef.current) return;
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    queuedTextRef.current = firstText ?? null;
    updateState('connecting');
    try {
      const permission = await requestMicrophonePermission();
      if (attempt !== attemptRef.current) return;
      if (permission !== 'granted') {
        updateState('error');
        upsertText(null, 'flip', 'I need microphone access for a live conversation. Allow it in Settings and try again.');
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
          ? 'I lost the connection. Check your network and try again.'
          : 'I couldn’t connect. Check your network and try again.', 'error');
      };
      socket.onclose = event => {
        if (socketRef.current !== socket) return;
        if (!liveRef.current) {
          stopSession(setupFailureMessage(event.reason), 'error');
        } else if (goAwayRef.current) {
          stopSession('That session reached its time limit. Tap the mic to keep going.');
        } else {
          stopSession('The conversation ended. Tap the mic to reconnect.');
        }
      };
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      updateState('error');
      upsertText(null, 'flip', error instanceof Error ? error.message : 'I couldn’t start the live conversation.');
    }
  }, [handleServerMessage, stopSession, updateState, upsertText]);

  const toggleMute = useCallback(() => {
    if (!liveRef.current) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    level.value = 0;
  }, [level]);

  // Mic: start when idle, confirm a pending card, otherwise end the conversation.
  const pressMic = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      startSession().catch(() => undefined);
    } else if (activeCard?.status === 'pending') {
      logCard(activeCard).catch(() => undefined);
    } else if (state !== 'connecting') {
      stopSession();
    }
  }, [activeCard, logCard, startSession, state, stopSession]);

  const pressSuggestion = useCallback((text: string) => {
    if (liveRef.current) sendText(text);
    else startSession(text).catch(() => undefined);
  }, [sendText, startSession]);

  // A handed-over question starts the session and is sent once Gemini is ready.
  const askedRef = useRef(false);
  useEffect(() => {
    if (!initialQuestion || askedRef.current) return;
    askedRef.current = true;
    startSession(initialQuestion).catch(() => undefined);
  }, [initialQuestion, startSession]);

  useEffect(() => {
    onAudioChunk(buffer => {
      const socket = socketRef.current;
      if (!liveRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
      // Muted streams silence rather than nothing: Gemini only ends a turn after ~1s+ of silence, and
      // both a stalled stream and audioStreamEnd left the user's last sentence unanswered (verified live).
      const pcm = mutedRef.current ? new Uint8Array(buffer.byteLength) : new Uint8Array(buffer);
      socket.send(buildAudioMessage(fromByteArray(pcm)));
    });
    onVoiceActivity(event => {
      if (!liveRef.current || mutedRef.current) return;
      level.value = Math.min(1, event.rms * 6);
      // Local VAD drives listening → thinking until Flip's reply starts.
      if (event.isSpeaking) {
        userSpeakingRef.current = true;
        if (stateRef.current === 'thinking') updateState('listening');
      } else if (userSpeakingRef.current) {
        userSpeakingRef.current = false;
        if (stateRef.current === 'listening') updateState('thinking');
      }
    });
    return () => {
      clearTimeout(thinkingTimer.current);
      stopSession();
    };
  }, [level, stopSession, updateState]);

  const close = () => {
    stopSession();
    onClose();
  };

  const orbPhase: OrbPhase = state === 'listening' || state === 'thinking' || state === 'speaking' ? state : state === 'connecting' ? 'thinking' : 'idle';
  const status = muted ? { dot: '#a5ab9e', label: 'Muted' } : STATUS[state];
  const showChips = (state === 'idle' || state === 'listening') && !muted && !activeCard;
  const micIcon: IconName = state === 'idle' || state === 'error' ? 'mic' : activeCard?.status === 'pending' ? 'check' : 'stop';
  const micLabel = state === 'idle' || state === 'error' ? 'Start talking to Flip' : activeCard?.status === 'pending' ? 'Add this meal' : 'End conversation';
  const lastId = entries[entries.length - 1]?.id;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 2 }]}>
        <CircleButton icon="close" label="Close Flip" onPress={close} size={44} />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Flip</Text>
          <Text style={styles.subtitle}>Live wellness conversation</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.transcriptArea}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.transcript}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}>
          {entries.map(entry => (entry.kind === 'text'
            ? <TranscriptLine key={entry.id} animate={entry.id === lastId} role={entry.role} text={entry.text} />
            : entry.kind === 'note'
              ? <MemoryNote key={entry.id} text={entry.text} />
              : <MealCard key={entry.id} card={entry} onConfirm={() => logCard(entry)} />))}
        </ScrollView>
        <View style={[styles.fade, { width }]} pointerEvents="none" />
      </View>

      <View style={styles.chipsSlot}>
        {showChips ? (
          <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
            {SUGGESTIONS.map(text => (
              <Pressable key={text} accessibilityRole="button" onPress={() => pressSuggestion(text)} style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                <Text style={styles.chipText}>{text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.orbArea}>
        <ParticleOrb width={width} height={200} phase={orbPhase} muted={muted} level={level} pulse={pulse} />
        <View style={styles.status} accessibilityLiveRegion="polite">
          <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <CircleButton icon="micOff" label={muted ? 'Unmute microphone' : 'Mute microphone'} onPress={toggleMute} size={54} active={muted} disabled={!live} />
        <Pressable
          accessibilityLabel={micLabel}
          accessibilityRole="button"
          accessibilityState={{ busy: state === 'connecting', disabled: state === 'connecting' || activeCard?.status === 'logging' }}
          disabled={state === 'connecting' || activeCard?.status === 'logging'}
          onPress={pressMic}
          style={({ pressed }) => [styles.mic, pressed && styles.micPressed]}>
          {state === 'connecting' ? <Spinner color={colors.limeBright} /> : <Icon name={micIcon} color={colors.limeBright} size={30} stroke={2.4} />}
        </Pressable>
        <CircleButton icon="keyboard" label="Type to Flip instead" onPress={() => { stopSession(); onOpenText?.(); }} size={54} disabled={!onOpenText} />
      </View>
    </View>
  );
}

function CircleButton({ active = false, disabled = false, icon, label, onPress, size }: { active?: boolean; disabled?: boolean; icon: IconName; label: string; onPress: () => void; size: number }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.circle, { borderRadius: size / 2, height: size, width: size }, active && styles.circleActive, disabled && styles.circleDisabled, pressed && styles.circlePressed]}>
      <Icon name={icon} color={active ? colors.white : colors.ink} size={size > 50 ? 22 : 19} stroke={2.4} />
    </Pressable>
  );
}

function MemoryNote({ text }: { text: string }) {
  return (
    <View style={styles.note} accessible accessibilityLabel={text}>
      <Icon name="check" color={colors.greenDark} size={14} stroke={3} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

/** Meal card (spec §6): confirm adds it to the day; afterwards it stays as a non-interactive record. */
function MealCard({ card, onConfirm }: { card: Extract<Entry, { kind: 'meal' }>; onConfirm: () => void }) {
  const { estimate } = card;
  const label = mealTypeLabel(card.mealType);
  const quantity = estimate.assumptions[0];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTag}><Text style={styles.cardTagText}>{label}</Text></View>
        {estimate.proteinGrams != null ? <Text style={styles.cardProtein}>{formatNumber(estimate.proteinGrams)}g protein</Text> : null}
      </View>
      <View style={styles.cardRow}>
        <View style={styles.cardRowText}>
          <Text style={styles.cardName}>{estimate.name}</Text>
          {quantity ? <Text style={styles.cardQuantity} numberOfLines={2}>{quantity}</Text> : null}
        </View>
        <Text style={styles.cardRowKcal}>{formatNumber(estimate.caloriesKcal)} kcal</Text>
      </View>
      <View style={styles.cardDivider} />
      <View style={styles.cardTotal}>
        <Text style={styles.cardTotalLabel}>Total</Text>
        <Text style={styles.cardTotalValue}>{formatNumber(estimate.caloriesKcal)} kcal</Text>
      </View>
      {card.status === 'logged' ? (
        <View style={styles.cardLogged} accessibilityRole="text">
          <Icon name="check" color={colors.greenDark} size={18} stroke={2.8} />
          <Text style={styles.cardLoggedText}>Logged to {label}</Text>
        </View>
      ) : (
        <PillButton title={`Add to ${label}`} variant="dark" icon="check" height={46} busy={card.status === 'logging'} busyLabel="Adding…" onPress={onConfirm} />
      )}
    </View>
  );
}

function loggedLine(type: MealType, remaining: number | null, calories: number): string {
  const label = mealTypeLabel(type);
  if (remaining == null) return `Done. ${label} is logged.`;
  const left = Math.round(remaining - calories);
  if (left >= 0) return `Done. ${label} is logged. You have ${formatNumber(left)} kcal left today.`;
  const lightMeal = type === 'dinner' ? 'the rest of today' : 'dinner';
  return `Done. ${label} is logged. You’re ${formatNumber(-left)} kcal over today, so keep ${lightMeal} light.`;
}

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => (allowed.includes(value as T) ? value as T : undefined);
const clampInt = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : undefined;

/** Maps Flip's create_plan arguments onto the plan API's options, dropping anything invalid. Only meal plans for now. */
export function planRequestFromArgs(args: Record<string, unknown> | undefined): GeneratePlanRequest | null {
  const notes = typeof args?.notes === 'string' && args.notes.trim() ? args.notes.trim().slice(0, 200) : undefined;
  if (args?.kind === 'diet') {
    const requestedDays = clampInt(args.days, 1, 7);
    const days = requestedDays === undefined ? undefined : requestedDays <= 1 ? 1 : requestedDays <= 4 ? 3 : 7;
    const cuisine = typeof args.cuisine === 'string' && args.cuisine.trim().length >= 2 ? args.cuisine.trim().slice(0, 40) : undefined;
    return { kind: 'diet', options: { cuisine, days, dietType: pick(args.dietType, ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian', 'any'] as const), notes } };
  }
  return null;
}

function setupFailureMessage(reason?: string): string {
  const detail = reason?.trim().slice(0, 140);
  return detail
    ? `I couldn’t start the live conversation (${detail}). Please try again.`
    : 'I couldn’t start the live conversation. Please try again.';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, paddingHorizontal: 16 },
  titleBlock: { alignItems: 'center' },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  headerSpacer: { width: 44 },
  transcriptArea: { flex: 1 },
  transcript: { flexGrow: 1, gap: 14, justifyContent: 'flex-end', paddingBottom: 12, paddingHorizontal: 22, paddingTop: 28 },
  fade: { height: 28, left: 0, position: 'absolute', right: 0, top: 0 },
  note: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.pale, borderRadius: 14, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  noteText: { color: colors.greenDark, fontSize: 13, fontWeight: '700' },
  chipsSlot: { height: 44, justifyContent: 'center' },
  chips: { gap: 8, paddingHorizontal: 22 },
  chip: { backgroundColor: colors.white, borderColor: '#e3e6dc', borderRadius: 18, borderWidth: 1.5, height: 36, justifyContent: 'center', paddingHorizontal: 14 },
  chipPressed: { backgroundColor: colors.selected },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  orbArea: { alignItems: 'center', height: 200, justifyContent: 'center' },
  status: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, bottom: 12, boxShadow: '0 4px 14px rgba(28,31,26,.08)', flexDirection: 'row', gap: 7, height: 32, paddingHorizontal: 13, position: 'absolute' },
  statusDot: { borderRadius: 4, height: 8, width: 8 },
  statusText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  controls: { alignItems: 'center', flexDirection: 'row', gap: 30, justifyContent: 'center', paddingTop: 14 },
  circle: { alignItems: 'center', backgroundColor: colors.white, boxShadow: '0 4px 14px rgba(28,31,26,.08)', justifyContent: 'center' },
  circleActive: { backgroundColor: colors.ink },
  circleDisabled: { opacity: 0.45 },
  circlePressed: { transform: [{ scale: 0.95 }] },
  mic: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 38, boxShadow: '0 10px 24px rgba(28,31,26,.22)', height: 76, justifyContent: 'center', width: 76 },
  micPressed: { transform: [{ scale: 0.96 }] },
  card: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 24, boxShadow: '0 8px 22px rgba(28,31,26,.08)', gap: 12, padding: 16, width: 300 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTag: { backgroundColor: colors.pale, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  cardTagText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  cardProtein: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  cardRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  cardRowText: { flex: 1, gap: 2 },
  cardName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  cardQuantity: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  cardRowKcal: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  cardDivider: { borderColor: colors.dashed, borderStyle: 'dashed', borderTopWidth: 1.5 },
  cardTotal: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  cardTotalLabel: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  cardTotalValue: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  cardLogged: { alignItems: 'center', backgroundColor: colors.pale, borderRadius: 23, flexDirection: 'row', gap: 8, height: 46, justifyContent: 'center' },
  cardLoggedText: { color: colors.greenDark, fontSize: 15, fontWeight: '800' },
});
