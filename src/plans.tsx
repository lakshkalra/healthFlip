import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deletePlan, generatePlan, getPlan, listPlans, savePlan } from './api/client';
import { formatNumber } from './meals';
import { downloadPlanPdf, pdfFileName } from './pdf';
import type { DietPlanContent, DietPlanOptions, ExercisePlanContent, ExercisePlanOptions, PlanDraft, PlanSummary, ReportSummary, SavedPlan } from './types';
import { BackHeader, Banner, Card, IconTile, InputShell, PillButton, Spinner, Toggle, colors, type IconName } from './ui';

type Kind = 'diet' | 'exercise';
type View_ =
  | { screen: 'list' }
  | { kind: Kind; screen: 'form' }
  | { draft: PlanDraft; screen: 'draft' }
  | { plan: SavedPlan; screen: 'saved' };

const KIND: Record<Kind, { body: string; icon: IconName; label: string }> = {
  diet: { body: 'Meals for 1, 3 or 7 days, built around your calories and what Flip knows you like.', icon: 'utensils', label: 'Meal plan' },
  exercise: { body: 'A weekly workout schedule for home, gym or outdoors, at your level.', icon: 'flame', label: 'Workout plan' },
};

// healthFlip focuses on meals for now, so only meal plans can be created. Saved workout plans still open.
const CREATABLE: Kind[] = ['diet'];

/** Plans tab: generate meal plans, preview, save, download as PDF. */
export function PlansScreen({ latestReport = null, newDietSignal = 0, version = 0 }: { latestReport?: ReportSummary | null; newDietSignal?: number; version?: number }) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>({ screen: 'list' });
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setListState('loading');
    try {
      setPlans(await listPlans());
      setListState('ready');
    } catch {
      setListState('error');
    }
  }, []);

  // Reloads when Flip saves a plan from a voice conversation (version bumps).
  useEffect(() => { load().catch(() => undefined); }, [load, version]);

  // "Make a meal plan from this" on a report opens a new meal plan straight away.
  useEffect(() => {
    if (newDietSignal) setView({ kind: 'diet', screen: 'form' });
  }, [newDietSignal]);

  const backToList = () => {
    setView({ screen: 'list' });
    load().catch(() => undefined);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      {view.screen === 'list' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
          <View style={styles.gap4}>
            <Text style={styles.title}>Your plans</Text>
            <Text style={styles.body}>Personal meal plans from Flip. Save them and download a PDF anytime.</Text>
          </View>
          {CREATABLE.map(kind => (
            <Pressable key={kind} accessibilityRole="button" accessibilityLabel={`New ${KIND[kind].label.toLowerCase()}`} onPress={() => setView({ kind, screen: 'form' })} style={({ pressed }) => [styles.newCard, pressed && styles.pressed]}>
              <IconTile name={KIND[kind].icon} bg={colors.limeBright} fg={colors.ink} size={46} radius={15} iconSize={22} />
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>New {KIND[kind].label.toLowerCase()}</Text>
                <Text style={styles.small}>{KIND[kind].body}</Text>
              </View>
              <IconTile name="plus" bg={colors.ink} fg={colors.limeBright} size={32} radius={16} iconSize={16} stroke={2.8} />
            </Pressable>
          ))}

          <Text style={styles.section}>Saved</Text>
          {listState === 'loading' ? <View style={styles.center}><Spinner color={colors.greenDark} /></View> : null}
          {listState === 'error' ? <Banner message="Couldn’t load your plans." onRetry={load} /> : null}
          {listState === 'ready' && !plans.length ? (
            <Card style={styles.emptyCard}><Text style={styles.body}>No saved plans yet. Create one above, or ask Flip: “Make me a 7-day vegetarian meal plan.”</Text></Card>
          ) : null}
          {listState === 'ready' ? plans.map(plan => (
            <SavedPlanRow key={plan.id} plan={plan} onOpen={opened => setView({ plan: opened, screen: 'saved' })} />
          )) : null}
        </ScrollView>
      ) : null}

      {view.screen === 'form' ? (
        <PlanForm kind={view.kind} latestReport={latestReport} onBack={backToList} onGenerated={draft => setView({ draft, screen: 'draft' })} />
      ) : null}

      {view.screen === 'draft' ? (
        <DraftView draft={view.draft} onBack={() => setView({ kind: view.draft.kind, screen: 'form' })} onSaved={plan => setView({ plan, screen: 'saved' })} />
      ) : null}

      {view.screen === 'saved' ? <SavedView plan={view.plan} onBack={backToList} /> : null}
    </View>
  );
}

