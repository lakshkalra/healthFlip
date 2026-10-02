import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMeal, deleteMeal, getCurrentGoal, getDashboard, saveGoal, updateMeal, type MealInput } from './src/api/client';
import {
  FOODS,
  GOALS,
  MEAL_TYPES,
  formatNumber,
  formatTime,
  goalLabel,
  isWholeNumber,
  macroTargets,
  mealTypeLabel,
  mealTypeOf,
  typeForHour,
  type MealType,
} from './src/meals';
import type { Dashboard, GoalType, Meal } from './src/types';
import {
  Banner,
  Card,
  ErrorCard,
  FieldError,
  Icon,
  IconTile,
  InputShell,
  MacroBar,
  MealTypeTile,
  NumberInput,
  Overlay,
  PillButton,
  ProgressRing,
  RoundIconButton,
  Spinner,
  Toast,
  colors,
  styles as ui,
  type IconName,
} from './src/ui';

type Route = 'boot' | 'goal' | 'dash' | 'detail';
type BootState = 'loading' | 'first' | 'returning' | 'error';
type DashState = 'loading' | 'ready' | 'refreshing' | 'fail' | 'error';
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle="dark-content" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<Route>('boot');
  const [boot, setBoot] = useState<BootState>('loading');
  const [target, setTarget] = useState(2000);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dash, setDash] = useState<DashState>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; mode: 'add' | 'edit'; type: MealType; key: number }>({ open: false, mode: 'add', type: 'breakfast', key: 0 });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, key: 0 });
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dashBusy = useRef(false);

  const selected = dashboard?.meals.find(meal => meal.id === selectedId) ?? null;
  const dailyTarget = dashboard?.goal?.dailyCalorieTarget ?? target;

  const flash = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  const loadDashboard = useCallback(async (initial: boolean) => {
    if (dashBusy.current) return;
    dashBusy.current = true;
    setDash(initial ? 'loading' : 'refreshing');
    try {
      setDashboard(await getDashboard());
      setDash('ready');
    } catch {
      setDash(initial ? 'error' : 'fail');
    } finally {
      dashBusy.current = false;
    }
  }, []);

  const start = useCallback(async () => {
    setRoute('boot');
    setBoot('loading');
    try {
      const goal = await getCurrentGoal();
      if (!goal) {
        setBoot('first');
        await wait(1200);
        setRoute('goal');
        return;
      }
      setTarget(goal.dailyCalorieTarget);
      setBoot('returning');
      setDashboard(await getDashboard());
      setDash('ready');
      setRoute('dash');
    } catch {
      setBoot('error');
    }
  }, []);

  useEffect(() => {
    start();
    return () => clearTimeout(toastTimer.current);
  }, [start]);

  async function handleGoalSaved(goal: { dailyCalorieTarget: number; type: GoalType }) {
    const saved = await saveGoal(goal);
    setTarget(saved.dailyCalorieTarget);
    setRoute('dash');
    loadDashboard(true);
  }

  function handleMealSaved(mode: 'add' | 'edit') {
    setSheet(current => ({ ...current, open: false }));
    setRoute('dash');
    flash(mode === 'edit' ? 'Changes saved' : 'Meal logged. Nice one!');
    loadDashboard(false);
  }

  async function handleDelete() {
    if (!selected) return;
    await deleteMeal(selected.id);
    setDeleteDialog(current => ({ ...current, open: false }));
    setRoute('dash');
    flash('Meal deleted');
    loadDashboard(false);
  }

  const openAdd = (type: MealType = typeForHour()) => setSheet({ open: true, mode: 'add', type, key: Date.now() });

  return (
    <View style={[ui.flex, { backgroundColor: route === 'boot' ? colors.lime : colors.bg }]}>
      {route === 'boot' ? <BootScreen state={boot} onRetry={start} /> : null}
      {route === 'goal' ? (
        <GoalSetup
          initialType={editingGoal ? dashboard?.goal?.type : undefined}
          initialTarget={editingGoal ? dashboard?.goal?.dailyCalorieTarget : undefined}
          onCancel={editingGoal ? () => { setEditingGoal(false); setRoute('dash'); } : undefined}
          onSave={handleGoalSaved}
        />
      ) : null}
      {route === 'dash' ? (
        <DashboardScreen
          dashboard={dashboard}
          state={dash}
          target={dailyTarget}
          onAdd={openAdd}
          onEditGoal={() => { setEditingGoal(true); setRoute('goal'); }}
          onOpenMeal={meal => {
            setSelectedId(meal.id);
            setRoute('detail');
          }}
          onRefresh={() => loadDashboard(false)}
          onRetry={() => loadDashboard(true)}
        />
      ) : null}
      {route === 'detail' && selected ? (
        <MealDetail
          meal={selected}
          type={mealTypeOf(selected)}
          target={dailyTarget}
          onBack={() => setRoute('dash')}
          onEdit={() => setSheet({ open: true, mode: 'edit', type: mealTypeOf(selected), key: Date.now() })}
          onDelete={() => setDeleteDialog({ open: true, key: Date.now() })}
        />
      ) : null}

      <MealSheet
        key={`sheet-${sheet.key}`}
        visible={sheet.open}
        mode={sheet.mode}
        initialType={sheet.type}
        meal={sheet.mode === 'edit' ? selected : null}
        onClose={() => setSheet(current => ({ ...current, open: false }))}
        onSaved={handleMealSaved}
      />
      <DeleteDialog key={`delete-${deleteDialog.key}`} visible={deleteDialog.open} meal={selected} onCancel={() => setDeleteDialog(current => ({ ...current, open: false }))} onDelete={handleDelete} />

      <View pointerEvents="none" style={[screen.toastSlot, { top: insets.top + 4 }]}>
        <Toast message={toast} />
      </View>
    </View>
  );
}

