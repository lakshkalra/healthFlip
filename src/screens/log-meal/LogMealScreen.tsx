import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AiMealEstimate, createMeal, estimateMeal, estimateMealFromImage, saveFood } from '../../services/api';
import { TranscriptLine } from '../../components/chat/TranscriptLine';
import { ParticleOrb } from '../../components/flip/ParticleOrb';
import { chooseMealImage, type MealImage } from '../../services/media/picker';
import { confirmedName, itemSummary, scaled, stepGrams, toCheckItems, totalsOf, type CheckItem, type Totals } from '../../features/meals/mealItems';
import { MEAL_TYPES, type MealType, mealTypeLabel } from '../../features/meals/meals';
import { formatNumber } from '../../utils/format';
import { Icon, RoundIconButton, Spinner } from '../../components/ui';
import { colors } from '../../constants/theme';

type Source = 'manual' | 'photo';
type Phase = 'ask' | 'busy' | 'review' | 'correct' | 'logging' | 'logged' | 'error';
type Message =
  | { id: string; kind: 'text'; role: 'flip' | 'user'; text: string }
  | { id: string; kind: 'photo'; uri: string }
  | { id: string; kind: 'estimate'; estimate: AiMealEstimate; logged: boolean };
type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, 'id'> : never) : never;
// What the current estimate came from, so "Not quite" and "Try again" can redo it.
type Request = { description: string; kind: 'text' } | { image: MealImage; kind: 'photo' };

type AssistantScreenProps = {
  /** Sent as the first message, e.g. a food search that found nothing in "Pick from list". */
  initialQuery?: string;
  initialType: MealType;
  remainingCalories: number | null;
  userName?: string;
  /** Closes the chat; `logged` is how many meals were added while it was open. */
  onClose: (logged: number) => void;
  onMealLogged: () => void;
  onOpenLiveVoice: () => void;
  onPickFromList: (type: MealType) => void;
};

