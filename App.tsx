import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  createMeal,
  deleteMeal,
  getCurrentGoal,
  getDashboard,
  saveGoal,
  updateMeal,
  type MealInput,
} from './src/api/client';
import type { Dashboard, GoalType, Meal } from './src/types';

type Screen = 'dashboard' | 'meal' | 'detail';

function App() {
  const [goal, setGoal] = useState<{ dailyCalorieTarget: number; type: GoalType } | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    try {
      setError(null);
      const currentGoal = await getCurrentGoal();
      setGoal(currentGoal ? { dailyCalorieTarget: currentGoal.dailyCalorieTarget, type: currentGoal.type } : null);
      if (currentGoal) setDashboard(await getDashboard());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      setError(null);
      setDashboard(await getDashboard());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleGoalSaved(nextGoal: { dailyCalorieTarget: number; type: GoalType }) {
    try {
      setLoading(true);
      setError(null);
      const saved = await saveGoal(nextGoal);
      setGoal({ dailyCalorieTarget: saved.dailyCalorieTarget, type: saved.type });
      setDashboard(await getDashboard());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleMealSaved() {
    setScreen('dashboard');
    await refresh();
  }

  async function handleMealDeleted() {
    if (!selectedMeal) return;
    try {
      setLoading(true);
      await deleteMeal(selectedMeal.id);
      setSelectedMeal(null);
      setScreen('dashboard');
      await refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !dashboard) return <LoadingScreen />;
  if (!goal) return <GoalSetup error={error} onSave={handleGoalSaved} />;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {screen === 'dashboard' && dashboard ? <DashboardScreen dashboard={dashboard} error={error} onAdd={() => { setSelectedMeal(null); setScreen('meal'); }} onOpenMeal={meal => { setSelectedMeal(meal); setScreen('detail'); }} onRefresh={refresh} refreshing={refreshing} /> : null}
        {screen === 'meal' ? <MealForm existingMeal={selectedMeal} onCancel={() => setScreen('dashboard')} onSaved={handleMealSaved} /> : null}
        {screen === 'detail' && selectedMeal ? <MealDetail meal={selectedMeal} onBack={() => setScreen('dashboard')} onDelete={() => Alert.alert('Delete meal?', 'This meal will be removed from today.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: handleMealDeleted }] )} onEdit={() => setScreen('meal')} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function GoalSetup({ error, onSave }: { error: string | null; onSave: (goal: { dailyCalorieTarget: number; type: GoalType }) => Promise<void> }) {
  const [type, setType] = useState<GoalType>('maintain');
  const [target, setTarget] = useState('2000');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const dailyCalorieTarget = Number(target);
    if (!Number.isInteger(dailyCalorieTarget) || dailyCalorieTarget < 800 || dailyCalorieTarget > 6000) return;
    setSaving(true);
    await onSave({ dailyCalorieTarget, type });
    setSaving(false);
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.onboarding} keyboardShouldPersistTaps="handled">
          <Brand />
          <Text style={styles.eyebrow}>A small step today</Text>
          <Text style={styles.heroTitle}>Build a healthier{`\n`}<Text style={styles.accent}>daily rhythm.</Text></Text>
          <Text style={styles.muted}>Set a simple daily target. You can update it anytime.</Text>
          <Card>
            <Text style={styles.label}>What’s your goal?</Text>
            <View style={styles.choiceRow}>{(['lose', 'maintain', 'gain'] as GoalType[]).map(item => <Choice key={item} selected={item === type} title={item === 'lose' ? 'Lose' : item === 'gain' ? 'Gain' : 'Maintain'} onPress={() => setType(item)} />)}</View>
            <Field label="Daily calorie target" value={target} onChangeText={setTarget} keyboardType="number-pad" suffix="kcal" />
          </Card>
          {error ? <ErrorText message={error} /> : null}
          <Button title={saving ? 'Saving…' : 'Set my goal'} onPress={submit} disabled={saving} />
          <Text style={styles.helper}>No account required. Your progress stays on this device.</Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function DashboardScreen({ dashboard, error, onAdd, onOpenMeal, onRefresh, refreshing }: { dashboard: Dashboard; error: string | null; onAdd: () => void; onOpenMeal: (meal: Meal) => void; onRefresh: () => Promise<void>; refreshing: boolean }) {
  const target = dashboard.goal?.dailyCalorieTarget ?? 0;
  const progress = target ? Math.min(dashboard.totalCalories / target, 1) : 0;
  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.topRow}><View><Text style={styles.eyebrow}>Good morning!</Text><Brand compact /></View><View style={styles.headerActions}><Text style={styles.headerIcon}>◫</Text><Text style={styles.avatar}>HF</Text></View></View>
      <Text style={styles.greeting}>Laksh <Text style={styles.accent}>.</Text></Text>
      <DateStrip date={dashboard.date} />
      <Card lime><View style={styles.progressHero}><View><Text style={styles.darkLabel}>Daily intake</Text><Text style={styles.heroCardTitle}>Your daily{`\n`}progress</Text><Text style={styles.heroRemaining}>{dashboard.remainingCalories ?? 0} kcal remaining</Text></View><ProgressRing progress={progress} /></View></Card>
      {error ? <ErrorText message={error} /> : null}
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Today’s meals</Text><Text style={styles.muted}>{dashboard.meals.length} meals</Text></View>
      <Card>{dashboard.meals.length ? dashboard.meals.map(meal => <MealRow key={meal.id} meal={meal} onPress={() => onOpenMeal(meal)} />) : <EmptyState />}</Card>
      <Button title="+  Log a meal" onPress={onAdd} />
      <View style={styles.bottomNav}><Text style={styles.navActive}>Today</Text><Text style={styles.muted}>History</Text><Text style={styles.muted}>Settings</Text></View>
    </ScrollView>
  );
}

function MealForm({ existingMeal, onCancel, onSaved }: { existingMeal: Meal | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(existingMeal?.name ?? '');
  const [calories, setCalories] = useState(existingMeal?.caloriesKcal?.toString() ?? '');
  const [protein, setProtein] = useState(existingMeal?.proteinGrams?.toString() ?? '');
  const [carbs, setCarbs] = useState(existingMeal?.carbsGrams?.toString() ?? '');
  const [fat, setFat] = useState(existingMeal?.fatGrams?.toString() ?? '');
  const [note, setNote] = useState(existingMeal?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const input: MealInput = { caloriesKcal: Number(calories), name: name.trim() };
    if (!input.name || !Number.isInteger(input.caloriesKcal) || input.caloriesKcal < 0) { setError('Add a meal name and a valid calorie value.'); return; }
    if (protein) input.proteinGrams = Number(protein);
    if (carbs) input.carbsGrams = Number(carbs);
    if (fat) input.fatGrams = Number(fat);
    if (note.trim()) input.note = note.trim();
    try {
      setSaving(true); setError(null);
      if (existingMeal) await updateMeal(existingMeal.id, input); else await createMeal(input);
      await onSaved();
    } catch (requestError) { setError(getErrorMessage(requestError)); } finally { setSaving(false); }
  }

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>{existingMeal ? 'Update meal' : 'Today'}</Text><Text style={styles.pageTitle}>{existingMeal ? 'Edit your ' : 'Log a '}<Text style={styles.accent}>meal.</Text></Text><Card><Field label="Meal name" value={name} onChangeText={setName} placeholder="e.g. Vegetable poha" /><Field label="Calories" value={calories} onChangeText={setCalories} keyboardType="number-pad" suffix="kcal" /><View style={styles.nutritionRow}><Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="number-pad" suffix="g" compact /><Field label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" suffix="g" compact /><Field label="Fat" value={fat} onChangeText={setFat} keyboardType="number-pad" suffix="g" compact /></View><Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Homemade" /></Card>{error ? <ErrorText message={error} /> : null}<Button title={saving ? 'Saving…' : existingMeal ? 'Save changes' : 'Save meal'} onPress={submit} disabled={saving} /><Button title="Cancel" onPress={onCancel} secondary /></ScrollView></KeyboardAvoidingView>;
}

function MealDetail({ meal, onBack, onDelete, onEdit }: { meal: Meal; onBack: () => void; onDelete: () => void; onEdit: () => void }) {
  return <ScrollView contentContainerStyle={styles.content}><Button title="‹  Back" onPress={onBack} secondary /><View style={styles.detailHeader}><Text style={styles.mealEmoji}>🍽️</Text><Text style={styles.pageTitle}>{meal.name}</Text><Text style={styles.muted}>{formatTime(meal.loggedAt)}</Text><Text style={styles.detailCalories}>{meal.caloriesKcal ?? 0} <Text style={styles.muted}>kcal</Text></Text></View><Card><Stat label="Protein" value={meal.proteinGrams} /><Stat label="Carbohydrates" value={meal.carbsGrams} /><Stat label="Fat" value={meal.fatGrams} /><Stat label="Note" value={meal.note} /></Card><Button title="Edit meal" onPress={onEdit} /><Button title="Delete meal" onPress={onDelete} secondary /></ScrollView>;
}

function LoadingScreen() { return <View style={styles.loading}><ActivityIndicator color={colors.green} /><Text style={styles.muted}>Loading healthFlip…</Text></View>; }
function Brand({ compact = false }: { compact?: boolean }) { return <Text style={[styles.brand, compact && styles.compactBrand]}>healthFlip</Text>; }
function Card({ children, lime = false }: { children: React.ReactNode; lime?: boolean }) { return <View style={[styles.card, lime && styles.limeCard]}>{children}</View>; }
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, pressed && styles.pressed, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text></Pressable>; }
function Choice({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, selected && styles.selectedChoice]}><Text style={selected ? styles.selectedChoiceText : styles.choiceText}>{title}</Text></Pressable>; }
function Field({ label, value, onChangeText, keyboardType, placeholder, suffix, compact = false }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'number-pad' | 'default'; placeholder?: string; suffix?: string; compact?: boolean }) { return <View style={compact ? styles.compactField : styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}><TextInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={colors.muted} /><Text style={styles.inputSuffix}>{suffix}</Text></View></View>; }
function MealRow({ meal, onPress }: { meal: Meal; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.mealRow}><Text style={styles.mealEmoji}>🍽️</Text><View style={styles.mealCopy}><Text style={styles.mealName}>{meal.name}</Text><Text style={styles.muted}>{formatTime(meal.loggedAt)}</Text></View><Text style={styles.mealCalories}>{meal.caloriesKcal ?? 0} kcal</Text></Pressable>; }
function ProgressRing({ progress }: { progress: number }) { return <View style={styles.ring}><View style={[styles.ringValue, progress > 0.25 && styles.ringQuarter, progress > 0.5 && styles.ringHalf, progress > 0.75 && styles.ringThreeQuarter]}><Text style={styles.ringText}>{Math.round(progress * 100)}%</Text></View></View>; }
function DateStrip({ date }: { date: string }) { const current = new Date(`${date}T12:00:00`); const days = [-1, 0, 1].map(offset => new Date(current.getTime() + offset * 86_400_000)); return <View style={styles.dateStrip}>{days.map((day, index) => <View key={day.toISOString()} style={[styles.dateCell, index === 1 && styles.selectedDate]}><Text style={styles.dateWeekday}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</Text><Text style={styles.dateNumber}>{day.getDate()}</Text></View>)}</View>; }
function EmptyState() { return <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing logged yet</Text><Text style={styles.muted}>Your first meal will appear here.</Text></View>; }
function Stat({ label, value }: { label: string; value: number | string | null }) { return <View style={styles.stat}><Text style={styles.muted}>{label}</Text><Text style={styles.statValue}>{value === null ? '—' : `${value}${typeof value === 'number' ? 'g' : ''}`}</Text></View>; }
function ErrorText({ message }: { message: string }) { return <Text accessibilityRole="alert" style={styles.error}>{message}</Text>; }
function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function formatTime(value: string): string { return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }

const colors = { background: '#F7F8F3', dark: '#17332D', green: '#2E7663', line: '#E2EAE3', muted: '#70817B', pale: '#DCEFE6', white: '#FFFFFF' };
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, content: { padding: 24, paddingBottom: 36 }, onboarding: { flexGrow: 1, justifyContent: 'center', padding: 24 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background }, brand: { color: colors.dark, fontSize: 21, fontWeight: '700', letterSpacing: -1, marginBottom: 32 }, compactBrand: { marginBottom: 0 }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, headerActions: { alignItems: 'center', flexDirection: 'row', gap: 10 }, headerIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, color: colors.dark, fontSize: 18, height: 34, paddingTop: 6, textAlign: 'center', width: 34 }, avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EAF4BB', color: colors.dark, textAlign: 'center', paddingTop: 8, fontSize: 12, fontWeight: '700' }, eyebrow: { color: colors.muted, fontSize: 12, marginBottom: 6 }, heroTitle: { color: colors.dark, fontSize: 34, fontWeight: '600', letterSpacing: -1.5, lineHeight: 38, marginBottom: 12 }, greeting: { color: colors.dark, fontSize: 28, fontWeight: '600', letterSpacing: -1.1, marginBottom: 15 }, pageTitle: { color: colors.dark, fontSize: 28, fontWeight: '600', letterSpacing: -1.1, marginBottom: 18 }, accent: { color: colors.green }, muted: { color: colors.muted, fontSize: 13 }, card: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 20, borderWidth: 1, marginBottom: 16, padding: 17, shadowColor: colors.dark, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 1 }, limeCard: { backgroundColor: '#DDF3A8', borderWidth: 0, padding: 20 }, darkCard: { backgroundColor: colors.dark, borderWidth: 0, padding: 20 }, progressHero: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, darkLabel: { color: colors.dark, fontSize: 12, marginBottom: 10 }, heroCardTitle: { color: colors.dark, fontSize: 23, fontWeight: '600', letterSpacing: -0.7, lineHeight: 25 }, heroRemaining: { color: '#4C6E43', fontSize: 12, marginTop: 16 }, ring: { alignItems: 'center', backgroundColor: '#B5D967', borderColor: '#F7FBEA', borderRadius: 52, borderWidth: 8, height: 96, justifyContent: 'center', width: 96 }, ringValue: { alignItems: 'center', backgroundColor: '#DDF3A8', borderColor: '#83B43A', borderRadius: 38, borderTopColor: '#DDF3A8', borderWidth: 7, height: 72, justifyContent: 'center', transform: [{ rotate: '-45deg' }], width: 72 }, ringQuarter: { borderRightColor: '#83B43A' }, ringHalf: { borderBottomColor: '#83B43A' }, ringThreeQuarter: { borderLeftColor: '#83B43A' }, ringText: { color: colors.dark, fontSize: 15, fontWeight: '700', transform: [{ rotate: '45deg' }] }, dateStrip: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, padding: 8 }, dateCell: { alignItems: 'center', borderRadius: 13, minWidth: 62, paddingVertical: 8 }, selectedDate: { backgroundColor: '#DDF3A8' }, dateWeekday: { color: colors.muted, fontSize: 11, marginBottom: 3 }, dateNumber: { color: colors.dark, fontSize: 17, fontWeight: '600' }, progressHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, progressNumber: { color: colors.white, fontSize: 30, fontWeight: '600', letterSpacing: -1 }, progressUnit: { color: '#CDE5D9', fontSize: 12, fontWeight: '400', letterSpacing: 0 }, progressPercent: { color: '#EAF4BB', fontSize: 15, fontWeight: '600' }, progressTrack: { backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 5, height: 8, marginBottom: 12, overflow: 'hidden' }, progressFill: { backgroundColor: '#EAF4BB', borderRadius: 5, height: '100%' }, label: { color: colors.muted, fontSize: 12, marginBottom: 7 }, choiceRow: { flexDirection: 'row', gap: 7, marginBottom: 17 }, choice: { alignItems: 'center', borderColor: colors.line, borderRadius: 13, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 62 }, selectedChoice: { backgroundColor: colors.pale, borderColor: colors.green }, choiceText: { color: colors.dark, fontSize: 12, textAlign: 'center' }, selectedChoiceText: { color: colors.green, fontSize: 12, fontWeight: '600', textAlign: 'center' }, field: { marginBottom: 14 }, compactField: { flex: 1, marginHorizontal: 3 }, nutritionRow: { flexDirection: 'row', marginHorizontal: -3 }, inputWrap: { alignItems: 'center', borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 47, paddingHorizontal: 12 }, input: { color: colors.dark, flex: 1, fontSize: 16, paddingVertical: 10 }, inputSuffix: { color: colors.muted, fontSize: 12 }, button: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 14, justifyContent: 'center', marginBottom: 10, minHeight: 51, paddingHorizontal: 16 }, secondaryButton: { backgroundColor: 'transparent', borderColor: colors.line, borderWidth: 1 }, buttonText: { color: colors.white, fontSize: 15, fontWeight: '600' }, secondaryButtonText: { color: colors.green }, pressed: { opacity: .75 }, disabled: { opacity: .5 }, helper: { color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'center' }, error: { color: '#B05040', fontSize: 13, marginBottom: 12 }, sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }, sectionTitle: { color: colors.dark, fontSize: 16, fontWeight: '600' }, mealRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', minHeight: 57, paddingVertical: 9 }, mealEmoji: { backgroundColor: colors.pale, borderRadius: 12, fontSize: 18, height: 38, marginRight: 11, paddingTop: 8, textAlign: 'center', width: 38 }, mealCopy: { flex: 1 }, mealName: { color: colors.dark, fontSize: 14, fontWeight: '600', marginBottom: 2 }, mealCalories: { color: colors.dark, fontSize: 12, fontWeight: '600' }, empty: { alignItems: 'center', paddingVertical: 25 }, emptyTitle: { color: colors.dark, fontSize: 15, fontWeight: '600', marginBottom: 5 }, bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 11 }, navActive: { color: colors.green, fontSize: 12, fontWeight: '600' }, detailHeader: { alignItems: 'center', paddingVertical: 16 }, detailCalories: { color: colors.dark, fontSize: 36, fontWeight: '600', letterSpacing: -1.3, marginTop: 18 }, stat: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 }, statValue: { color: colors.dark, fontSize: 14, fontWeight: '600' },
});

export default App;