// ---------- Page 0 · Bootstrap ----------

function BootScreen({ state, onRetry }: { state: BootState; onRetry: () => void }) {
  const status = (text: string) => (
    <View style={screen.bootStatus}>
      <Spinner color={colors.greenDark} />
      <Text style={screen.bootStatusText}>{text}</Text>
    </View>
  );
  return (
    <View style={screen.boot}>
      <View style={screen.bootBrand}>
        <IconTile name="leaf" bg={colors.ink} fg={colors.limeBright} size={88} radius={30} iconSize={42} />
        <Text style={screen.wordmark}>
          health<Text style={{ color: colors.greenText }}>Flip</Text>
        </Text>
      </View>
      {state === 'loading' ? status('Getting things ready…') : null}
      {state === 'first' || state === 'returning' ? (
        <View style={screen.bootGreeting}>
          <Text style={screen.bootTitle}>{state === 'first' ? "Welcome! Glad you're here." : 'Welcome back'}</Text>
          {status(state === 'first' ? "Let's set your daily goal" : 'Loading your day…')}
        </View>
      ) : null}
      {state === 'error' ? (
        <ErrorCard title="We can't reach healthFlip" body="Your data is safe on this device. Check your connection and try again." onRetry={onRetry} retryIcon style={screen.fullWidth} />
      ) : null}
    </View>
  );
}

// ---------- Page 1 · Goal setup ----------

const goalIcons: Record<GoalType, IconName> = { lose: 'trendDown', maintain: 'equals', gain: 'trendUp' };

