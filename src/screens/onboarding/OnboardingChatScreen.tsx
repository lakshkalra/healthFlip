import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { recommendPlan, saveGoal, saveProfile } from '../../services/api';
import { TranscriptLine } from '../../components/chat/TranscriptLine';
import { ParticleOrb } from '../../components/flip/ParticleOrb';
import { formatNumber } from '../../utils/format';
import { firstName, type OnboardingStep } from '../../components/profile/ProfileForm';
import { parseAge, parseChoice, parseHeight, parseName, parseWeight, type Parsed } from '../../features/onboarding/parseAnswers';
import type { ActivityLevel, Goal, GoalType, PlanRecommendation, Profile, Sex } from '../../types';
import { Icon, RoundIconButton, Spinner } from '../../components/ui';
import { colors } from '../../constants/theme';

type Question = 'name' | 'age' | 'height' | 'weight' | 'sex' | 'activity' | 'goal';
type Answers = { activityLevel?: ActivityLevel; age?: number; goal?: GoalType; heightCm?: number; name?: string; sex?: Sex; weightKg?: number };
type Phase = Question | 'building' | 'plan' | 'error' | 'saving';
type Message =
  | { id: string; kind: 'text'; question?: Question; role: 'flip' | 'user'; text: string }
  | { id: string; kind: 'plan'; plan: PlanRecommendation };
type Choice<T extends string> = { hint?: string; keywords: string[]; label: string; value: T };

const ORDER: Question[] = ['name', 'age', 'height', 'weight', 'sex', 'activity', 'goal'];

const SEX: Choice<Sex>[] = [
  { keywords: ['female', 'woman', 'girl', 'f$'], label: 'Female', value: 'female' },
  { keywords: ['male', 'man', 'boy', 'm$'], label: 'Male', value: 'male' },
  { keywords: ['prefer', 'skip', 'other', 'none', 'rather not'], label: 'Prefer not to say', value: 'unspecified' },
];
const ACTIVITY: Choice<ActivityLevel>[] = [
  { hint: 'desk job, little exercise', keywords: ['sit', 'sedentary', 'desk', 'mostly', 'not active', 'lazy'], label: 'Mostly sitting', value: 'sedentary' },
  { hint: 'walks or 1–2 workouts a week', keywords: ['light', 'walk', 'little'], label: 'Light activity', value: 'light' },
  { hint: 'on my feet or 3–4 workouts', keywords: ['moderate', 'gym', 'workout', 'average'], label: 'Moderately active', value: 'moderate' },
  { hint: 'daily training or physical job', keywords: ['very', 'athlete', 'daily', 'physical', 'super', 'intense'], label: 'Very active', value: 'active' },
];
const GOAL: Choice<GoalType>[] = [
  { keywords: ['lose', 'cut', 'loss', 'slim', 'fat'], label: 'Lose weight', value: 'lose' },
  { keywords: ['maintain', 'same', 'steady', 'stay', 'keep'], label: 'Maintain', value: 'maintain' },
  { keywords: ['gain', 'bulk', 'build', 'muscle', 'put on'], label: 'Gain weight', value: 'gain' },
];

function prompt(question: Question, answers: Answers, editing: boolean): string {
  const name = answers.name ? firstName(answers.name) : '';
  if (editing) {
    const label: Record<Question, string> = { activity: 'How active are you on a typical day?', age: 'How old are you?', goal: 'What’s your goal right now?', height: 'How tall are you?', name: 'What should I call you?', sex: 'Which fits you best for the calorie formula?', weight: 'What’s your current weight?' };
    return `Sure, let’s fix that. ${label[question]}`;
  }
  switch (question) {
    case 'name': return 'Hi! I’m Flip, your nutrition coach. 🌿 What should I call you?';
    case 'age': return `Nice to meet you, ${name}! How old are you?`;
    case 'height': return `How tall are you? Centimetres or feet both work, like “170 cm” or “5'7”.`;
    case 'weight': return 'And your current weight? “65 kg” or “143 lb” is fine.';
    case 'sex': return 'Which fits you best? I only use this for the calorie formula.';
    case 'activity': return 'How active are you on a typical day?';
    case 'goal': return `Last one, ${name}: what’s your goal right now?`;
  }
}

function chipsFor(question: Question): Choice<string>[] {
  if (question === 'sex') return SEX;
  if (question === 'activity') return ACTIVITY;
  if (question === 'goal') return GOAL;
  if (question === 'height') return ['155 cm', '165 cm', '175 cm'].map(label => ({ keywords: [], label, value: label }));
  return [];
}