/** Add-meal chat: Flip asks what you ate, you answer by text, photo or voice, then confirm the estimate. */
export function LogMealScreen({ initialQuery, initialType, remainingCalories, userName, onClose, onMealLogged, onOpenLiveVoice, onPickFromList }: AssistantScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const counter = useRef(0);
  const nextId = () => `m${(counter.current += 1)}`;
  const [mealType, setMealType] = useState<MealType>(initialType);
  const [messages, setMessages] = useState<Message[]>(() => [
    initialQuery
      ? { id: 'hello', kind: 'text', role: 'flip', text: `Couldn’t find that in the list, so let me estimate it for you.` }
      : { id: 'hello', kind: 'text', role: 'flip', text: `Hey${userName ? ` ${userName}` : ''}! What did you have for ${mealTypeLabel(initialType).toLowerCase()}? Type it, snap a photo, or tap the mic to tell me.` },
  ]);
  const [phase, setPhase] = useState<Phase>('ask');
  const [draft, setDraft] = useState('');
  const [request, setRequest] = useState<Request | null>(null);
  const [current, setCurrent] = useState<{ estimate: AiMealEstimate; id: string; source: Source } | null>(null);
  const [remaining, setRemaining] = useState(remainingCalories);
  const [logged, setLogged] = useState(0);
  // Item checklists by estimate message id; only the current (unlogged) one is editable.
  const [checklists, setChecklists] = useState<Record<string, CheckItem[]>>({});
  const items = current ? checklists[current.id] ?? [] : [];
  const hasItems = items.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages, phase]);

  // A handed-over search is sent once, as if the user had typed it.
  const seeded = useRef(false);
  useEffect(() => {
    if (!initialQuery || seeded.current) return;
    seeded.current = true;
    setMessages(list => [...list, { id: 'seed', kind: 'text', role: 'user', text: initialQuery }]);
    run({ description: initialQuery, kind: 'text' }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const add = (...entries: NewMessage[]) => setMessages(list => [...list, ...entries.map(entry => ({ ...entry, id: nextId() }) as Message)]);
  const say = (text: string) => add({ kind: 'text', role: 'flip', text });

  async function run(next: Request) {
    setRequest(next);
    setPhase('busy');
    try {
      const estimate = next.kind === 'text'
        ? await estimateMeal(next.description, mealType)
        : await estimateMealFromImage(next.image.base64, next.image.mimeType, mealType);
      const id = nextId();
      const found = estimate.items ?? [];
      setCurrent({ estimate, id, source: next.kind === 'photo' ? 'photo' : 'manual' });
      if (found.length) setChecklists(lists => ({ ...lists, [id]: toCheckItems(found, id) }));
      const lead = next.kind === 'photo' ? 'Here’s what I see' : 'Here’s my estimate';
      setMessages(list => [
        ...list,
        { id: nextId(), kind: 'text', role: 'flip', text: found.length ? `${lead}. Untick anything that isn’t there, adjust the weights, or tell me anything I missed.` : `${lead}. Does this look right?` },
        { estimate, id, kind: 'estimate', logged: false },
      ]);
      setPhase('review');
    } catch (error) {
      say(errorMessage(error, next.kind === 'photo' ? 'I couldn’t read that photo. Try another one, or just tell me what it was.' : 'I couldn’t estimate that right now. Want to try again?'));
      setPhase('error');
    }
  }

  function send() {
    const text = draft.trim();
    if (!text || phase === 'busy' || phase === 'logging') return;
    setDraft('');
    add({ kind: 'text', role: 'user', text });
    // While reviewing an itemised estimate, a typed reply is something Flip missed.
    if (phase === 'review' && current && hasItems) {
      addMissing(current.id, text).catch(() => undefined);
      return;
    }
    // Otherwise it is a correction to the estimate on screen.
    if ((phase === 'correct' || phase === 'review') && current && request) {
      const base = request.kind === 'text' ? request.description : `${current.estimate.name} (from a photo)`;
      run({ description: `${base}. Correction: ${text}`, kind: 'text' });
      return;
    }
    run({ description: text, kind: 'text' });
  }

  async function addMissing(id: string, text: string) {
    setPhase('busy');
    try {
      const estimate = await estimateMeal(text, mealType);
      const found = estimate.items?.length ? estimate.items : [{ caloriesKcal: estimate.caloriesKcal, carbsGrams: estimate.carbsGrams, fatGrams: estimate.fatGrams, grams: 100, name: estimate.name, proteinGrams: estimate.proteinGrams }];
      setChecklists(lists => ({ ...lists, [id]: [...(lists[id] ?? []), ...toCheckItems(found, nextId(), true)] }));
      say(`Added ${found.map(item => item.name).join(', ')}. Anything else? Tap Log it when the list looks right.`);
    } catch (error) {
      say(errorMessage(error, 'I couldn’t add that right now. Try again, or adjust the list and log it.'));
    } finally {
      setPhase('review');
    }
  }

  function updateItem(key: string, change: (item: CheckItem) => CheckItem) {
    if (!current) return;
    const id = current.id;
    setChecklists(lists => ({ ...lists, [id]: (lists[id] ?? []).map(item => (item.key === key ? change(item) : item)) }));
  }

  async function sendPhoto(source: 'camera' | 'library') {
    if (phase === 'busy' || phase === 'logging') return;
    try {
      const image = await chooseMealImage(source);
      if (!image) return;
      add({ kind: 'photo', uri: image.uri });
      run({ image, kind: 'photo' });
    } catch (error) {
      say(errorMessage(error, 'That photo couldn’t be opened. Try another one, or just tell me what it was.'));
      setPhase('error');
    }
  }

  async function logIt() {
    if (!current || phase === 'logging') return;
    const { estimate, id, source } = current;
    if (hasItems && !items.some(item => item.checked)) {
      say('Tick at least one item, or tell me what you had.');
      return;
    }
    // An itemised meal logs exactly what was ticked, at the confirmed weights.
    const totals: Totals = hasItems ? totalsOf(items) : estimate;
    const name = hasItems ? confirmedName(estimate.name, items) : estimate.name;
    const summary = hasItems ? itemSummary(items) : '';
    setPhase('logging');
    try {
      await createMeal({
        caloriesKcal: totals.caloriesKcal,
        carbsGrams: totals.carbsGrams ?? undefined,
        fatGrams: totals.fatGrams ?? undefined,
        mealType,
        name,
        note: summary ? `Items: ${summary}` : 'Estimated with Flip. Review the portion if needed.',
        proteinGrams: totals.proteinGrams ?? undefined,
        source,
      });
      // Confirmed meals become "Pick from list" options; this never blocks logging.
      saveFood({ ...totals, name, serving: summary || '1 serving' }).catch(() => undefined);
      const left = remaining === null ? null : remaining - totals.caloriesKcal;
      setRemaining(left);
      setLogged(count => count + 1);
      setCurrent(null);
      setMessages(list => list.map(item => (item.id === id && item.kind === 'estimate' ? { ...item, logged: true } : item)));
      say(left === null ? 'Logged! Anything else?' : left >= 0 ? `Logged! ${formatNumber(left)} kcal left today. Anything else?` : `Logged! You’re ${formatNumber(-left)} kcal over today, and that’s okay. Anything else?`);
      setPhase('logged');
      onMealLogged();
    } catch (error) {
      say(errorMessage(error, 'I couldn’t save that meal right now. Your estimate is still here, so try again in a moment.'));
      setPhase('review');
    }
  }

  function pickType(type: MealType) {
    setMealType(type);
    if (phase === 'ask' && type !== mealType) say(`Got it, ${mealTypeLabel(type).toLowerCase()}. What did you have?`);
  }

  const chip = (label: string, onPress: () => void, primary = false) => ({ label, onPress, primary });
  const pickFromList = chip('Pick from list', () => onPickFromList(mealType));
  const chips = phase === 'review'
    ? [
      chip('Log it', () => { logIt().catch(() => undefined); }, true),
      hasItems
        ? chip('Add an item', () => say('What did I miss? Just type it, like “a glass of lassi”.'))
        : chip('Not quite', () => { say('No problem! What should I change? For example “it was 2 rotis” or “half a bowl”.'); setPhase('correct'); }),
      pickFromList,
    ]
    : phase === 'logged'
      ? [chip('Done', () => onClose(logged), true), chip('Add another', () => { setRequest(null); say('What else did you have?'); setPhase('ask'); })]
      : phase === 'error'
        ? [...(request ? [chip('Try again', () => { run(request).catch(() => undefined); }, true)] : []), pickFromList]
        : phase === 'ask'
          ? [pickFromList]
          : [];
  const lastId = messages[messages.length - 1]?.id;
  const busy = phase === 'busy' || phase === 'logging';
  const canType = !busy;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <RoundIconButton name="arrowLeft" label="Back from Flip" iconSize={20} stroke={2.6} onPress={() => onClose(logged)} />
        <View style={styles.headerCenter}>
          <View style={styles.orb}><ParticleOrb width={34} height={34} mini /></View>
          <View>
            <Text style={styles.title}>Log a meal</Text>
            <Text style={styles.subtitle}>with Flip · your food companion</Text>
          </View>
        </View>
        <View style={styles.spacer44} />
      </View>

      <View style={styles.types}>
        {MEAL_TYPES.map(({ id, label }) => {
          const on = id === mealType;
          return (
            <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => pickType(id)} style={[styles.type, on && styles.typeOn]}>
              <Text style={[styles.typeText, on && styles.typeTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.transcript} keyboardShouldPersistTaps="handled">
        {messages.map(message => {
          if (message.kind === 'photo') return <Image key={message.id} source={{ uri: message.uri }} accessibilityLabel="Your meal photo" style={styles.photo} />;
          if (message.kind === 'estimate') {
            const editable = current?.id === message.id && !message.logged;
            return <EstimateCard key={message.id} estimate={message.estimate} items={checklists[message.id] ?? []} logged={message.logged} onChange={editable ? updateItem : undefined} />;
          }
          return <TranscriptLine key={message.id} animate={message.id === lastId} role={message.role} text={message.text} />;
        })}
        {busy ? <View style={styles.thinking}><Spinner color={colors.greenDark} /><Text style={styles.thinkingText}>{phase === 'logging' ? 'Logging…' : 'Flip is thinking…'}</Text></View> : null}
      </ScrollView>

      {chips.length ? (
        <View style={styles.chips}>
          {chips.map(item => (
            <Pressable key={item.label} accessibilityRole="button" onPress={item.onPress} style={({ pressed }) => [styles.chip, item.primary && styles.chipPrimary, pressed && styles.chipPressed]}>
              <Text style={[styles.chipText, item.primary && styles.chipTextPrimary]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <RoundIconButton name="camera" label="Take a meal photo" bg={colors.bg} size={42} iconSize={19} onPress={() => { sendPhoto('camera').catch(() => undefined); }} />
        <RoundIconButton name="image" label="Choose a meal photo" bg={colors.bg} size={42} iconSize={19} onPress={() => { sendPhoto('library').catch(() => undefined); }} />
        <TextInput
          accessibilityLabel="Message Flip"
          value={draft}
          onChangeText={setDraft}
          editable={canType}
          placeholder={phase === 'review' && hasItems ? 'Anything I missed?' : phase === 'correct' || phase === 'review' ? 'What should I change?' : 'e.g. 2 rotis and dal'}
          placeholderTextColor={colors.faint}
          returnKeyType="send"
          onSubmitEditing={send}
          style={styles.input}
        />
        {draft.trim() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!canType} onPress={send} style={[styles.send, !canType && styles.disabled]}>
            <Icon name="arrowRight" color={colors.limeBright} size={20} stroke={2.6} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Talk to Flip" onPress={onOpenLiveVoice} style={styles.send}>
            <Icon name="mic" color={colors.limeBright} size={20} stroke={2.4} />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function EstimateCard({ estimate, items, logged, onChange }: { estimate: AiMealEstimate; items: CheckItem[]; logged: boolean; onChange?: (key: string, change: (item: CheckItem) => CheckItem) => void }) {
  const totals: Totals = items.length ? totalsOf(items) : estimate;
  const name = items.length ? confirmedName(estimate.name, items) : estimate.name;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.grow}>
          <Text style={styles.cardName}>{name}</Text>
          <Text style={styles.cardMeta}>{estimate.confidence} confidence · {estimate.source === 'fallback' ? 'rough local estimate' : 'AI estimate'}</Text>
        </View>
        <Text style={styles.cardKcal} accessible accessibilityLabel={`${totals.caloriesKcal} kcal in total`}>{formatNumber(totals.caloriesKcal)} kcal</Text>
      </View>
      <Text style={styles.cardMacros}>Protein {totals.proteinGrams ?? '—'}g · Carbs {totals.carbsGrams ?? '—'}g · Fat {totals.fatGrams ?? '—'}g</Text>
      {estimate.healthTip ? (
        <View style={styles.tip}>
          <Icon name="leaf" size={14} color={colors.greenDark} />
          <Text style={styles.tipText}>{estimate.healthTip}</Text>
        </View>
      ) : null}
      {items.length ? (
        <View style={styles.items}>
          {items.map(item => <ItemRow key={item.key} item={item} onChange={onChange} />)}
        </View>
      ) : estimate.assumptions.length ? (
        <View style={styles.assumptions}>
          {estimate.assumptions.slice(0, 3).map((assumption, index) => <Text key={index} style={styles.assumption}>• {assumption}</Text>)}
        </View>
      ) : null}
      {logged ? (
        <View style={styles.loggedRow}>
          <Icon name="check" size={14} color={colors.greenDark} stroke={3} />
          <Text style={styles.loggedText}>Added to today</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One checklist row: tick on/off, approximate weight with ±10 g, and its calories at that weight. */
function ItemRow({ item, onChange }: { item: CheckItem; onChange?: (key: string, change: (item: CheckItem) => CheckItem) => void }) {
  const { name } = item.original;
  const kcal = scaled(item).caloriesKcal;
  const off = !item.checked;
  return (
    <View style={styles.itemRow}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.checked, disabled: !onChange }} accessibilityLabel={name} disabled={!onChange} hitSlop={6} onPress={() => onChange?.(item.key, current => ({ ...current, checked: !current.checked }))} style={styles.itemCheck}>
        <View style={[styles.box, item.checked && styles.boxOn]}>
          {item.checked ? <Icon name="check" size={13} color={colors.white} stroke={3.2} /> : null}
        </View>
        <Text style={[styles.itemName, off && styles.itemOff]} numberOfLines={2}>{name}</Text>
      </Pressable>
      {onChange && item.checked ? (
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Less ${name}`} hitSlop={6} onPress={() => onChange(item.key, current => ({ ...current, grams: stepGrams(current.grams, -10) }))} style={styles.stepButton}>
            <Icon name="minus" size={13} stroke={2.8} />
          </Pressable>
          <Text style={styles.grams}>~{item.grams} g</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`More ${name}`} hitSlop={6} onPress={() => onChange(item.key, current => ({ ...current, grams: stepGrams(current.grams, 10) }))} style={styles.stepButton}>
            <Icon name="plus" size={13} stroke={2.8} />
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.grams, off && styles.itemOff]}>~{item.grams} g</Text>
      )}
      <Text style={[styles.itemKcal, off && styles.itemOff]}>{kcal} kcal</Text>
    </View>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  flex: { flex: 1 },
  grow: { flex: 1, gap: 2, minWidth: 0 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, paddingHorizontal: 16 },
  headerCenter: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  orb: { alignItems: 'center', backgroundColor: colors.selected, borderRadius: 17, height: 34, justifyContent: 'center', overflow: 'hidden', width: 34 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  spacer44: { height: 44, width: 44 },
  types: { backgroundColor: colors.chip, borderRadius: 16, flexDirection: 'row', gap: 4, marginHorizontal: 16, padding: 4 },
  type: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 36 },
  typeOn: { backgroundColor: colors.white, boxShadow: '0 2px 8px rgba(28,31,26,.08)' },
  typeText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  typeTextOn: { color: colors.ink },
  transcript: { flexGrow: 1, gap: 14, justifyContent: 'flex-end', paddingBottom: 12, paddingHorizontal: 22, paddingTop: 16 },
  photo: { alignSelf: 'flex-end', borderRadius: 20, height: 150, width: 200 },
  thinking: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 4 },
  thinkingText: { color: colors.muted2, fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10, paddingHorizontal: 16 },
  chip: { backgroundColor: colors.white, borderColor: '#e3e6dc', borderRadius: 18, borderWidth: 1.5, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14, paddingVertical: 7 },
  chipPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPressed: { backgroundColor: colors.selected },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  chipTextPrimary: { color: colors.white },
  inputBar: { alignItems: 'center', backgroundColor: colors.white, borderTopColor: colors.chip, borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  input: { backgroundColor: colors.bg, borderColor: colors.chip, borderRadius: 22, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 16, height: 44, paddingHorizontal: 16 },
  send: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  disabled: { opacity: 0.35 },
  card: { alignSelf: 'stretch', backgroundColor: colors.white, borderRadius: 24, boxShadow: '0 8px 22px rgba(28,31,26,.08)', gap: 10, padding: 16 },
  tip: { alignItems: 'flex-start', backgroundColor: colors.pale, borderRadius: 12, flexDirection: 'row', gap: 8, padding: 10 },
  tipText: { color: colors.greenDark, flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  items: { borderTopColor: colors.chip, borderTopWidth: 1, gap: 2, paddingTop: 6 },
  itemRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 40 },
  itemCheck: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0 },
  box: { alignItems: 'center', borderColor: colors.ring, borderRadius: 7, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  itemName: { color: colors.ink, flexShrink: 1, fontSize: 14, fontWeight: '700' },
  itemOff: { color: colors.faint, textDecorationLine: 'line-through' },
  stepper: { alignItems: 'center', backgroundColor: colors.bg, borderRadius: 14, flexDirection: 'row', gap: 2, padding: 2 },
  stepButton: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, height: 26, justifyContent: 'center', width: 26 },
  grams: { color: colors.muted, fontSize: 12, fontWeight: '700', minWidth: 46, textAlign: 'center' },
  itemKcal: { color: colors.ink, fontSize: 13, fontWeight: '700', minWidth: 58, textAlign: 'right' },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  cardName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: colors.muted2, fontSize: 11 },
  cardKcal: { color: colors.greenDark, fontSize: 18, fontWeight: '800' },
  cardMacros: { color: colors.muted, fontSize: 13 },
  assumptions: { backgroundColor: colors.bg, borderRadius: 12, gap: 3, padding: 10 },
  assumption: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  loggedRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  loggedText: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
});