function SavedPlanRow({ onOpen, plan }: { onOpen: (plan: SavedPlan) => void; plan: PlanSummary }) {
  const [state, setState] = useState<'idle' | 'opening' | 'error'>('idle');
  const open = async () => {
    setState('opening');
    try {
      onOpen(await getPlan(plan.id));
    } catch {
      setState('error');
    }
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${plan.title}`} onPress={open} style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}>
      <IconTile name={KIND[plan.kind].icon} bg={colors.pale} fg={colors.greenDark} size={40} radius={13} iconSize={19} />
      <View style={styles.grow}>
        <Text style={styles.rowTitle} numberOfLines={1}>{plan.title}</Text>
        <Text style={styles.small} numberOfLines={2}>{state === 'error' ? 'Couldn’t open this plan. Tap to retry.' : plan.summary}</Text>
        <Text style={styles.meta}>{KIND[plan.kind].label} · {new Date(plan.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
      </View>
      {state === 'opening' ? <Spinner color={colors.muted} /> : null}
    </Pressable>
  );
}

function PlanForm({ kind, latestReport, onBack, onGenerated }: { kind: Kind; latestReport: ReportSummary | null; onBack: () => void; onGenerated: (draft: PlanDraft) => void }) {
  const [useReport, setUseReport] = useState(true);
  const [diet, setDiet] = useState<DietPlanOptions>({ cuisine: 'Indian', days: 7, dietType: 'any' });
  const [exercise, setExercise] = useState<ExercisePlanOptions>({ daysPerWeek: 3, level: 'beginner', location: 'home', minutesPerSession: 30 });
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async () => {
    setState('busy');
    try {
      const trimmed = notes.trim() || undefined;
      const draft = kind === 'diet'
        ? await generatePlan({ kind, options: { ...diet, cuisine: diet.cuisine.trim() || 'Indian', notes: trimmed, ...(latestReport ? { useHealthNotes: useReport } : {}) } })
        : await generatePlan({ kind, options: { ...exercise, notes: trimmed } });
      onGenerated(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Flip couldn’t create the plan.');
      setState('error');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackHeader title={`New ${KIND[kind].label.toLowerCase()}`} onBack={onBack} />
      {kind === 'diet' ? (
        <>
          <Choice label="How many days?" options={[[1, '1 day'], [3, '3 days'], [7, '7 days']]} value={diet.days} onChange={days => setDiet(current => ({ ...current, days }))} />
          <Choice
            label="Diet"
            options={[['any', 'Anything'], ['vegetarian', 'Veg'], ['eggetarian', 'Egg'], ['non-vegetarian', 'Non-veg'], ['vegan', 'Vegan']]}
            value={diet.dietType}
            onChange={dietType => setDiet(current => ({ ...current, dietType }))}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Cuisine</Text>
            <InputShell style={styles.shell}>
              <TextInput accessibilityLabel="Cuisine" value={diet.cuisine} onChangeText={cuisine => setDiet(current => ({ ...current, cuisine }))} maxLength={40} placeholder="Indian" placeholderTextColor={colors.faint} style={styles.input} />
            </InputShell>
          </View>
          {latestReport ? (
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: useReport }} accessibilityLabel="Use my latest lab report" onPress={() => setUseReport(on => !on)} style={[styles.reportToggle, useReport && styles.reportToggleOn]}>
              <IconTile name="chart" bg={useReport ? colors.limeBright : colors.chip} fg={colors.greenDark} size={34} radius={11} iconSize={16} />
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>Use my latest report</Text>
                <Text style={styles.small}>{latestReport.title}{latestReport.reportDate ? ` · ${new Date(`${latestReport.reportDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}. Flip shapes meals around it.</Text>
              </View>
              <Toggle on={useReport} />
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <Choice label="Workouts per week" options={[[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]} value={exercise.daysPerWeek} onChange={daysPerWeek => setExercise(current => ({ ...current, daysPerWeek }))} />
          <Choice label="Where?" options={[['home', 'Home'], ['gym', 'Gym'], ['outdoors', 'Outdoors']]} value={exercise.location} onChange={location => setExercise(current => ({ ...current, location }))} />
          <Choice label="Level" options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} value={exercise.level} onChange={level => setExercise(current => ({ ...current, level }))} />
          <Choice label="Minutes per session" options={[[15, '15'], [30, '30'], [45, '45'], [60, '60']]} value={exercise.minutesPerSession} onChange={minutesPerSession => setExercise(current => ({ ...current, minutesPerSession }))} />
        </>
      )}
      <View style={styles.field}>
        <Text style={styles.label}>Anything else? (optional)</Text>
        <InputShell style={styles.notesShell}>
          <TextInput accessibilityLabel="Notes for Flip" value={notes} onChangeText={setNotes} maxLength={200} multiline placeholder={kind === 'diet' ? 'e.g. quick breakfasts, no mushrooms' : 'e.g. go easy on my knees'} placeholderTextColor={colors.faint} style={[styles.input, styles.notesInput]} />
        </InputShell>
        <Text style={styles.small}>Flip also uses your profile and what it remembers about you.</Text>
      </View>
      {state === 'error' ? <Banner icon message={error} /> : null}
      <PillButton title={state === 'error' ? 'Try again' : 'Create my plan'} glow busy={state === 'busy'} busyLabel="Flip is writing your plan…" onPress={submit} />
      {state === 'busy' ? <Text style={[styles.small, styles.centerText]}>A full week can take 10–20 seconds.</Text> : null}
    </ScrollView>
  );
}

function Choice<T extends string | number>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: [T, string][]; value: T }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segment}>
        {options.map(([option, text]) => (
          <Pressable key={String(option)} accessibilityRole="radio" accessibilityState={{ selected: option === value }} onPress={() => onChange(option)} style={[styles.segmentItem, option === value && styles.segmentOn]}>
            <Text style={[styles.segmentText, option === value && styles.segmentTextOn]}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DraftView({ draft, onBack, onSaved }: { draft: PlanDraft; onBack: () => void; onSaved: (plan: SavedPlan) => void }) {
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const save = async () => {
    setState('saving');
    try {
      onSaved(await savePlan(draft));
    } catch {
      setState('error');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BackHeader title="Preview" onBack={onBack} />
      <PlanBody plan={draft} />
      {state === 'error' ? <Banner icon message="Couldn’t save the plan. Check your connection and try again." /> : null}
      <PillButton title={state === 'error' ? 'Retry save' : 'Save plan'} icon="check" glow busy={state === 'saving'} busyLabel="Saving…" onPress={save} />
      <PillButton title="Change options" variant="muted" height={48} onPress={onBack} />
    </ScrollView>
  );
}

function SavedView({ onBack, plan }: { onBack: () => void; plan: SavedPlan }) {
  const [pdf, setPdf] = useState<'idle' | 'busy' | 'error'>('idle');
  const [pdfError, setPdfError] = useState('');
  const [deleting, setDeleting] = useState<'idle' | 'confirm' | 'busy' | 'error'>('idle');

  const download = async () => {
    setPdf('busy');
    try {
      await downloadPlanPdf(plan.id, pdfFileName(plan.title));
      setPdf('idle');
    } catch (caught) {
      setPdfError(caught instanceof Error ? caught.message : 'The PDF could not be downloaded.');
      setPdf('error');
    }
  };

  const remove = async () => {
    if (deleting !== 'confirm') return setDeleting('confirm');
    setDeleting('busy');
    try {
      await deletePlan(plan.id);
      onBack();
    } catch {
      setDeleting('error');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BackHeader title="Saved plan" onBack={onBack} />
      <PlanBody plan={plan} />
      {pdf === 'error' ? <Banner icon message={pdfError} /> : null}
      <PillButton title="Download PDF" icon="arrowRight" glow busy={pdf === 'busy'} busyLabel="Preparing PDF…" onPress={download} />
      {deleting === 'error' ? <Banner message="Couldn’t delete this plan." /> : null}
      <PillButton title={deleting === 'confirm' ? 'Tap again to delete' : 'Delete plan'} variant="light" height={48} busy={deleting === 'busy'} busyLabel="Deleting…" onPress={remove} />
    </ScrollView>
  );
}

function PlanBody({ plan }: { plan: PlanDraft }) {
  const { content, source } = plan;
  return (
    <>
      <View style={styles.gap6}>
        <Text style={styles.planTitle}>{content.title}</Text>
        <Text style={styles.body}>{content.summary}</Text>
        {source === 'fallback' ? <Text style={styles.meta}>Standard template while Flip’s AI is unavailable. Adjust portions to suit you.</Text> : null}
      </View>
      {plan.kind === 'diet' ? <DietDays content={plan.content} /> : <ExerciseDays content={plan.content} />}
      {content.tips.length ? (
        <Card style={styles.tips}>
          <Text style={styles.cardTitle}>Tips</Text>
          {content.tips.map(tip => <Text key={tip} style={styles.body14}>•  {tip}</Text>)}
        </Card>
      ) : null}
      <Text style={styles.meta}>General wellness guidance, not medical advice.</Text>
    </>
  );
}

function DietDays({ content }: { content: DietPlanContent }) {
  return (
    <>
      <View style={styles.targets}>
        <Target label="kcal / day" value={formatNumber(content.dailyCalories)} />
        <Target label="protein" value={`${content.macros.proteinGrams}g`} />
        <Target label="carbs" value={`${content.macros.carbsGrams}g`} />
        <Target label="fat" value={`${content.macros.fatGrams}g`} />
      </View>
      {content.days.map(day => (
        <Card key={day.label} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <Text style={styles.cardTitle}>{day.label}</Text>
            <Text style={styles.meta}>{formatNumber(day.meals.reduce((sum, meal) => sum + meal.calories, 0))} kcal</Text>
          </View>
          {day.meals.map((meal, index) => (
            <View key={`${meal.type}-${index}`} style={[styles.mealRow, index > 0 && styles.divider]}>
              <View style={styles.grow}>
                <Text style={styles.mealType}>{meal.type.toUpperCase()}</Text>
                <Text style={styles.rowTitle}>{meal.name}</Text>
                <Text style={styles.small}>{meal.portion}</Text>
              </View>
              <View style={styles.mealNumbers}>
                <Text style={styles.rowTitle}>{meal.calories}</Text>
                <Text style={styles.meta}>kcal · {Math.round(meal.proteinGrams)}g P</Text>
              </View>
            </View>
          ))}
        </Card>
      ))}
    </>
  );
}

function ExerciseDays({ content }: { content: ExercisePlanContent }) {
  return (
    <>
      {content.days.map(day => (
        <Card key={day.label} style={[styles.dayCard, day.rest && styles.restCard]}>
          <View style={styles.dayHeader}>
            <Text style={styles.cardTitle}>{day.label}</Text>
            <Text style={styles.meta}>{day.rest ? 'Rest day' : `${day.durationMinutes} min`}</Text>
          </View>
          <Text style={[styles.focus, day.rest && styles.restText]}>{day.focus}</Text>
          {day.exercises.map((exercise, index) => (
            <View key={`${exercise.name}-${index}`} style={styles.exerciseRow}>
              <Text style={[styles.body14, styles.grow]}>•  {exercise.name}</Text>
              <Text style={styles.meta}>{exercise.detail}</Text>
            </View>
          ))}
        </Card>
      ))}
    </>
  );
}

function Target({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.target}>
      <Text style={styles.targetValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  content: { gap: 14, paddingBottom: 40, paddingHorizontal: 20, paddingTop: 4 },
  grow: { flex: 1 },
  reportToggle: { alignItems: 'center', backgroundColor: colors.white, borderColor: 'transparent', borderRadius: 18, borderWidth: 2, flexDirection: 'row', gap: 12, padding: 12 },
  reportToggleOn: { backgroundColor: colors.selected, borderColor: colors.green },
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  center: { alignItems: 'center', paddingVertical: 16 },
  centerText: { textAlign: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  planTitle: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  body14: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.muted2, fontSize: 12, fontWeight: '600' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  newCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 22, flexDirection: 'row', gap: 14, padding: 16 },
  savedRow: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, flexDirection: 'row', gap: 12, padding: 14 },
  emptyCard: { padding: 16 },
  field: { gap: 8 },
  shell: { height: 50, justifyContent: 'center', paddingHorizontal: 14 },
  notesShell: { minHeight: 80, paddingHorizontal: 14, paddingVertical: 10 },
  input: { color: colors.ink, fontSize: 16, fontWeight: '600', padding: 0 },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  segment: { backgroundColor: colors.chip, borderRadius: 16, flexDirection: 'row', gap: 4, padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 4 },
  segmentOn: { backgroundColor: colors.white, boxShadow: '0 2px 8px rgba(28,31,26,.08)' },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  segmentTextOn: { color: colors.ink },
  targets: { flexDirection: 'row', gap: 8 },
  target: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, flex: 1, gap: 2, paddingVertical: 12 },
  targetValue: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  dayCard: { gap: 8, padding: 16 },
  restCard: { backgroundColor: colors.selected },
  dayHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  mealRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  divider: { borderTopColor: colors.chip, borderTopWidth: 1 },
  mealType: { color: colors.greenText, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  mealNumbers: { alignItems: 'flex-end' },
  focus: { color: colors.greenDark, fontSize: 14, fontWeight: '700' },
  restText: { color: colors.muted },
  exerciseRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  tips: { gap: 6, padding: 16 },
});