function parseAnswer(question: Question, text: string): Parsed<Partial<Answers>> {
  const wrap = <T,>(parsed: Parsed<T>, key: keyof Answers): Parsed<Partial<Answers>> => (parsed.ok ? { ok: true, value: { [key]: parsed.value } } : parsed);
  switch (question) {
    case 'name': return wrap(parseName(text), 'name');
    case 'age': return wrap(parseAge(text), 'age');
    case 'height': return wrap(parseHeight(text), 'heightCm');
    case 'weight': return wrap(parseWeight(text), 'weightKg');
    case 'sex': return wrap(parseChoice(text, SEX), 'sex');
    case 'activity': return wrap(parseChoice(text, ACTIVITY), 'activityLevel');
    case 'goal': return wrap(parseChoice(text, GOAL), 'goal');
  }
}

const keyFor: Record<Question, keyof Answers> = { activity: 'activityLevel', age: 'age', goal: 'goal', height: 'heightCm', name: 'name', sex: 'sex', weight: 'weightKg' };

function displayAnswer(question: Question, answers: Answers): string {
  switch (question) {
    case 'age': return `${answers.age}`;
    case 'height': return `${answers.heightCm} cm`;
    case 'weight': return `${answers.weightKg} kg`;
    case 'sex': return SEX.find(choice => choice.value === answers.sex)?.label ?? '';
    case 'activity': return ACTIVITY.find(choice => choice.value === answers.activityLevel)?.label ?? '';
    case 'goal': return GOAL.find(choice => choice.value === answers.goal)?.label ?? '';
    default: return answers.name ?? '';
  }
}

type Props = {
  initialGoalType?: GoalType;
  initialProfile?: Profile | null;
  onCancel?: () => void;
  onComplete: (result: { goal: Goal; profile: Profile }) => void;
  /** Kept for the form-based API: anything after "about" starts at the goal question for returning users. */
  startAt?: OnboardingStep;
};