function GoalSetup({ initialType, initialTarget, onCancel, onSave }: { initialType?: GoalType; initialTarget?: number; onCancel?: () => void; onSave: (goal: { dailyCalorieTarget: number; type: GoalType }) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<GoalType>(initialType ?? 'maintain');
  const [targetText, setTargetText] = useState(String(initialTarget ?? 2000));
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'fail'>('idle');

  function step(delta: number) {
    const current = isWholeNumber(targetText) ? Number(targetText) : 2000;
    setTargetText(String(Math.min(6000, Math.max(800, Math.round((current + delta) / 50) * 50))));
    setError('');
  }

  async function submit() {
    if (status === 'saving') return;
    const value = targetText.trim();
    if (!isWholeNumber(value)) return setError('Enter a whole number, like 2000.');
    const dailyCalorieTarget = Number(value);
    if (dailyCalorieTarget < 800 || dailyCalorieTarget > 6000) return setError('Pick a target between 800 and 6,000 kcal.');
    setError('');
    setStatus('saving');
    try {
      await onSave({ dailyCalorieTarget, type });
    } catch {
      setStatus('fail');
    }
  }

  return (
    <ScrollView style={ui.flex} contentContainerStyle={[screen.goal, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={screen.setupHeader}>
        <Greeting />
        {onCancel ? <RoundIconButton name="arrowLeft" label="Cancel" bg={colors.chip} size={40} iconSize={18} stroke={2.6} onPress={onCancel} /> : null}
      </View>
      <View style={screen.gap8}>
        <Text style={screen.goalTitle}>{onCancel ? 'Update your goal' : 'What are you aiming for?'}</Text>
        <Text style={screen.body}>{onCancel ? 'Adjust your daily target whenever your needs change.' : 'Pick a goal and a daily calorie target to get started.'}</Text>
      </View>
      <View style={screen.gap10}>
        {GOALS.map(goal => {
          const on = goal.id === type;
          return (
            <Pressable key={goal.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { setType(goal.id); setError(''); }} style={[screen.goalOption, on && screen.goalOptionOn]}>
              <IconTile name={goalIcons[goal.id]} bg={on ? colors.limeBright : colors.chip} fg={on ? colors.ink : colors.muted} size={46} radius={15} stroke={2.6} />
              <View style={screen.grow}>
                <Text style={screen.optionTitle}>{goal.label}</Text>
                <Text style={[screen.small, { color: on ? colors.greenSoft : colors.muted }]}>{goal.desc}</Text>
              </View>
              {on ? <IconTile name="check" bg={colors.green} fg={colors.white} size={24} radius={12} iconSize={14} stroke={3.4} /> : <View style={screen.radioOff} />}
            </Pressable>
          );
        })}
      </View>
      <Card style={screen.targetCard}>
        <Text style={screen.label15}>Daily calorie target</Text>
        <View style={screen.stepperRow}>
          <RoundIconButton name="minus" label="Decrease target" bg={colors.chip} size={48} iconSize={20} stroke={2.8} onPress={() => step(-50)} />
          <InputShell error={!!error} style={screen.targetShell}>
            <TextInput accessibilityLabel="Daily calorie target" value={targetText} onChangeText={text => { setTargetText(text); setError(''); }} keyboardType="number-pad" style={screen.targetInput} />
            <Text style={screen.unit}>kcal</Text>
          </InputShell>
          <RoundIconButton name="plus" label="Increase target" bg={colors.chip} size={48} iconSize={20} stroke={2.8} onPress={() => step(50)} />
        </View>
        {error ? (
          <View style={screen.inlineError}>
            <Icon name="alert" size={15} color={colors.dangerText} stroke={2.6} />
            <FieldError message={error} />
          </View>
        ) : (
          <Text style={screen.small}>Most adults land between 1,600 and 2,600. Allowed range 800 to 6,000.</Text>
        )}
      </Card>
      <View style={ui.flex} />
      {status === 'fail' ? <Banner icon message="We couldn't save your goal. Check your connection and try again." /> : null}
      <PillButton title={status === 'fail' ? 'Retry' : onCancel ? 'Save goal' : 'Set my goal'} busy={status === 'saving'} busyLabel="Saving your goal…" glow onPress={submit} />
    </ScrollView>
  );
}

function Greeting({ children }: { children?: React.ReactNode }) {
  return (
    <View style={screen.greeting}>
      <IconTile name="user" bg={colors.pale} fg={colors.greenDark} size={44} radius={22} />
      {children ?? <Text style={screen.greetingText}>Hello there!</Text>}
    </View>
  );
}

// ---------- Page 2 · Today dashboard ----------

function DashboardScreen({ dashboard, state, target, onAdd, onEditGoal, onOpenMeal, onRefresh, onRetry }: { dashboard: Dashboard | null; state: DashState; target: number; onAdd: (type?: MealType) => void; onEditGoal: () => void; onOpenMeal: (meal: Meal) => void; onRefresh: () => void; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const busy = state === 'loading' || state === 'refreshing';
  const hasContent = !!dashboard && (state === 'ready' || state === 'refreshing' || state === 'fail');
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={ui.flex}>
      <ScrollView
        contentContainerStyle={[screen.dash, { paddingTop: insets.top + 8 }]}
        refreshControl={hasContent ? <RefreshControl refreshing={false} onRefresh={onRefresh} /> : undefined}>
        <Greeting>
          <View style={screen.grow}>
            <Text style={screen.small}>Hello there!</Text>
            <Text style={screen.headline}>{dateLabel}</Text>
          </View>
          <View style={screen.row6}>
            <RoundIconButton name="pencil" label="Edit goal" bg={colors.chip} onPress={onEditGoal} />
            <RoundIconButton name="refresh" label="Refresh" busy={busy} onPress={onRefresh} />
          </View>
        </Greeting>

        {state === 'loading' ? <DashboardSkeleton /> : null}
        {state === 'error' || (!dashboard && state === 'fail') ? (
          <ErrorCard title="Today didn't load" body="Your meals are safe. We just couldn't fetch them. Give it another go." onRetry={onRetry} style={screen.dashError} />
        ) : null}
        {hasContent && dashboard ? (
          <>
            {state === 'refreshing' ? (
              <View style={screen.refreshChip}>
                <Spinner color={colors.greenDark} />
                <Text style={screen.refreshText}>Refreshing…</Text>
              </View>
            ) : null}
            {state === 'fail' ? <Banner message="Couldn't refresh. Showing your last update." onRetry={onRefresh} /> : null}
            <DashboardContent dashboard={dashboard} target={target} now={now} onAdd={onAdd} onOpenMeal={onOpenMeal} />
          </>
        ) : null}
      </ScrollView>
      <BottomNav onAdd={() => onAdd()} />
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={screen.gap14}>
      <View style={[screen.skeleton, screen.skeletonHero]} />
      <View style={[screen.skeleton, screen.skeletonWeek]} />
      <View style={screen.skeleton} />
      <View style={screen.skeleton} />
      <View style={screen.skeletonStatus}>
        <Spinner color={colors.muted} />
        <Text style={screen.skeletonText}>Loading today…</Text>
      </View>
    </View>
  );
}

function DashboardContent({ dashboard, target, now, onAdd, onOpenMeal }: { dashboard: Dashboard; target: number; now: Date; onAdd: (type?: MealType) => void; onOpenMeal: (meal: Meal) => void }) {
  const meals = [...dashboard.meals].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  const consumed = dashboard.totalCalories;
  const remaining = target - consumed;
  const sum = (key: 'proteinGrams' | 'carbsGrams' | 'fatGrams') => meals.reduce((total, meal) => total + (meal[key] ?? 0), 0);
  const macros = macroTargets(target);
  const kicker = remaining < 0 ? 'A little over today' : consumed === 0 ? 'Fresh start today' : "Today's intake";
  const countLabel = !meals.length ? 'No meals yet' : meals.length === 1 ? '1 meal today' : `${meals.length} meals today`;

  return (
    <>
      <View style={screen.hero}>
        <View style={screen.heroTop}>
          <View style={[screen.grow, screen.gap6]}>
            <View style={screen.kicker}>
              <IconTile name="flame" bg="rgba(255,255,255,.65)" fg={colors.greenDark} size={26} radius={13} iconSize={14} stroke={2.6} />
              <Text style={screen.kickerText}>{kicker}</Text>
            </View>
            <Text style={screen.heroNumber}>
              {formatNumber(consumed)} <Text style={screen.heroUnit}>kcal</Text>
            </Text>
            <Text style={screen.heroSub}>
              of {formatNumber(target)} kcal · {goalLabel(dashboard.goal?.type)}
            </Text>
          </View>
          <ProgressRing consumed={consumed} target={target} />
        </View>
        <View style={screen.row8}>
          <MacroBar label="Protein" value={sum('proteinGrams')} target={macros.p} color={colors.protein} track={colors.proteinBg} />
          <MacroBar label="Carbs" value={sum('carbsGrams')} target={macros.c} color={colors.carbs} track={colors.carbsBg} />
          <MacroBar label="Fat" value={sum('fatGrams')} target={macros.f} color={colors.fat} track={colors.fatBg} />
        </View>
      </View>

      <WeekStrip date={dashboard.date} now={now} countLabel={countLabel} />

      {!meals.length ? (
        <Card style={screen.emptyCard}>
          <IconTile name="utensils" bg={colors.carbsBg} fg="#c27a12" />
          <View style={screen.gap4}>
            <Text style={screen.emptyTitle}>No meals logged yet</Text>
            <Text style={screen.body14}>Your full {formatNumber(target)} kcal is still on the table. Log your first meal and we'll keep count.</Text>
          </View>
          <PillButton title="Log a meal" icon="plus" height={50} onPress={() => onAdd()} />
        </Card>
      ) : (
        MEAL_TYPES.map(({ id, label }) => {
          const items = meals.filter(meal => mealTypeOf(meal) === id);
          const kcal = items.reduce((total, meal) => total + (meal.caloriesKcal ?? 0), 0);
          if (!items.length) {
            return (
              <Pressable key={id} onPress={() => onAdd(id)} style={({ pressed }) => [screen.emptyGroup, pressed && { backgroundColor: colors.white }]}>
                <MealTypeTile type={id} />
                <View style={screen.grow}>
                  <Text style={screen.optionTitle}>{label}</Text>
                  <Text style={screen.small}>{remaining > 0 ? `Nothing yet · ${formatNumber(remaining)} kcal to play with` : 'Nothing yet'}</Text>
                </View>
                <IconTile name="plus" bg={colors.limeBright} fg={colors.ink} size={36} radius={18} iconSize={18} stroke={2.6} />
              </Pressable>
            );
          }
          return (
            <Card key={id} style={screen.gap8}>
              <View style={screen.rowCenter12}>
                <MealTypeTile type={id} />
                <View style={screen.grow}>
                  <Text style={screen.optionTitle}>{label}</Text>
                  <Text style={screen.small}>
                    {formatNumber(kcal)} kcal · {items.length} {items.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
                <RoundIconButton name="plus" label={`Add to ${label}`} bg={colors.bg} size={36} iconSize={18} stroke={2.6} onPress={() => onAdd(id)} />
              </View>
              <View style={screen.mealList}>
                {items.map(meal => (
                  <Pressable key={meal.id} onPress={() => onOpenMeal(meal)} style={({ pressed }) => [screen.mealRow, pressed && { backgroundColor: colors.bg }]}>
                    <View style={screen.grow}>
                      <Text style={screen.mealName}>{meal.name}</Text>
                      <Text style={screen.mealTime}>{formatTime(meal.loggedAt)}</Text>
                    </View>
                    <Text style={screen.mealCal}>{formatNumber(meal.caloriesKcal ?? 0)} kcal</Text>
                    <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} />
                  </Pressable>
                ))}
              </View>
            </Card>
          );
        })
      )}
    </>
  );
}

function WeekStrip({ date, now, countLabel }: { date: string; now: Date; countLabel: string }) {
  const today = new Date(`${date}T12:00:00`);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + index);
    return { key: index, letter: 'SMTWTFS'[index], number: String(day.getDate()).padStart(2, '0'), today: index === today.getDay() };
  });
  return (
    <Card style={screen.week}>
      <View style={screen.weekHeader}>
        <Text style={screen.headline}>{now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <Text style={screen.countPill}>{countLabel}</Text>
      </View>
      <View style={screen.row}>
        {days.map(day => (
          <View key={day.key} style={[screen.weekDay, day.today && screen.weekToday]}>
            <Text style={[screen.weekText, day.today && screen.weekTodayText]}>{day.letter}</Text>
            <Text style={[screen.weekText, screen.weekNum, day.today && screen.weekTodayText]}>{day.number}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function BottomNav({ onAdd }: { onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  const item = (icon: IconName, label: string, active = false) => (
    <View style={screen.navItem} accessibilityState={{ disabled: !active }}>
      <Icon name={icon} size={22} color={active ? colors.ink : colors.disabled} />
      <Text style={[screen.navLabel, active && screen.navActive]}>{label}</Text>
      {!active ? <Text style={screen.soon}>Soon</Text> : null}
    </View>
  );
  return (
    <View style={[screen.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {item('home', 'Home', true)}
      {item('chart', 'Progress')}
      <View style={screen.navItem}>
        <Pressable accessibilityLabel="Log a meal" accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [screen.fab, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Icon name="plus" size={26} stroke={2.8} />
        </Pressable>
      </View>
      {item('gift', 'Rewards')}
      {item('lightbulb', 'Tips')}
    </View>
  );
}

// ---------- Page 4 · Meal detail ----------

function MealDetail({ meal, type, target, onBack, onEdit, onDelete }: { meal: Meal; type: MealType; target: number; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  const insets = useSafeAreaInsets();
  const cal = meal.caloriesKcal ?? 0;
  const time = formatTime(meal.loggedAt);
  const grams = (value: number | null) => (value === null ? '—' : `${value} g`);
  const macros: [string, number | null, string][] = [
    ['Protein', meal.proteinGrams, colors.protein],
    ['Carbs', meal.carbsGrams, colors.carbs],
    ['Fat', meal.fatGrams, colors.fat],
  ];
  return (
    <ScrollView contentContainerStyle={[screen.detail, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <View style={screen.detailHeader}>
        <RoundIconButton name="arrowLeft" label="Back" iconSize={20} stroke={2.6} onPress={onBack} />
        <Text style={screen.headline}>Meal details</Text>
        <View style={screen.spacer44} />
      </View>
      <View style={screen.hero}>
        <View style={screen.rowCenter10}>
          <MealTypeTile type={type} size={40} radius={13} iconSize={20} />
          <Text style={screen.kickerText}>
            {mealTypeLabel(type)} · {time}
          </Text>
        </View>
        <Text style={screen.detailName}>{meal.name}</Text>
        <View style={screen.detailCalRow}>
          <Text style={screen.detailCal}>{formatNumber(cal)}</Text>
          <Text style={screen.detailUnit}>kcal</Text>
          <Text style={screen.detailShare}>{Math.round((cal / target) * 100)}% of daily target</Text>
        </View>
      </View>
      <View style={screen.row10}>
        {macros.map(([label, value, color]) => (
          <View key={label} style={screen.macroCard}>
            <View style={[screen.dot, { backgroundColor: color }]} />
            <View>
              <Text style={screen.macroCardValue}>{grams(value)}</Text>
              <Text style={screen.mealTime}>{label}</Text>
            </View>
          </View>
        ))}
      </View>
      <Card style={screen.noteCard}>
        <Text style={screen.noteLabel}>Note</Text>
        <Text style={[screen.noteText, !meal.note && { color: colors.faint }]}>{meal.note || 'No note added'}</Text>
      </Card>
      <View style={screen.loggedRow}>
        <Icon name="clock" size={14} color={colors.muted2} />
        <Text style={screen.mealTime}>
          Logged {meal.source === 'manual' ? 'manually' : `via ${meal.source}`} at {time}
        </Text>
      </View>
      <View style={ui.flex} />
      <View style={screen.gap10}>
        <PillButton title="Edit meal" variant="dark" icon="pencil" onPress={onEdit} />
        <PillButton title="Delete meal" variant="light" icon="trash" onPress={onDelete} />
      </View>
    </ScrollView>
  );
}

// ---------- Pages 3 & 5 · Add / edit meal sheet ----------

type MealForm = { name: string; cal: string; p: string; c: string; f: string; note: string; type: MealType };
type FormErrors = Partial<Record<'name' | 'cal' | 'p' | 'c' | 'f', string>>;

const toText = (value: number | null) => (value === null ? '' : String(value));

function validate(form: MealForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Enter a meal name or choose a food.';
  if (!form.cal.trim()) errors.cal = 'Add calories, even a rough guess.';
  else if (!isWholeNumber(form.cal)) errors.cal = 'Use a whole number, 0 or more.';
  (['p', 'c', 'f'] as const).forEach(key => {
    if (form[key].trim() && !isWholeNumber(form[key])) errors[key] = 'Whole number';
  });
  return errors;
}

function MealSheet({ visible, mode, initialType, meal, onClose, onSaved }: { visible: boolean; mode: 'add' | 'edit'; initialType: MealType; meal: Meal | null; onClose: () => void; onSaved: (mode: 'add' | 'edit') => void }) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<MealForm>(() =>
    meal
      ? { name: meal.name, cal: toText(meal.caloriesKcal), p: toText(meal.proteinGrams), c: toText(meal.carbsGrams), f: toText(meal.fatGrams), note: meal.note ?? '', type: initialType }
      : { name: '', cal: '', p: '', c: '', f: '', note: '', type: initialType },
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'fail'>('idle');
  const saving = status === 'saving';

  const update = (patch: Partial<MealForm>) => {
    setForm(current => ({ ...current, ...patch }));
    setErrors(current => {
      const next = { ...current };
      Object.keys(patch).forEach(key => delete next[key as keyof FormErrors]);
      return next;
    });
  };

  async function submit() {
    if (saving) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const input: MealInput = { caloriesKcal: Number(form.cal), mealType: form.type, name: form.name.trim() };
    if (form.p.trim()) input.proteinGrams = Number(form.p);
    if (form.c.trim()) input.carbsGrams = Number(form.c);
    if (form.f.trim()) input.fatGrams = Number(form.f);
    if (form.note.trim()) input.note = form.note.trim();
    setStatus('saving');
    try {
      if (mode === 'edit' && meal) await updateMeal(meal.id, input);
      else await createMeal(input);
      onSaved(mode);
    } catch {
      setStatus('fail');
    }
  }

  const macroField = (key: 'p' | 'c' | 'f', label: string) => (
    <View style={[ui.flex, screen.gap4]}>
      <InputShell error={!!errors[key]} style={screen.macroShell}>
        <Text style={screen.macroInputLabel}>{label}</Text>
        <NumberInput accessibilityLabel={label} value={form[key]} onChangeText={text => update({ [key]: text })} placeholder="–" style={screen.macroInput} />
      </InputShell>
      <FieldError small message={errors[key]} />
    </View>
  );

  return (
    <Overlay visible={visible} onClose={() => !saving && onClose()}>
      <View style={screen.handleRow}>
        <View style={screen.handle} />
      </View>
      <View style={screen.sheetHeader}>
        <Text style={screen.sheetTitle}>{mode === 'edit' ? 'Edit meal' : 'Log a meal'}</Text>
        <RoundIconButton name="close" label="Close" bg={colors.chip} size={38} iconSize={18} stroke={2.6} onPress={() => !saving && onClose()} />
      </View>
      <ScrollView style={screen.sheetBody} contentContainerStyle={screen.sheetContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={screen.gap6}>
          <Text style={screen.label14}>Food</Text>
          <FoodPicker value={form.name} error={!!errors.name} onChange={name => update({ name })} onPick={food => update({ name: food.name, cal: String(food.cal), p: String(food.p), c: String(food.c), f: String(food.f) })} />
          <FieldError message={errors.name} />
        </View>
        <View style={screen.gap6}>
          <Text style={screen.label14}>Which meal?</Text>
          <View style={screen.row6}>
            {MEAL_TYPES.map(({ id, label }) => {
              const on = form.type === id;
              return (
                <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => update({ type: id })} style={[screen.chip, on && screen.chipOn]}>
                  <Text style={[screen.chipText, on && screen.chipTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={screen.gap6}>
          <FieldLabel title="Calories" hint="Filled from the food, adjust for your portion" />
          <InputShell error={!!errors.cal}>
            <NumberInput accessibilityLabel="Calories" value={form.cal} onChangeText={cal => update({ cal })} placeholder="0" />
            <Text style={screen.unitSmall}>kcal</Text>
          </InputShell>
          <FieldError message={errors.cal} />
        </View>
        <View style={screen.gap6}>
          <FieldLabel title="Macros" hint="Optional" />
          <View style={screen.row8}>
            {macroField('p', 'Protein g')}
            {macroField('c', 'Carbs g')}
            {macroField('f', 'Fat g')}
          </View>
        </View>
        <View style={screen.gap6}>
          <FieldLabel title="Note" hint="Optional" />
          <TextInput value={form.note} onChangeText={note => update({ note })} placeholder="Anything worth remembering?" placeholderTextColor={colors.faint} multiline style={screen.note} />
        </View>
        <View style={screen.loggedRow}>
          <Icon name="clock" size={14} color={colors.muted2} />
          <Text style={screen.mealTime}>{mode === 'edit' && meal ? `Logged at ${formatTime(meal.loggedAt)} · manual entry` : `Logging now, ${formatTime(Date.now())} · manual entry`}</Text>
        </View>
      </ScrollView>
      <View style={[screen.sheetFooter, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}>
        {status === 'fail' ? <Banner message="We couldn't save that. Your entries are still here, so just try again." /> : null}
        <PillButton title={status === 'fail' ? 'Retry' : mode === 'edit' ? 'Save changes' : 'Save meal'} busy={saving} busyLabel="Saving…" onPress={submit} />
      </View>
    </Overlay>
  );
}

function FieldLabel({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={screen.fieldLabel}>
      <Text style={screen.label14}>{title}</Text>
      <Text style={screen.hint}>{hint}</Text>
    </View>
  );
}

function FoodPicker({ value, error, onChange, onPick }: { value: string; error: boolean; onChange: (value: string) => void; onPick: (food: (typeof FOODS)[number]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const foods = FOODS.filter(food => !q || food.name.toLowerCase().includes(q));
  return (
    <>
      <InputShell error={error} style={screen.foodShell}>
        <Icon name="search" size={17} color={colors.muted} stroke={2.6} />
        <TextInput
          accessibilityLabel="Food"
          value={open ? query : value}
          onChangeText={text => { setQuery(text); onChange(text); setOpen(true); }}
          onFocus={() => { setQuery(value); setOpen(true); }}
          placeholder={value || 'Search or type a meal'}
          placeholderTextColor={value ? colors.ink : colors.faint}
          style={screen.foodInput}
        />
        <Pressable accessibilityLabel="Toggle food list" onPress={() => { setOpen(!open); setQuery(''); }} style={screen.chevron} hitSlop={8}>
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
            <Icon name="chevronDown" size={18} color={colors.muted} stroke={2.6} />
          </View>
        </Pressable>
      </InputShell>
      {open ? (
        <View style={screen.picker}>
          <Text style={screen.pickerHint}>Choose a food or type your own meal name.</Text>
          <ScrollView style={screen.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {foods.map(food => {
              const on = food.name === value;
              return (
                <Pressable key={food.name} onPress={() => { onPick(food); setOpen(false); setQuery(''); }} style={({ pressed }) => [screen.foodRow, (on || pressed) && { backgroundColor: on ? colors.selected : colors.bg }]}>
                  <View style={screen.grow}>
                    <Text style={[screen.mealName, on && screen.bold]}>{food.name}</Text>
                    <Text style={[screen.mealTime, on && { color: colors.greenSoft }]}>{food.serving}</Text>
                  </View>
                  <Text style={[screen.foodCal, on && screen.foodCalOn]}>{formatNumber(food.cal)} kcal</Text>
                  {on ? <Icon name="check" size={16} color={colors.greenMid} stroke={3} /> : null}
                </Pressable>
              );
            })}
            {!foods.length ? <Text style={screen.noResults}>No foods match "{query}"</Text> : null}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

// ---------- Page 6 · Delete confirmation ----------

function DeleteDialog({ visible, meal, onCancel, onDelete }: { visible: boolean; meal: Meal | null; onCancel: () => void; onDelete: () => Promise<void> }) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'fail'>('idle');
  const deleting = status === 'deleting';
  async function confirm() {
    if (deleting) return;
    setStatus('deleting');
    try {
      await onDelete();
    } catch {
      setStatus('fail');
    }
  }
  return (
    <Overlay visible={visible && !!meal} variant="dialog" onClose={() => !deleting && onCancel()}>
      <IconTile name="trash" bg={colors.dangerBg} fg={colors.danger} size={52} radius={26} iconSize={24} />
      <Text style={screen.dialogTitle}>Delete this meal?</Text>
      <Text style={screen.body}>
        <Text style={screen.bold}>{meal?.name}</Text> ({formatNumber(meal?.caloriesKcal ?? 0)} kcal) will be removed from today's progress.
      </Text>
      {status === 'fail' ? <Banner message="Couldn't delete right now. The meal is still saved." /> : null}
      <View style={screen.dialogActions}>
        <PillButton title="Cancel" variant="muted" height={54} style={ui.flex} onPress={() => !deleting && onCancel()} />
        <PillButton title={status === 'fail' ? 'Try again' : 'Delete'} variant="danger" height={54} busy={deleting} busyLabel="Deleting…" style={ui.flex} onPress={confirm} />
      </View>
    </Overlay>
  );
}

// ---------- Styles ----------

const screen = StyleSheet.create({
  grow: { flex: 1, gap: 2, minWidth: 0 },
  row: { flexDirection: 'row' },
  row6: { flexDirection: 'row', gap: 6 },
  row8: { flexDirection: 'row', gap: 8 },
  row10: { flexDirection: 'row', gap: 10 },
  rowCenter10: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  rowCenter12: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap14: { gap: 14 },
  fullWidth: { alignSelf: 'stretch' },
  setupHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  spacer44: { width: 44 },
  bold: { color: colors.ink, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  body14: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 13 },
  headline: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  label14: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  label15: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted2, fontSize: 12 },
  fieldLabel: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  unit: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  unitSmall: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  toastSlot: { left: 0, position: 'absolute', right: 0, zIndex: 80 },

  boot: { alignItems: 'center', flex: 1, gap: 26, justifyContent: 'center', paddingHorizontal: 36 },
  bootBrand: { alignItems: 'center', gap: 16 },
  wordmark: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -0.6 },
  bootGreeting: { alignItems: 'center', gap: 10 },
  bootTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  bootStatus: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  bootStatusText: { color: colors.greenDark, fontSize: 15, fontWeight: '600' },

  greeting: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  greetingText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  goal: { flexGrow: 1, gap: 20, paddingHorizontal: 20 },
  goalTitle: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33 },
  goalOption: { alignItems: 'center', backgroundColor: colors.white, borderColor: 'transparent', borderRadius: 22, borderWidth: 2, flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  goalOptionOn: { backgroundColor: colors.selected, borderColor: colors.green },
  optionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  radioOff: { borderColor: colors.ring, borderRadius: 12, borderWidth: 2, height: 24, width: 24 },
  targetCard: { gap: 12, padding: 18 },
  stepperRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  targetShell: { flex: 1, gap: 6, height: 60, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18 },
  targetInput: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, minWidth: 80, padding: 0, textAlign: 'right' },
  inlineError: { alignItems: 'center', flexDirection: 'row', gap: 6 },

  dash: { gap: 14, paddingBottom: 124, paddingHorizontal: 18 },
  dashError: { marginTop: 60, paddingHorizontal: 22, paddingVertical: 28 },
  skeleton: { backgroundColor: '#eceee7', borderRadius: 24, height: 84 },
  skeletonHero: { backgroundColor: '#e6efd3', borderRadius: 28, height: 218 },
  skeletonWeek: { height: 104 },
  skeletonStatus: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', paddingTop: 6 },
  skeletonText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  refreshChip: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.pale, borderRadius: 99, flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 7 },
  refreshText: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  hero: { backgroundColor: colors.lime, borderRadius: 28, gap: 16, padding: 20 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  kicker: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  kickerText: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  heroNumber: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.7, lineHeight: 38 },
  heroUnit: { color: colors.greenDark, fontSize: 15, fontWeight: '600', letterSpacing: 0 },
  heroSub: { color: colors.greenDark, fontSize: 13 },
  week: { paddingBottom: 12 },
  weekHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  countPill: { backgroundColor: colors.pale, borderRadius: 99, color: colors.greenDark, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 },
  weekDay: { alignItems: 'center', borderRadius: 99, flex: 1, gap: 6, paddingVertical: 8 },
  weekToday: { backgroundColor: colors.limeBright },
  weekText: { color: colors.faint, fontSize: 12 },
  weekNum: { fontSize: 15 },
  weekTodayText: { color: colors.ink, fontWeight: '700' },
  emptyCard: { gap: 14, paddingHorizontal: 20, paddingVertical: 24 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  emptyGroup: { alignItems: 'center', borderColor: colors.dashed, borderRadius: 24, borderStyle: 'dashed', borderWidth: 1.5, flexDirection: 'row', gap: 12, padding: 16 },
  mealList: { gap: 2, paddingLeft: 46 },
  mealRow: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  mealName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  mealTime: { color: colors.muted2, fontSize: 12 },
  mealCal: { color: '#3f443a', fontSize: 14, fontWeight: '600' },
  nav: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, bottom: 0, boxShadow: '0 -4px 20px rgba(0,0,0,.05)', flexDirection: 'row', left: 0, paddingTop: 12, position: 'absolute', right: 0 },
  navItem: { alignItems: 'center', flex: 1, gap: 4 },
  navLabel: { color: colors.disabled, fontSize: 11 },
  navActive: { color: colors.ink, fontWeight: '700' },
  soon: { backgroundColor: colors.chip, borderRadius: 99, color: colors.muted2, fontSize: 9, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 1, position: 'absolute', right: 4, top: -8 },
  fab: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 29, boxShadow: '0 0 0 6px #fff, 0 8px 18px rgba(127,191,42,.45)', height: 58, justifyContent: 'center', marginTop: -26, width: 58 },

  detail: { flexGrow: 1, gap: 14, paddingHorizontal: 18 },
  detailHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  detailName: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32 },
  detailCalRow: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  detailCal: { color: colors.ink, fontSize: 44, fontWeight: '800', letterSpacing: -1.3, lineHeight: 46 },
  detailUnit: { color: colors.greenDark, fontSize: 16, fontWeight: '600' },
  detailShare: { color: colors.greenDark, fontSize: 13, marginLeft: 'auto' },
  macroCard: { backgroundColor: colors.white, borderRadius: 20, flex: 1, gap: 10, padding: 14 },
  macroCardValue: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  dot: { borderRadius: 5, height: 10, width: 10 },
  noteCard: { borderRadius: 20, gap: 6 },
  noteLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  noteText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  loggedRow: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 4 },

  handleRow: { alignItems: 'center', paddingBottom: 4, paddingTop: 10 },
  handle: { backgroundColor: colors.handle, borderRadius: 9, height: 5, width: 40 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', paddingBottom: 10, paddingHorizontal: 20, paddingTop: 6 },
  sheetTitle: { color: colors.ink, flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  sheetBody: { flexShrink: 1 },
  sheetContent: { gap: 16, paddingBottom: 12, paddingHorizontal: 20, paddingTop: 4 },
  sheetFooter: { borderTopColor: colors.chip, borderTopWidth: 1, gap: 10, paddingHorizontal: 20, paddingTop: 10 },
  foodShell: { gap: 10, paddingRight: 14 },
  foodInput: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '600', minWidth: 0, padding: 0 },
  chevron: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  picker: { backgroundColor: colors.white, borderRadius: 18, boxShadow: '0 0 0 1.5px #e6eadc, 0 8px 18px rgba(28,31,26,.08)', marginTop: 2, padding: 6 },
  pickerHint: { color: colors.muted2, fontSize: 12, paddingHorizontal: 8, paddingTop: 6 },
  pickerList: { maxHeight: 232 },
  foodRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 9 },
  foodCal: { color: '#3f443a', fontSize: 13, fontWeight: '600' },
  foodCalOn: { color: colors.greenDark, fontWeight: '700' },
  noResults: { color: colors.muted, fontSize: 14, paddingHorizontal: 10, paddingVertical: 18, textAlign: 'center' },
  chip: { alignItems: 'center', backgroundColor: colors.chip, borderRadius: 99, flex: 1, height: 40, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { color: '#3f443a', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.white, fontWeight: '700' },
  macroShell: { alignItems: 'stretch', flexDirection: 'column', justifyContent: 'center', paddingHorizontal: 12 },
  macroInputLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  macroInput: { flex: 0, fontSize: 16 },
  note: { backgroundColor: colors.bg, borderRadius: 16, color: colors.ink, fontSize: 15, fontWeight: '500', lineHeight: 21, minHeight: 66, paddingHorizontal: 16, paddingVertical: 12, textAlignVertical: 'top' },

  dialogTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});

export default App;
