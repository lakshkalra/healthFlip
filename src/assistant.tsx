import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMeal, estimateMeal, estimateMealFromImage, type AiMealEstimate } from './api/client';
import { chooseMealImage } from './media';
import type { MealType } from './meals';
import { Icon, PillButton, RoundIconButton, colors } from './ui';

type AssistantSource = 'manual' | 'photo' | 'voice';

type Message = {
  id: string;
  role: 'assistant' | 'user';
  source?: AssistantSource;
  text: string;
  estimate?: AiMealEstimate;
  logged?: boolean;
};

type AssistantScreenProps = {
  mealType: MealType;
  onClose: () => void;
  onMealLogged: () => void;
  onOpenLiveVoice: () => void;
};

const welcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi, I’m Kimbo. Tell me what you ate, or share a meal photo, and I’ll give you a rough wellness estimate to review.',
};

export function AssistantFab({ bottom, onPress }: { bottom: number; onPress: () => void }) {
  return (
    <View style={[styles.fabWrap, { bottom }]}>
      <Pressable accessibilityLabel="Open Kimbo assistant" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Icon name="message" color={colors.ink} size={23} stroke={2.2} />
      </Pressable>
      <Text style={styles.fabLabel}>Ask Kimbo</Text>
    </View>
  );
}

export function AssistantScreen({ mealType, onClose, onMealLogged, onOpenLiveVoice }: AssistantScreenProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<Message> | null>(null);
  const messageNumber = useRef(0);
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [draft, setDraft] = useState('');
  const [draftSource, setDraftSource] = useState<AssistantSource>('manual');
  const [busy, setBusy] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [busy, messages]);

  function addMessage(message: Omit<Message, 'id'>) {
    messageNumber.current += 1;
    setMessages(current => [...current, { ...message, id: `message-${messageNumber.current}` }]);
  }

  async function estimate(description: string, source: AssistantSource, userText: string) {
    const text = userText.trim();
    if (text) addMessage({ role: 'user', source, text });
    setBusy(true);
    try {
      const result = await estimateMeal(description, mealType);
      addMessage({
        role: 'assistant',
        source,
        text: 'Here’s a rough estimate. Review it before adding it to today’s log.',
        estimate: result,
      });
      setDraft('');
      setDraftSource('manual');
    } catch (error) {
      addMessage({ role: 'assistant', text: getErrorMessage(error, 'I couldn’t estimate that right now. You can try again or use the manual meal picker.') });
    } finally {
      setBusy(false);
    }
  }

  function sendText() {
    if (!draft.trim() || busy) return;
    estimate(draft, draftSource, draft);
  }

  async function handleImage(source: 'camera' | 'library') {
    if (busy) return;
    setBusy(true);
    try {
      const selected = await chooseMealImage(source);
      if (!selected) return;
      addMessage({ role: 'user', source: 'photo', text: 'Photo shared for estimation.' });
      const result = await estimateMealFromImage(selected.base64, selected.mimeType, mealType);
      addMessage({
        role: 'assistant',
        source: 'photo',
        text: 'I’ve made a rough estimate from the photo. Review it before logging.',
        estimate: result,
      });
    } catch (error) {
      addMessage({ role: 'assistant', text: getErrorMessage(error, 'I couldn’t read that photo. Try another image or describe the meal instead.') });
    } finally {
      setBusy(false);
    }
  }

  const logEstimate = useCallback(async (message: Message) => {
    if (!message.estimate || loggingId) return;
    setLoggingId(message.id);
    try {
      await createMeal({
        caloriesKcal: message.estimate.caloriesKcal,
        carbsGrams: message.estimate.carbsGrams ?? undefined,
        fatGrams: message.estimate.fatGrams ?? undefined,
        mealType,
        name: message.estimate.name,
        note: 'Estimated with Kimbo. Review the portion if needed.',
        proteinGrams: message.estimate.proteinGrams ?? undefined,
        source: message.source ?? 'manual',
      });
      setMessages(current => current.map(item => item.id === message.id ? { ...item, logged: true } : item));
      onMealLogged();
    } catch (error) {
      addMessage({ role: 'assistant', text: getErrorMessage(error, 'I couldn’t save that meal right now. Your estimate is still here to retry.') });
    } finally {
      setLoggingId(null);
    }
  }, [loggingId, mealType, onMealLogged]);

  const renderMessage = useCallback(({ item: message }: { item: Message }) => (
    <View style={[styles.messageGroup, message.role === 'user' && styles.userGroup]}>
      <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>{message.text}</Text>
      </View>
      {message.estimate ? (
        <View style={styles.estimateCard}>
          <View style={styles.estimateHeader}>
            <View style={styles.grow}>
              <Text style={styles.estimateName}>{message.estimate.name}</Text>
              <Text style={styles.estimateMeta}>{message.estimate.confidence} confidence · {message.estimate.source === 'fallback' ? 'rough local estimate' : 'AI estimate'}</Text>
            </View>
            <Text style={styles.calories}>{message.estimate.caloriesKcal} kcal</Text>
          </View>
          <Text style={styles.macros}>Protein {message.estimate.proteinGrams ?? '—'}g · Carbs {message.estimate.carbsGrams ?? '—'}g · Fat {message.estimate.fatGrams ?? '—'}g</Text>
          <View style={styles.assumptions}>
            <Text style={styles.assumptionsTitle}>How Kimbo estimated this</Text>
            {message.estimate.assumptions.map((assumption, index) => <Text key={`${message.id}-assumption-${index}`} style={styles.assumption}>• {assumption}</Text>)}
          </View>
          <PillButton title={message.logged ? 'Added to today' : 'Log this estimate'} variant={message.logged ? 'muted' : 'dark'} height={44} busy={loggingId === message.id} busyLabel="Logging…" onPress={() => logEstimate(message)} />
        </View>
      ) : null}
    </View>
  ), [loggingId, logEstimate]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <RoundIconButton name="arrowLeft" label="Back from Kimbo" bg={colors.chip} size={42} iconSize={20} stroke={2.6} onPress={onClose} />
        <View style={styles.titleRow}>
          <View style={styles.kimboIcon}><Icon name="leaf" color={colors.greenDark} size={19} /></View>
          <View>
            <Text style={styles.title}>Ask Kimbo</Text>
            <Text style={styles.subtitle}>Your wellness assistant</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <FlashList
        ref={listRef}
        data={messages}
        keyExtractor={message => message.id}
        renderItem={renderMessage}
        style={styles.list}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={busy ? <Text style={styles.typing}>Kimbo is thinking…</Text> : null}
      />

      <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Message Kimbo"
            value={draft}
            onChangeText={text => { setDraft(text); setDraftSource('manual'); }}
            editable={!busy}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendText}
            placeholder="Tell Kimbo what you ate…"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <RoundIconButton name="arrowRight" label="Send message" bg={draft.trim() ? colors.limeBright : colors.chip} size={40} iconSize={18} stroke={2.6} busy={busy} onPress={sendText} />
        </View>
        <View style={styles.mediaRow}>
          <Pressable accessibilityLabel="Start a live voice conversation with Kimbo" accessibilityRole="button" disabled={busy} onPress={onOpenLiveVoice} style={({ pressed }) => [styles.mediaButton, styles.voice, pressed && styles.pressed, busy && styles.disabled]}>
            <Icon name="mic" color={colors.greenDark} size={17} />
            <Text style={styles.mediaText}>Talk live</Text>
          </Pressable>
          <Pressable accessibilityLabel="Share meal photo" accessibilityRole="button" disabled={busy} onPress={() => { handleImage('library'); }} style={({ pressed }) => [styles.mediaButton, pressed && styles.pressed, busy && styles.disabled]}>
            <Icon name="image" color={colors.greenDark} size={17} />
            <Text style={styles.mediaText}>Photo</Text>
          </Pressable>
          <Pressable accessibilityLabel="Take meal photo for Kimbo" accessibilityRole="button" disabled={busy} onPress={() => { handleImage('camera'); }} style={({ pressed }) => [styles.mediaButton, pressed && styles.pressed, busy && styles.disabled]}>
            <Icon name="camera" color={colors.greenDark} size={17} />
            <Text style={styles.mediaText}>Camera</Text>
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>Wellness estimates are approximate, not medical advice.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  grow: { flex: 1, gap: 3, minWidth: 0 },
  header: { alignItems: 'center', backgroundColor: colors.white, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 18 },
  headerSpacer: { width: 42 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  kimboIcon: { alignItems: 'center', backgroundColor: colors.limeBright, borderRadius: 13, height: 40, justifyContent: 'center', width: 40 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted2, fontSize: 12, marginTop: 2 },
  list: { flex: 1 },
  messages: { gap: 12, paddingBottom: 18, paddingHorizontal: 20, paddingTop: 18 },
  messageGroup: { alignItems: 'flex-start', gap: 8 },
  userGroup: { alignItems: 'flex-end' },
  bubble: { borderRadius: 18, maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11 },
  assistantBubble: { backgroundColor: colors.white, borderBottomLeftRadius: 6 },
  userBubble: { backgroundColor: colors.greenDark, borderBottomRightRadius: 6 },
  messageText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  userMessageText: { color: colors.white },
  estimateCard: { backgroundColor: colors.pale, borderRadius: 20, gap: 10, padding: 14, width: '100%' },
  estimateHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  estimateName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  estimateMeta: { color: colors.muted2, fontSize: 11, marginTop: 2 },
  calories: { color: colors.greenDark, fontSize: 17, fontWeight: '800' },
  macros: { color: colors.muted, fontSize: 13 },
  assumptions: { backgroundColor: colors.white, borderRadius: 12, gap: 4, padding: 10 },
  assumptionsTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  assumption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  typing: { color: colors.muted2, fontSize: 12, paddingHorizontal: 4 },
  composerArea: { backgroundColor: colors.white, borderTopColor: colors.chip, borderTopWidth: 1, gap: 9, paddingHorizontal: 18, paddingTop: 12 },
  composer: { alignItems: 'flex-end', backgroundColor: colors.bg, borderRadius: 18, flexDirection: 'row', gap: 8, minHeight: 56, paddingHorizontal: 8, paddingVertical: 8 },
  input: { color: colors.ink, flex: 1, fontSize: 15, maxHeight: 100, minHeight: 38, paddingHorizontal: 8, paddingVertical: 8 },
  mediaRow: { flexDirection: 'row', gap: 8 },
  voice: { flex: 1 },
  mediaButton: { alignItems: 'center', backgroundColor: colors.bg, borderRadius: 14, flexDirection: 'row', gap: 6, minHeight: 44, paddingHorizontal: 12 },
  mediaText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  pressed: { backgroundColor: colors.selected },
  disabled: { opacity: 0.55 },
  disclaimer: { color: colors.faint, fontSize: 11, paddingBottom: 2, textAlign: 'center' },
  fabWrap: { alignItems: 'center', position: 'absolute', right: 18, zIndex: 30 },
  fab: { alignItems: 'center', backgroundColor: colors.greenDark, borderColor: colors.white, borderRadius: 30, borderWidth: 4, boxShadow: '0 7px 15px rgba(61,90,18,.25)', height: 60, justifyContent: 'center', width: 60 },
  fabPressed: { transform: [{ scale: 0.94 }] },
  fabLabel: { backgroundColor: colors.white, borderRadius: 99, color: colors.greenDark, fontSize: 10, fontWeight: '800', marginTop: 3, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
});