/** Onboarding as a chat: Flip asks one question at a time, then builds the plan in the conversation. */
export function OnboardingChatScreen({ initialProfile = null, onCancel, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const counter = useRef(0);
  const returning = !!initialProfile;
  const [answers, setAnswers] = useState<Answers>(() => (initialProfile
    ? { activityLevel: initialProfile.activityLevel, age: initialProfile.age, heightCm: initialProfile.heightCm, name: initialProfile.name, sex: initialProfile.sex, weightKg: initialProfile.weightKg }
    : {}));
  const [phase, setPhase] = useState<Phase>(returning ? 'goal' : 'name');
  const [messages, setMessages] = useState<Message[]>(() => [{
    id: 'm0',
    kind: 'text',
    role: 'flip',
    text: returning ? `Welcome back, ${firstName(initialProfile!.name)}! What’s your goal right now?` : prompt('name', {}, false),
  }]);
  const [draft, setDraft] = useState('');
  const [calories, setCalories] = useState(0);
  const [adjusting, setAdjusting] = useState(false);
  const [profileDirty, setProfileDirty] = useState(!returning);
  const [errorStep, setErrorStep] = useState<'profile' | 'plan' | 'goal'>('profile');

  const id = () => {
    counter.current += 1;
    return `m${counter.current}`;
  };
  const say = useCallback((text: string, question?: Question) => {
    counter.current += 1;
    const messageId = `m${counter.current}`;
    setMessages(current => [...current, { id: messageId, kind: 'text', question, role: 'flip', text }]);
  }, []);

  // Saves the profile (if changed), then asks the backend for a plan, which appears in the chat.
  const buildPlan = useCallback(async (next: Answers) => {
    setPhase('building');
    say('Give me a second while I build your plan…');
    const profile: Profile = { activityLevel: next.activityLevel!, age: next.age!, heightCm: next.heightCm!, name: next.name!, sex: next.sex!, weightKg: next.weightKg! };
    try {
      setErrorStep('profile');
      if (profileDirty) {
        await saveProfile(profile);
        setProfileDirty(false);
      }
      setErrorStep('plan');
      const plan = await recommendPlan(next.goal!);
      setCalories(plan.dailyCalorieTarget);
      setAdjusting(false);
      setMessages(current => [...current, { id: id(), kind: 'text', role: 'flip', text: plan.rationale }, { id: id(), kind: 'plan', plan }]);
      setPhase('plan');
    } catch {
      say('Hmm, I couldn’t reach healthFlip just now. Check your connection and tap Try again.');
      setPhase('error');
    }
  }, [profileDirty, say]);

  const answer = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text || !ORDER.includes(phase as Question)) return;
    const question = phase as Question;
    const parsed = parseAnswer(question, text);
    setDraft('');
    if (!parsed.ok) {
      setMessages(current => [...current, { id: id(), kind: 'text', role: 'user', text }]);
      say(parsed.reason);
      return;
    }
    const next = { ...answers, ...parsed.value };
    setAnswers(next);
    if (question !== 'goal') setProfileDirty(true);
    setMessages(current => [...current, { id: id(), kind: 'text', question, role: 'user', text: displayAnswer(question, next) }]);
    const missing = ORDER.find(item => next[keyFor[item]] === undefined);
    if (missing) {
      setPhase(missing);
      say(prompt(missing, next, false));
    } else {
      buildPlan(next).catch(() => undefined);
    }
  }, [answers, buildPlan, phase, say]);

  // Tapping an earlier answer re-asks just that question; later answers are kept.
  const edit = (question: Question) => {
    if (phase === 'building' || phase === 'saving') return;
    setAnswers(current => ({ ...current, [keyFor[question]]: undefined }));
    setPhase(question);
    say(prompt(question, answers, true));
  };

  const plan = [...messages].reverse().find((message): message is Extract<Message, { kind: 'plan' }> => message.kind === 'plan')?.plan;

  const start = async () => {
    if (!plan) return;
    setPhase('saving');
    const scale = calories / plan.dailyCalorieTarget;
    try {
      setErrorStep('goal');
      const goal = await saveGoal({
        carbsTargetGrams: Math.round(plan.carbsGrams * scale),
        dailyCalorieTarget: calories,
        dailyStepsTarget: plan.dailySteps,
        fatTargetGrams: Math.round(plan.fatGrams * scale),
        planRationale: plan.rationale,
        proteinTargetGrams: Math.round(plan.proteinGrams * scale),
        type: answers.goal!,
      });
      onComplete({ goal, profile: { activityLevel: answers.activityLevel!, age: answers.age!, heightCm: answers.heightCm!, name: answers.name!, sex: answers.sex!, weightKg: answers.weightKg! } });
    } catch {
      say('I couldn’t save your plan. Tap Try again.');
      setPhase('error');
    }
  };

  const retry = () => {
    if (errorStep === 'goal') start().catch(() => undefined);
    else buildPlan(answers).catch(() => undefined);
  };

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages, adjusting]);

  const asking = ORDER.includes(phase as Question);
  const chips: { label: string; onPress: () => void }[] = asking
    ? chipsFor(phase as Question).map(choice => ({ label: choice.label, onPress: () => answer(choice.label) }))
    : phase === 'plan'
      ? [
        { label: 'Start with this plan', onPress: () => { start().catch(() => undefined); } },
        { label: adjusting ? 'Done adjusting' : 'Adjust calories', onPress: () => setAdjusting(current => !current) },
        { label: 'Change an answer', onPress: () => say('Sure! Tap any of your answers above to change it.') },
      ]
      : phase === 'error'
        ? [{ label: 'Try again', onPress: retry }]
        : [];
  const lastId = messages[messages.length - 1]?.id;
  const progress = asking ? ORDER.indexOf(phase as Question) + 1 : ORDER.length;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {onCancel ? <RoundIconButton name="arrowLeft" label="Back" iconSize={20} stroke={2.6} onPress={onCancel} /> : <View style={styles.spacer44} />}
        <View style={styles.headerCenter}>
          <View style={styles.orb}><ParticleOrb width={34} height={34} mini /></View>
          <View>
            <Text style={styles.title}>Flip</Text>
            <Text style={styles.subtitle}>{asking ? `Getting to know you · ${progress} of ${ORDER.length}` : 'Your plan'}</Text>
          </View>
        </View>
        <View style={styles.spacer44} />
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.transcript} keyboardShouldPersistTaps="handled">
        {messages.map(message => {
          if (message.kind === 'plan') {
            return <PlanCard key={message.id} plan={message.plan} calories={calories} adjusting={adjusting && message.plan === plan} onAdjust={delta => setCalories(current => Math.min(6000, Math.max(800, current + delta)))} />;
          }
          const line = <TranscriptLine key={message.id} animate={message.id === lastId} role={message.role} text={message.text} />;
          if (message.role === 'user' && message.question) {
            const question = message.question;
            return (
              <Pressable key={message.id} accessibilityRole="button" accessibilityLabel={`Change answer: ${message.text}`} onPress={() => edit(question)} style={styles.editable}>
                {line}
              </Pressable>
            );
          }
          return line;
        })}
        {phase === 'building' || phase === 'saving' ? <View style={styles.thinking}><Spinner color={colors.greenDark} /></View> : null}
      </ScrollView>

      {chips.length ? (
        <View style={styles.chips}>
          {chips.map(chip => (
            <Pressable key={chip.label} accessibilityRole="button" onPress={chip.onPress} style={({ pressed }) => [styles.chip, chip.label === 'Start with this plan' && styles.chipPrimary, pressed && styles.chipPressed]}>
              <Text style={[styles.chipText, chip.label === 'Start with this plan' && styles.chipTextPrimary]}>{chip.label}</Text>
              {asking && phase === 'activity' ? <Text style={styles.chipHint}>{ACTIVITY.find(choice => choice.label === chip.label)?.hint}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          accessibilityLabel="Your answer"
          value={draft}
          onChangeText={setDraft}
          editable={asking}
          placeholder={asking ? 'Type your answer…' : 'Use the options above'}
          placeholderTextColor={colors.faint}
          returnKeyType="send"
          onSubmitEditing={() => answer(draft)}
          keyboardType={phase === 'age' ? 'number-pad' : 'default'}
          autoCapitalize={phase === 'name' ? 'words' : 'none'}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Send answer" disabled={!asking || !draft.trim()} onPress={() => answer(draft)} style={[styles.send, (!asking || !draft.trim()) && styles.sendDisabled]}>
          <Icon name="arrowRight" color={colors.limeBright} size={20} stroke={2.6} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function PlanCard({ adjusting, calories, onAdjust, plan }: { adjusting: boolean; calories: number; onAdjust: (delta: number) => void; plan: PlanRecommendation }) {
  const kcal = adjusting || calories ? calories || plan.dailyCalorieTarget : plan.dailyCalorieTarget;
  const scale = kcal / plan.dailyCalorieTarget;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>YOUR DAILY PLAN</Text>
      <View style={styles.cardRow}>
        {adjusting ? <RoundIconButton name="minus" label="Fewer calories" bg={colors.chip} size={38} iconSize={16} stroke={2.8} onPress={() => onAdjust(-50)} /> : null}
        <Text style={styles.kcal} accessibilityLabel={`${kcal} kcal per day`}>{formatNumber(kcal)}<Text style={styles.kcalUnit}> kcal</Text></Text>
        {adjusting ? <RoundIconButton name="plus" label="More calories" bg={colors.chip} size={38} iconSize={16} stroke={2.8} onPress={() => onAdjust(50)} /> : null}
      </View>
      <View style={styles.macros}>
        <Macro label="Protein" grams={Math.round(plan.proteinGrams * scale)} color={colors.protein} bg={colors.proteinBg} />
        <Macro label="Carbs" grams={Math.round(plan.carbsGrams * scale)} color={colors.carbs} bg={colors.carbsBg} />
        <Macro label="Fat" grams={Math.round(plan.fatGrams * scale)} color={colors.fat} bg={colors.fatBg} />
      </View>
      {plan.source === 'fallback' ? <Text style={styles.note}>Standard formula while Flip’s AI is unavailable.</Text> : null}
    </View>
  );
}

function Macro({ bg, color, grams, label }: { bg: string; color: string; grams: number; label: string }) {
  return (
    <View style={[styles.macro, { backgroundColor: bg }]}>
      <Text style={[styles.macroValue, { color }]}>{grams}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  flex: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, paddingHorizontal: 16 },
  headerCenter: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  orb: { alignItems: 'center', backgroundColor: colors.selected, borderRadius: 17, height: 34, justifyContent: 'center', overflow: 'hidden', width: 34 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  spacer44: { height: 44, width: 44 },
  transcript: { flexGrow: 1, gap: 14, justifyContent: 'flex-end', paddingBottom: 12, paddingHorizontal: 22, paddingTop: 16 },
  editable: { alignSelf: 'flex-end', maxWidth: '82%' },
  thinking: { alignItems: 'flex-start', paddingVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10, paddingHorizontal: 16 },
  chip: { backgroundColor: colors.white, borderColor: '#e3e6dc', borderRadius: 18, borderWidth: 1.5, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14, paddingVertical: 7 },
  chipPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPressed: { backgroundColor: colors.selected },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  chipTextPrimary: { color: colors.white },
  chipHint: { color: colors.muted, fontSize: 11, marginTop: 1 },
  inputBar: { alignItems: 'center', backgroundColor: colors.white, borderTopColor: colors.chip, borderTopWidth: 1, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  input: { backgroundColor: colors.bg, borderRadius: 22, color: colors.ink, flex: 1, fontSize: 16, height: 44, paddingHorizontal: 16 },
  send: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  sendDisabled: { opacity: 0.35 },
  card: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 24, boxShadow: '0 8px 22px rgba(28,31,26,.08)', gap: 12, padding: 16, width: 300 },
  cardLabel: { color: colors.greenText, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  kcal: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -0.6 },
  kcalUnit: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  macros: { flexDirection: 'row', gap: 8 },
  macro: { alignItems: 'center', borderRadius: 14, flex: 1, paddingVertical: 9 },
  macroValue: { fontSize: 17, fontWeight: '800' },
  macroLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  note: { color: colors.muted2, fontSize: 12 },
});
