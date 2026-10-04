import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionSheetIOS, Alert, AppState, Linking, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMeal, deleteMeal, getCurrentGoal, getDailyInsight, getDashboard, getProfile, listFoods, logWater, resetGuest, saveGoal, setWaterTarget, undoWater, updateMeal, type DailyInsight, type MealInput } from './src/api/client';
import { AssistantScreen } from './src/assistant';
import { AskFlipPill, FlipReveal, type RevealOrigin } from './src/flip';
import { HealthRow, WaterCard, type HomeHealthActions } from './src/health';
import { firstName, type OnboardingStep } from './src/onboarding';
import { OnboardingChat } from './src/onboardingChat';
import { ProfileScreen } from './src/profile';
import { VoiceConversationScreen } from './src/voice';
import { ProgressScreen } from './src/progress';
import { PlansScreen } from './src/plans';
import { applyWaterReminders, clearAllReminders, DEFAULT_REMINDERS, loadReminderSettings, nextReminder, saveReminderSettings, type ReminderSettings } from './src/reminders';
import { ReportsScreen } from './src/reports';
import { TipsScreen } from './src/tips';
import { clearWidget, syncWidget } from './src/widget';
import { notificationStatus, takeLaunchURL, updateWidget } from './src/native';
import {
  FOODS,
  GOALS,
  MEAL_TYPES,
  dateKey,
  foodFromSaved,
  formatNumber,
  formatTime,
  goalLabel,
  isWholeNumber,
  macroTargets,
  mealTypeLabel,
  mealTypeOf,
  typeForHour,
  type Food,
  type MealType,
} from './src/meals';
import type { Dashboard, GoalType, Meal, Profile } from './src/types';
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

type Tab = 'home' | 'progress' | 'plans' | 'tips';
type Route = 'assistant' | 'boot' | 'goal' | 'detail' | 'onboarding' | 'profile' | 'reports' | Tab;
type BootState = 'loading' | 'first' | 'returning' | 'error';
type DashState = 'loading' | 'ready' | 'refreshing' | 'fail' | 'error';
type MealTypes = Record<string, MealType>;

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
  const window = useWindowDimensions();
  const [route, setRoute] = useState<Route>('boot');
  const [boot, setBoot] = useState<BootState>('loading');
  const [target, setTarget] = useState(2000);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarding, setOnboarding] = useState<{ cancelable: boolean; startAt: OnboardingStep }>({ cancelable: false, startAt: 'about' });
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dash, setDash] = useState<DashState>('loading');
  const [mealTypes, setMealTypes] = useState<MealTypes>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; mode: 'add' | 'edit'; type: MealType; key: number }>({ open: false, mode: 'add', type: 'breakfast', key: 0 });
  const [assistantReturnRoute, setAssistantReturnRoute] = useState<Tab>('home');
  // Set when the food search hands a query to Flip; the chat sends it straight away.
  const [assistantSeed, setAssistantSeed] = useState<{ query: string; type: MealType } | null>(null);
  // Flip is an overlay above the current route so the screen underneath shows through the reveal.
  const [flip, setFlip] = useState<{ instant: boolean; open: boolean; origin: RevealOrigin }>({ instant: false, open: false, origin: { x: 0, y: 0 } });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, key: 0 });
  const [toast, setToast] = useState('');
  const [viewing, setViewing] = useState<Dashboard | null>(null);
  // Reports open over the current tab; the id opens one report directly.
  const [reportsView, setReportsView] = useState<{ key: number; reportId: string | null; returnTo: Tab }>({ key: 0, reportId: null, returnTo: 'home' });
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [waterBusy, setWaterBusy] = useState(false);
  const [plansSignal, setPlansSignal] = useState(0);
  // A question Flip should answer as soon as it opens (from "Ask Flip about this" on a report).
  const [flipQuestion, setFlipQuestion] = useState<string | undefined>(undefined);
  const [historyVersion, setHistoryVersion] = useState(0);
  // Bumped when Flip saves a plan by voice so the Plans tab reloads.
  const [plansVersion, setPlansVersion] = useState(0);
  const [progressPop, setProgressPop] = useState(0);
  const [tipsPop, setTipsPop] = useState(0);
  const [editingGoal, setEditingGoal] = useState<{ dailyCalorieTarget: number; type: GoalType } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dashBusy = useRef(false);
  const activeTab: Tab | null = route === 'home' || route === 'progress' || route === 'plans' || route === 'tips' ? route : null;

  // Selected meal looks up in today's dashboard first, then in any past day being viewed.
  const selected = dashboard?.meals.find(meal => meal.id === selectedId) ?? viewing?.meals.find(meal => meal.id === selectedId) ?? null;
  const selectedEditable = !!dashboard?.meals.some(meal => meal.id === selectedId);
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

  const loadInsight = useCallback(async () => {
    setInsightState('loading');
    try {
      setInsight(await getDailyInsight());
      setInsightState('ready');
    } catch {
      setInsight(null);
      setInsightState('error');
    }
  }, []);

  // Bumped after any save/delete, so the Progress tab's cached history refetches.
  const bumpHistory = useCallback(() => setHistoryVersion(current => current + 1), []);

  const start = useCallback(async () => {
    setRoute('boot');
    setBoot('loading');
    try {
      const [goal, savedProfile] = await Promise.all([getCurrentGoal(), getProfile()]);
      setTarget(goal?.dailyCalorieTarget ?? 2000);
      setProfile(savedProfile);
      // New guests (and guests from before profiles existed) go through onboarding once.
      if (!savedProfile || !goal) {
        setBoot('first');
        await wait(1200);
        setOnboarding({ cancelable: false, startAt: savedProfile ? 'goal' : 'about' });
        setRoute('onboarding');
        return;
      }
      setBoot('returning');
      const [today, settings] = await Promise.all([getDashboard(), loadReminderSettings()]);
      setReminders(settings);
      // Keep scheduled reminders in step with the server's target without prompting at launch.
      if ((await notificationStatus().catch(() => 'undetermined')) === 'granted') applyWaterReminders(today.water?.targetMl ?? null, settings).catch(() => undefined);
      setDashboard(today);
      setDash('ready');
      setRoute('home');
      loadInsight();
    } catch {
      setBoot('error');
    }
  }, [loadInsight]);

  // The Home Screen widget mirrors today's numbers whenever they change.
  const pushWidget = useCallback(() => {
    syncWidget(dashboard, dashboard?.goal?.dailyCalorieTarget ?? target, insight?.message ?? null, dashboard?.water?.targetMl ? nextReminder(reminders) : null);
  }, [dashboard, insight, reminders, target]);
  useEffect(pushWidget, [pushWidget]);
  useEffect(() => {
    if (route === 'onboarding' && !dashboard?.goal) clearWidget();
  }, [dashboard?.goal, route]);

  // Coming back to the app refreshes today (it may be a new day, or minutes later), and leaving it
  // pushes one last widget update so the Home Screen shows the latest numbers.
  const lastLoaded = useRef(0);
  useEffect(() => {
    if (dashboard) lastLoaded.current = Date.now();
  }, [dashboard]);
  const onAppState = useRef<(state: string) => void>(() => undefined);
  onAppState.current = state => {
    if (state === 'background') pushWidget();
    if (state !== 'active' || !dashboard || !activeTab) return;
    if (dashboard.date !== dateKey() || Date.now() - lastLoaded.current > 60_000) {
      setViewing(null);
      loadDashboard(false);
      if (dashboard.date !== dateKey()) loadInsight();
    }
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => onAppState.current(state));
    return () => subscription.remove();
  }, []);

  // Widget taps open the app with healthflip://log-meal, ://water or ://reports.
  const pendingLink = useRef<string | null>(null);
  const deepLink = useRef<(url: string | null) => void>(() => undefined);
  deepLink.current = (url: string | null) => {
    if (!url) return;
    // Links that arrive before Home is ready (boot, onboarding) wait until it is.
    if (!activeTab) {
      pendingLink.current = url;
      return;
    }
    const target_ = url.replace(/^healthflip:\/\//, '').split(/[?#]/)[0];
    if (target_ === 'log-meal') openAssistant();
    else if (target_ === 'reports') openReports();
    else if (target_ === 'water' || target_ === 'home') { setViewing(null); setRoute('home'); }
  };
  useEffect(() => {
    Promise.all([takeLaunchURL().catch(() => null), Linking.getInitialURL().catch(() => null)])
      .then(([launched, initial]) => { pendingLink.current = launched ?? initial ?? null; })
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => deepLink.current(url));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (activeTab && pendingLink.current) {
      deepLink.current(pendingLink.current);
      pendingLink.current = null;
    }
  }, [activeTab]);

  // If the open meal disappears after a refresh, fall back to the home tab instead of a blank page.
  useEffect(() => {
    if (route === 'detail' && !selected) setRoute('home');
  }, [route, selected]);

  useEffect(() => {
    start();
    return () => clearTimeout(toastTimer.current);
  }, [start]);

  async function handleGoalSaved(goal: { dailyCalorieTarget: number; type: GoalType }) {
    // A manual calorie edit keeps the plan's steps and rationale and rescales its macros.
    const current = dashboard?.goal;
    const scale = current ? goal.dailyCalorieTarget / current.dailyCalorieTarget : 1;
    const macros = current?.macroTargets;
    const saved = await saveGoal({
      ...goal,
      carbsTargetGrams: macros ? Math.round(macros.carbsGrams * scale) : null,
      dailyStepsTarget: current?.dailyStepsTarget ?? null,
      fatTargetGrams: macros ? Math.round(macros.fatGrams * scale) : null,
      planRationale: current?.planRationale ?? null,
      proteinTargetGrams: macros ? Math.round(macros.proteinGrams * scale) : null,
    });
    setTarget(saved.dailyCalorieTarget);
    setEditingGoal(null);
    setRoute('home');
    loadDashboard(true);
    loadInsight();
    bumpHistory();
  }

  function handleOnboardingComplete(result: { goal: { dailyCalorieTarget: number }; profile: Profile }) {
    setProfile(result.profile);
    setTarget(result.goal.dailyCalorieTarget);
    setViewing(null);
    setRoute('home');
    flash('Your plan is ready');
    loadDashboard(true);
    loadInsight();
    bumpHistory();
  }

  const openRecalculate = () => {
    setOnboarding({ cancelable: true, startAt: 'goal' });
    setRoute('onboarding');
  };

  const resetHealthFlip = useCallback(() => {
    Alert.alert('Reset healthFlip?', 'This deletes your goals, meals, profile, memories, and plans, then returns you to first-run setup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset everything',
        style: 'destructive',
        onPress: () => {
          resetGuest().then(() => {
            clearAllReminders().catch(() => undefined);
            updateWidget(null).catch(() => undefined);
            setDashboard(null);
            setProfile(null);
            setViewing(null);
            setInsight(null);
            setRoute('onboarding');
            setOnboarding({ cancelable: false, startAt: 'about' });
          }).catch(() => Alert.alert('Reset failed', 'Check your connection and try again.'));
        },
      },
    ]);
  }, []);

  function handleMealSaved(types: MealTypes, mode: 'add' | 'edit') {
    setMealTypes(types);
    setSheet(current => ({ ...current, open: false }));
    setViewing(null);
    setRoute('home');
    flash(mode === 'edit' ? 'Changes saved' : 'Meal logged. Nice one!');
    loadDashboard(false);
    loadInsight();
    bumpHistory();
  }

  // Flip stays open after logging (it confirms in conversation), so only refresh the data behind it.
  function handleFlipMealLogged() {
    loadDashboard(false);
    loadInsight();
    bumpHistory();
  }

  const openFlip = (origin: RevealOrigin = { x: window.width / 2, y: window.height - 80 }) => setFlip({ instant: false, open: true, origin });
  const closeFlip = () => {
    setFlipQuestion(undefined);
    setFlip(current => ({ ...current, instant: false, open: false }));
  };

  function openTextFromFlip() {
    setFlipQuestion(undefined);
    setFlip(current => ({ ...current, instant: true, open: false }));
    openAssistant();
  }

  // The meal chat stays open after logging so you can add more; only refresh the data behind it.
  function handleAssistantMealLogged() {
    setViewing(null);
    loadDashboard(false);
    loadInsight();
    bumpHistory();
  }

  function closeAssistant(logged: number) {
    setRoute(assistantReturnRoute);
    if (logged) flash(logged === 1 ? 'Meal logged. Nice one!' : `${logged} meals logged. Nice one!`);
  }

  function pickFromList(type: MealType) {
    setRoute(assistantReturnRoute);
    openAdd(type);
  }

  async function handleDelete() {
    if (!selected) return;
    await deleteMeal(selected.id);
    setDeleteDialog(current => ({ ...current, open: false }));
    setRoute('home');
    flash('Meal deleted');
    loadDashboard(false);
    bumpHistory();
  }

  const openAdd = (type: MealType = typeForHour()) => setSheet({ open: true, mode: 'add', type, key: Date.now() });

  function openReports(reportId?: string) {
    setReportsView({ key: Date.now(), reportId: reportId ?? null, returnTo: activeTab ?? 'home' });
    setRoute('reports');
  }

  // Water: quick logging updates the card straight away; the dashboard refresh follows.
  async function changeWater(action: () => Promise<{ consumedMl: number }>) {
    if (waterBusy) return;
    setWaterBusy(true);
    try {
      const water = await action();
      setDashboard(current => (current?.water ? { ...current, water: { ...current.water, consumedMl: water.consumedMl } } : current));
    } catch {
      flash('Couldn’t update water. Try again.');
    } finally {
      setWaterBusy(false);
    }
  }

  async function applyReminders(targetMl: number | null, settings: ReminderSettings) {
    setReminders(settings);
    saveReminderSettings(settings).catch(() => undefined);
    const allowed = await applyWaterReminders(targetMl, settings).catch(() => false);
    if (!allowed && targetMl && settings.enabled) {
      Alert.alert('Reminders are off', 'Allow notifications for healthFlip in Settings to get water reminders.', [
        { style: 'cancel', text: 'Not now' },
        { onPress: () => { Linking.openSettings().catch(() => undefined); }, text: 'Open Settings' },
      ]);
    }
  }

  async function setWaterGoal(targetMl: number | null) {
    try {
      await setWaterTarget(targetMl);
      await applyReminders(targetMl, reminders);
      loadDashboard(false);
    } catch {
      flash('Couldn’t update your water goal. Try again.');
    }
  }

  function waterSettings() {
    const targetMl = dashboard?.water?.targetMl ?? null;
    const options: { label: string; run: () => void; destructive?: boolean }[] = [
      ...(reminders.enabled
        ? ([1, 2, 3] as const).filter(hours => reminders.testSeconds || hours !== reminders.intervalHours).map(hours => ({ label: `Remind me every ${hours} h`, run: () => { applyReminders(targetMl, { ...reminders, intervalHours: hours, testSeconds: null }).catch(() => undefined); } }))
        : []),
      // Quick checks for testing: 10 reminders, 30 s or 1 min apart.
      ...([30, 60] as const).filter(seconds => seconds !== reminders.testSeconds).map(seconds => ({ label: `Test: every ${seconds === 30 ? '30 s' : '1 min'}`, run: () => { applyReminders(targetMl, { ...reminders, enabled: true, testSeconds: seconds }).catch(() => undefined); } })),
      { label: reminders.enabled ? 'Turn reminders off' : 'Turn reminders on', run: () => { applyReminders(targetMl, { ...reminders, enabled: !reminders.enabled }).catch(() => undefined); } },
      ...[2000, 2500, 3000, 3500].filter(ml => ml !== targetMl).map(ml => ({ label: `Change goal to ${ml / 1000} L`, run: () => { setWaterGoal(ml).catch(() => undefined); } })),
      { destructive: true, label: 'Remove water goal', run: () => { setWaterGoal(null).catch(() => undefined); } },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { cancelButtonIndex: options.length, destructiveButtonIndex: options.findIndex(option => option.destructive), options: [...options.map(option => option.label), 'Cancel'], title: `Reminders ${!reminders.enabled ? 'are off' : reminders.testSeconds ? `testing: every ${reminders.testSeconds === 30 ? '30 s' : '1 min'} (${10} times)` : `every ${reminders.intervalHours} h, ${reminders.startHour}:00–${reminders.endHour}:00`}` },
        index => options[index]?.run(),
      );
    } else {
      Alert.alert('Water', undefined, [...options.slice(-3).map(option => ({ onPress: option.run, style: option.destructive ? 'destructive' as const : 'default' as const, text: option.label })), { style: 'cancel', text: 'Cancel' }]);
    }
  }

  const homeHealth: HomeHealthActions = {
    nextReminder: dashboard?.water?.targetMl ? nextReminder(reminders) : null,
    onAddWater: ml => { changeWater(() => logWater(ml)).catch(() => undefined); },
    onOpenReports: openReports,
    onUndoWater: () => { changeWater(() => undoWater()).catch(() => undefined); },
    onWaterSettings: waterSettings,
    waterBusy,
  };

  function openAssistant() {
    setAssistantSeed(null);
    setAssistantReturnRoute(activeTab ?? 'home');
    setRoute('assistant');
  }

  // "Pick from list" found nothing: close the form and let Flip estimate what was searched.
  function askFlipAbout(query: string, type: MealType) {
    setSheet(current => ({ ...current, open: false }));
    setAssistantSeed({ query, type });
    if (route !== 'assistant') setAssistantReturnRoute(activeTab ?? 'home');
    setRoute('assistant');
  }

  // Bottom-nav press: switch tabs, and a second press on the active tab pops its sub-screen.
  const openTab = (tab: Tab) => {
    if (activeTab === tab) {
      if (tab === 'progress') setProgressPop(current => current + 1);
      if (tab === 'tips') setTipsPop(current => current + 1);
      return;
    }
    if (tab === 'home') setViewing(null);
    setRoute(tab);
  };

  return (
    <View style={[ui.flex, { backgroundColor: route === 'boot' ? colors.lime : colors.bg }]}>
      {route === 'boot' ? <BootScreen state={boot} onRetry={start} /> : null}
      {route === 'onboarding' ? (
        <OnboardingChat
          key={`${onboarding.startAt}-${onboarding.cancelable}`}
          initialProfile={profile}
          initialGoalType={dashboard?.goal?.type}
          startAt={onboarding.startAt}
          onCancel={onboarding.cancelable ? () => setRoute('home') : undefined}
          onComplete={handleOnboardingComplete}
        />
      ) : null}
      {route === 'profile' ? (
        <ProfileScreen
          profile={profile}
          onBack={() => setRoute('home')}
          onProfileSaved={setProfile}
          onRecalculate={openRecalculate}
          onReset={resetHealthFlip}
          onOpenReports={() => openReports()}
        />
      ) : null}
      {route === 'reports' ? (
        <ReportsScreen
          key={reportsView.key}
          initialReportId={reportsView.reportId}
          onClose={() => setRoute(reportsView.returnTo)}
          onAskFlip={question => { setFlipQuestion(question); openFlip(); }}
          onMakePlan={() => { setPlansSignal(current => current + 1); setRoute('plans'); }}
          onDeleted={() => loadDashboard(false)}
          onSaved={(_report, waterMl) => {
            flash('Report saved. Flip will use it for your meals.');
            if (waterMl) applyReminders(waterMl, reminders).catch(() => undefined);
            loadDashboard(false);
            loadInsight();
          }}
        />
      ) : null}
      {route === 'goal' ? <GoalSetup initial={editingGoal ?? undefined} editing={!!editingGoal} onCancel={() => { setEditingGoal(null); setRoute('home'); }} onSave={handleGoalSaved} /> : null}
      {activeTab ? (
        <>
          <View style={[ui.flex, activeTab === 'home' ? null : screen.hidden]}>
            <DashboardScreen
              dashboard={viewing ?? dashboard}
              state={dash}
              insight={insight}
              insightState={insightState}
              target={dailyTarget}
              mealTypes={mealTypes}
              viewing={viewing}
              onLogMeal={openAssistant}
              health={homeHealth}
              onOpenMeal={meal => {
                setSelectedId(meal.id);
                setRoute('detail');
              }}
              onBackToToday={() => setViewing(null)}
              onRefresh={() => loadDashboard(false)}
              onRetry={() => loadDashboard(true)}
              onInsightRetry={loadInsight}
              userName={profile ? firstName(profile.name) : null}
              onOpenProfile={() => setRoute('profile')}
              onRecalculate={openRecalculate}
              onEditGoal={() => {
                const goal = dashboard?.goal;
                setEditingGoal(goal ? { dailyCalorieTarget: goal.dailyCalorieTarget, type: goal.type } : null);
                setRoute('goal');
              }}
            />
          </View>
          <View style={[ui.flex, activeTab === 'progress' ? null : screen.hidden]}>
            <ProgressScreen
              target={dailyTarget}
              hasGoal={!!dashboard?.goal}
              mealTypes={mealTypes}
              version={historyVersion}
              popSignal={progressPop}
              onLogMeal={openAssistant}
              onSetGoal={() => {
                const goal = dashboard?.goal;
                setEditingGoal(goal ? { dailyCalorieTarget: goal.dailyCalorieTarget, type: goal.type } : null);
                setRoute('goal');
              }}
              onViewDay={day => {
                if (day.date === dateKey()) setViewing(null);
                else setViewing(day);
                setRoute('home');
              }}
            />
          </View>
          <View style={[ui.flex, activeTab === 'plans' ? null : screen.hidden]}>
            <PlansScreen version={plansVersion} newDietSignal={plansSignal} latestReport={dashboard?.latestReport ?? null} />
          </View>
          <View style={[ui.flex, activeTab === 'tips' ? null : screen.hidden]}>
            <TipsScreen popSignal={tipsPop} />
          </View>
          <BottomNav activeTab={activeTab} onNavigate={openTab} onAdd={openAssistant} />
          {activeTab === 'home' && !viewing && !sheet.open && !flip.open ? <AskFlipPill bottom={Math.max(insets.bottom, 12) + 78} onPress={openFlip} /> : null}
        </>
      ) : null}
      {route === 'assistant' ? (
        <AssistantScreen
          key={assistantSeed ? `seed-${assistantSeed.query}` : 'chat'}
          initialQuery={assistantSeed?.query}
          initialType={assistantSeed?.type ?? typeForHour()}
          remainingCalories={dashboard?.remainingCalories ?? null}
          userName={profile ? firstName(profile.name) : undefined}
          onClose={closeAssistant}
          onMealLogged={handleAssistantMealLogged}
          onOpenLiveVoice={() => openFlip()}
          onPickFromList={pickFromList}
        />
      ) : null}
      {route === 'detail' && selected ? (
        <MealDetail
          meal={selected}
          type={mealTypeOf(selected, mealTypes)}
          target={dailyTarget}
          editable={selectedEditable}
          onBack={() => setRoute(viewing ? 'home' : 'home')}
          onEdit={() => setSheet({ open: true, mode: 'edit', type: mealTypeOf(selected, mealTypes), key: Date.now() })}
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
        onAskFlip={askFlipAbout}
      />
      <DeleteDialog key={`delete-${deleteDialog.key}`} visible={deleteDialog.open} meal={selected} onCancel={() => setDeleteDialog(current => ({ ...current, open: false }))} onDelete={handleDelete} />

      <FlipReveal open={flip.open} instantClose={flip.instant} origin={flip.origin}>
        <VoiceConversationScreen
          initialQuestion={flipQuestion}
          mealType={typeForHour()}
          remainingCalories={dashboard?.remainingCalories ?? null}
          userName={profile ? firstName(profile.name) : undefined}
          onClose={closeFlip}
          onMealLogged={handleFlipMealLogged}
          onOpenText={openTextFromFlip}
          onPlanSaved={() => setPlansVersion(current => current + 1)}
        />
      </FlipReveal>

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

function GoalSetup({ initial, editing, onCancel, onSave }: { initial?: { dailyCalorieTarget: number; type: GoalType }; editing: boolean; onCancel?: () => void; onSave: (goal: { dailyCalorieTarget: number; type: GoalType }) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<GoalType>(initial?.type ?? 'maintain');
  const [targetText, setTargetText] = useState(String(initial?.dailyCalorieTarget ?? 2000));
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
      <View style={screen.row8}>
        {editing && onCancel ? <RoundIconButton name="arrowLeft" label="Back" iconSize={20} stroke={2.6} onPress={onCancel} /> : null}
        <Greeting />
      </View>
      <View style={screen.gap8}>
        <Text style={screen.goalTitle}>{editing ? 'Update your goal' : 'What are you aiming for?'}</Text>
        <Text style={screen.body}>{editing ? 'Keep your daily target aligned with what you need right now.' : 'Pick a goal and a daily calorie target to get started.'}</Text>
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
      <PillButton title={status === 'fail' ? 'Retry' : editing ? 'Save changes' : 'Set my goal'} busy={status === 'saving'} busyLabel="Saving your goal…" glow onPress={submit} />
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

const DETAILS_KEY = 'healthflip.homeDetails';

function DashboardScreen({ dashboard, state, insight, insightState, target, mealTypes, viewing, userName, health, onLogMeal, onOpenMeal, onBackToToday, onRefresh, onRetry, onInsightRetry, onEditGoal, onOpenProfile, onRecalculate }: { dashboard: Dashboard | null; state: DashState; insight: DailyInsight | null; insightState: 'idle' | 'loading' | 'ready' | 'error'; target: number; mealTypes: MealTypes; viewing: Dashboard | null; userName: string | null; health: HomeHealthActions; onLogMeal: () => void; onOpenMeal: (meal: Meal) => void; onBackToToday: () => void; onRefresh: () => void; onRetry: () => void; onInsightRetry: () => void; onEditGoal: () => void; onOpenProfile: () => void; onRecalculate: () => void }) {
  const insets = useSafeAreaInsets();
  const now = viewing ? new Date(`${viewing.date}T12:00:00`) : new Date();
  const hasContent = !!dashboard && (!!viewing || state === 'ready' || state === 'refreshing' || state === 'fail');
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView contentContainerStyle={[screen.dash, { paddingTop: insets.top + 8 }]} refreshControl={!viewing && hasContent ? <RefreshControl refreshing={state === 'refreshing'} onRefresh={onRefresh} /> : undefined}>
      <View style={screen.greeting}>
        {viewing
          ? <RoundIconButton name="arrowLeft" label="Back" iconSize={20} stroke={2.6} onPress={onBackToToday} />
          : <RoundIconButton name="user" label="Your profile and memories" bg={colors.pale} onPress={onOpenProfile} />}
        <View style={screen.grow}>
          <Text style={screen.small}>{viewing ? 'Past day' : userName ? `Hi, ${userName}!` : 'Hello there!'}</Text>
          <Text style={screen.headline}>{dateLabel}</Text>
        </View>
      </View>

      {!viewing && state === 'loading' ? <DashboardSkeleton /> : null}
      {!viewing && (state === 'error' || (!dashboard && state === 'fail')) ? (
        <ErrorCard title="Today didn't load" body="Your meals are safe. We just couldn't fetch them. Give it another go." onRetry={onRetry} style={screen.dashError} />
      ) : null}
      {hasContent && dashboard ? (
        <>
          {!viewing && state === 'fail' ? <Banner message="Couldn't refresh. Showing your last update." onRetry={onRefresh} /> : null}
          <DashboardContent dashboard={dashboard} health={health} insight={insight} insightState={insightState} target={target} mealTypes={mealTypes} viewing={!!viewing} onLogMeal={onLogMeal} onOpenMeal={onOpenMeal} onInsightRetry={onInsightRetry} onEditGoal={onEditGoal} onRecalculate={onRecalculate} />
        </>
      ) : null}
    </ScrollView>
  );
}

function DashboardSkeleton() {
  return (
    <View style={screen.gap14}>
      <View style={[screen.skeleton, screen.skeletonHero]} />
      <View style={screen.skeleton} />
      <View style={screen.skeletonStatus}>
        <Spinner color={colors.muted} />
        <Text style={screen.skeletonText}>Loading today…</Text>
      </View>
    </View>
  );
}

function DashboardContent({ dashboard, health, insight, insightState, target, mealTypes, viewing, onLogMeal, onOpenMeal, onInsightRetry, onEditGoal, onRecalculate }: { dashboard: Dashboard; health: HomeHealthActions; insight: DailyInsight | null; insightState: 'idle' | 'loading' | 'ready' | 'error'; target: number; mealTypes: MealTypes; viewing: boolean; onLogMeal: () => void; onOpenMeal: (meal: Meal) => void; onInsightRetry: () => void; onEditGoal: () => void; onRecalculate: () => void }) {
  const meals = [...dashboard.meals].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  const consumed = dashboard.totalCalories;
  const remaining = target - consumed;
  const [details, setDetails] = useState(false);

  // Remember whether Details was open; storage can be unavailable, so failures are ignored.
  useEffect(() => {
    AsyncStorage.getItem(DETAILS_KEY).then(value => setDetails(value === '1')).catch(() => undefined);
  }, []);
  const toggleDetails = () => {
    setDetails(open => {
      AsyncStorage.setItem(DETAILS_KEY, open ? '0' : '1').catch(() => undefined);
      return !open;
    });
  };

  const sum = (key: 'proteinGrams' | 'carbsGrams' | 'fatGrams') => meals.reduce((total, meal) => total + (meal[key] ?? 0), 0);
  // Plan macro targets when the goal has them; otherwise the fixed 30/40/30 split.
  const planMacros = dashboard.goal?.macroTargets;
  const macros = planMacros ? { c: planMacros.carbsGrams, f: planMacros.fatGrams, p: planMacros.proteinGrams } : macroTargets(target);
  const over = remaining < 0;

  return (
    <>
      <View style={screen.hero}>
        <View style={screen.heroEyebrow}>
          <Icon name="flame" size={14} color={colors.greenDark} stroke={2.6} />
          <Text style={screen.heroEyebrowText}>TODAY’S BALANCE</Text>
        </View>
        <View style={screen.heroTop}>
          <View style={[screen.grow, screen.gap10]}>
            <View style={screen.gap2}>
              <Text style={screen.heroLabel}>Eaten</Text>
              <Text style={screen.heroNumber}>
                {formatNumber(consumed)} <Text style={screen.heroUnit}>kcal</Text>
              </Text>
            </View>
            <View style={screen.gap2}>
              <Text style={screen.heroLabel}>{over ? 'Over by' : 'Left'}</Text>
              <Text style={[screen.heroLeft, over && { color: colors.overText }]}>
                {formatNumber(Math.abs(remaining))} <Text style={screen.heroUnitSmall}>kcal</Text>
              </Text>
            </View>
          </View>
          <ProgressRing consumed={consumed} target={target} />
        </View>

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} accessibilityLabel={details ? 'Hide details' : 'Show details'} onPress={toggleDetails} style={screen.detailsToggle}>
          <Text style={screen.detailsText}>{details ? 'Less' : 'Details'}</Text>
          <View style={details ? screen.flipped : null}><Icon name="chevronDown" size={16} color={colors.greenDark} stroke={2.8} /></View>
        </Pressable>

        {details ? (
          <View style={screen.gap14}>
            <Text style={screen.heroSub}>Goal: {formatNumber(target)} kcal · {goalLabel(dashboard.goal?.type)}</Text>
            <View style={screen.row8}>
              <MacroBar label="Protein" value={sum('proteinGrams')} target={macros.p} color={colors.protein} track={colors.proteinBg} />
              <MacroBar label="Carbs" value={sum('carbsGrams')} target={macros.c} color={colors.carbs} track={colors.carbsBg} />
              <MacroBar label="Fat" value={sum('fatGrams')} target={macros.f} color={colors.fat} track={colors.fatBg} />
            </View>
            {!viewing ? <FlipNudge insight={insight} state={insightState} onRetry={onInsightRetry} /> : null}
            {!viewing ? (
              <View style={screen.detailsLinks}>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={onEditGoal}><Text style={screen.planLink}>Edit goal</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Recalculate my plan" hitSlop={8} onPress={onRecalculate}><Text style={screen.planLink}>Recalculate plan</Text></Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {!viewing && dashboard.water?.targetMl ? <WaterCard water={dashboard.water} actions={health} /> : null}
      {!viewing ? <HealthRow report={dashboard.latestReport} onOpen={health.onOpenReports} /> : null}

      <View style={screen.mealsHeader}>
        <Text style={screen.sectionTitle}>{viewing ? 'Meals' : 'Today’s meals'}</Text>
        {meals.length ? <Text style={screen.countPill}>{meals.length === 1 ? '1 meal' : `${meals.length} meals`}</Text> : null}
      </View>

      {!meals.length && !viewing ? (
        <Card style={screen.emptyCardLocal}>
          <IconTile name="utensils" bg={colors.carbsBg} fg="#c27a12" />
          <View style={ui.gap4}>
            <Text style={ui.emptyTitle}>No meals yet</Text>
            <Text style={ui.body14}>{remaining > 0 ? `${formatNumber(remaining)} kcal to go. ` : ''}Tell Flip what you ate, or snap a photo.</Text>
          </View>
          <PillButton title="Log with Flip" icon="plus" height={50} onPress={onLogMeal} />
        </Card>
      ) : !meals.length && viewing ? (
        <Card style={ui.gap4}>
          <Text style={ui.emptyTitle}>Nothing logged this day</Text>
          <Text style={ui.body14}>Days without meals are not counted in your progress averages.</Text>
        </Card>
      ) : (
        <Card style={screen.mealList}>
          {meals.map(meal => {
            const type = mealTypeOf(meal, mealTypes);
            return (
              <Pressable key={meal.id} accessibilityRole="button" onPress={() => onOpenMeal(meal)} style={({ pressed }) => [screen.mealRow, pressed && screen.mealRowPressed]}>
                <MealTypeTile type={type} size={38} radius={12} iconSize={18} />
                <View style={screen.grow}>
                  <Text style={screen.mealName} numberOfLines={1}>{meal.name}</Text>
                  <Text style={screen.mealMeta}>{formatTime(meal.loggedAt)} · {mealTypeLabel(type)}</Text>
                </View>
                <Text style={screen.mealKcal}>{formatNumber(meal.caloriesKcal ?? 0)} kcal</Text>
                <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} />
              </Pressable>
            );
          })}
        </Card>
      )}
    </>
  );
}

/** Flip's daily wellness nudge, shown inside the hero's Details. */
function FlipNudge({ insight, state, onRetry }: { insight: DailyInsight | null; state: 'idle' | 'loading' | 'ready' | 'error'; onRetry: () => void }) {
  return (
    <View style={screen.nudge}>
      <View style={screen.rowCenter10}>
        <IconTile name="leaf" bg={colors.limeBright} fg={colors.greenDark} size={30} radius={10} iconSize={15} />
        <Text style={[screen.insightTitle, screen.grow]}>Flip's nudge</Text>
        {state === 'loading' ? <Spinner color={colors.greenDark} /> : null}
      </View>
      {state === 'loading' ? <Text style={screen.body14}>Finding something useful for today…</Text> : null}
      {state === 'error' ? (
        <Pressable accessibilityRole="button" onPress={onRetry}><Text style={screen.body14}>Couldn't load today's nudge. <Text style={screen.planLink}>Retry</Text></Text></Pressable>
      ) : null}
      {state === 'ready' && insight ? (
        <View style={screen.gap6}>
          <Text style={screen.body14}>{insight.message}</Text>
          <Text style={screen.insightAction}>{insight.nextAction}</Text>
        </View>
      ) : null}
    </View>
  );
}

const NAV_TABS: { tab: Tab; icon: IconName; label: string }[] = [
  { tab: 'home', icon: 'home', label: 'Home' },
  { tab: 'progress', icon: 'chart', label: 'Progress' },
  { tab: 'plans', icon: 'calendarCheck', label: 'Plans' },
  { tab: 'tips', icon: 'lightbulb', label: 'Tips' },
];

function BottomNav({ activeTab, onNavigate, onAdd }: { activeTab: Tab; onNavigate: (tab: Tab) => void; onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[screen.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <NavItem {...NAV_TABS[0]} active={activeTab === 'home'} onPress={onNavigate} />
      <NavItem {...NAV_TABS[1]} active={activeTab === 'progress'} onPress={onNavigate} />
      <View style={screen.navItem}>
        <Pressable accessibilityLabel="Log a meal" accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [screen.fab, pressed && screen.fabPressed]}>
          <Icon name="plus" size={26} stroke={2.8} />
        </Pressable>
      </View>
      <NavItem {...NAV_TABS[2]} active={activeTab === 'plans'} onPress={onNavigate} />
      <NavItem {...NAV_TABS[3]} active={activeTab === 'tips'} onPress={onNavigate} />
    </View>
  );
}

function NavItem({ tab, icon, label, active, onPress }: { tab: Tab; icon: IconName; label: string; active: boolean; onPress: (tab: Tab) => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onPress(tab)} style={screen.navItem}>
      <View style={[screen.navIcon, active && screen.navIconOn]}><Icon name={icon} size={21} color={active ? colors.ink : '#8a8f82'} /></View>
      <Text style={[screen.navLabel, active && screen.navActive]}>{label}</Text>
      <View style={[screen.navDot, active && screen.navDotOn]} />
    </Pressable>
  );
}

// ---------- Page 4 · Meal detail ----------

function MealDetail({ meal, type, target, editable, onBack, onEdit, onDelete }: { meal: Meal; type: MealType; target: number; editable: boolean; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
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
      {editable ? (
        <View style={screen.gap10}>
          <PillButton title="Edit meal" variant="dark" icon="pencil" onPress={onEdit} />
          <PillButton title="Delete meal" variant="light" icon="trash" onPress={onDelete} />
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------- Pages 3 & 5 · Add / edit meal sheet ----------

type MealForm = { name: string; cal: string; p: string; c: string; f: string; note: string; type: MealType };
type FormErrors = Partial<Record<'name' | 'cal' | 'p' | 'c' | 'f', string>>;

const toText = (value: number | null) => (value === null ? '' : String(value));

function validate(form: MealForm, requirePreset: boolean, savedFoods: Food[] = []): FormErrors {
  const errors: FormErrors = {};
  const listed = (food: Food) => food.name === form.name;
  if (!form.name.trim() || (requirePreset && !FOODS.some(listed) && !savedFoods.some(listed))) errors.name = 'Choose a food from the list.';
  if (!form.cal.trim()) errors.cal = 'Add calories, even a rough guess.';
  else if (!isWholeNumber(form.cal)) errors.cal = 'Use a whole number, 0 or more.';
  (['p', 'c', 'f'] as const).forEach(key => {
    if (form[key].trim() && !isWholeNumber(form[key])) errors[key] = 'Whole number';
  });
  return errors;
}

function MealSheet({ visible, mode, initialType, meal, onClose, onSaved, onAskFlip }: { visible: boolean; mode: 'add' | 'edit'; initialType: MealType; meal: Meal | null; onClose: () => void; onSaved: (types: MealTypes, mode: 'add' | 'edit') => void; onAskFlip?: (query: string, type: MealType) => void }) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<MealForm>(() =>
    meal
      ? { name: meal.name, cal: toText(meal.caloriesKcal), p: toText(meal.proteinGrams), c: toText(meal.carbsGrams), f: toText(meal.fatGrams), note: meal.note ?? '', type: initialType }
      : { name: '', cal: '', p: '', c: '', f: '', note: '', type: initialType },
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'fail'>('idle');
  const [savedFoods, setSavedFoods] = useState<Food[]>([]);
  // While the food list is open the sheet focuses on it: other fields and the footer step aside.
  const [picking, setPicking] = useState(false);
  const bodyRef = useRef<ScrollViewInstance>(null);
  const saving = status === 'saving';

  useEffect(() => {
    if (picking) bodyRef.current?.scrollTo({ animated: true, y: 0 });
  }, [picking]);

  // Meals confirmed from Flip estimates join the list; the built-in foods still work if this fails.
  useEffect(() => {
    if (!visible || mode !== 'add') return;
    let live = true;
    listFoods().then(foods => { if (live) setSavedFoods(foods.map(foodFromSaved)); }).catch(() => undefined);
    return () => { live = false; };
  }, [visible, mode]);

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
    const nextErrors = validate(form, mode === 'add', savedFoods);
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
      onSaved({}, mode);
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
      <ScrollView ref={bodyRef} style={screen.sheetBody} contentContainerStyle={screen.sheetContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={screen.gap6}>
          <Text style={screen.label14}>Food</Text>
          <FoodPicker value={form.name} error={!!errors.name} savedFoods={savedFoods} onOpenChange={setPicking} onAskFlip={mode === 'add' && onAskFlip ? query => onAskFlip(query, form.type) : undefined} onPick={food => update({ name: food.name, cal: String(food.cal), p: String(food.p), c: String(food.c), f: String(food.f) })} />
          <FieldError message={errors.name} />
        </View>
        {picking ? null : (
          <>
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
          </>
        )}
      </ScrollView>
      {picking ? null : <View style={[screen.sheetFooter, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}>
        {status === 'fail' ? <Banner message="We couldn't save that. Your entries are still here, so just try again." /> : null}
        <PillButton title={status === 'fail' ? 'Retry' : mode === 'edit' ? 'Save changes' : 'Save meal'} busy={saving} busyLabel="Saving…" onPress={submit} />
      </View>}
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

function FoodPicker({ value, error, savedFoods, onAskFlip, onOpenChange, onPick }: { value: string; error: boolean; savedFoods: Food[]; onAskFlip?: (query: string) => void; onOpenChange?: (open: boolean) => void; onPick: (food: Food) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { onOpenChange?.(open); }, [onOpenChange, open]);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = (food: Food) => !q || food.name.toLowerCase().includes(q) || (!!food.saved && food.serving.toLowerCase().includes(q));
  const saved = savedFoods.filter(matches);
  const savedNames = new Set(savedFoods.map(food => food.name.toLowerCase()));
  const common = FOODS.filter(food => !savedNames.has(food.name.toLowerCase()) && matches(food));
  const row = (food: Food) => {
    const on = food.name === value;
    return (
      <Pressable key={`${food.saved ? 'saved' : 'common'}-${food.name}`} accessibilityRole="button" accessibilityLabel={food.name} onPress={() => { onPick(food); setOpen(false); setQuery(''); }} style={({ pressed }) => [screen.foodRow, (on || pressed) && { backgroundColor: on ? colors.selected : colors.bg }]}>
        <View style={screen.grow}>
          <Text style={[screen.mealName, on && screen.bold]} numberOfLines={1}>{food.name}</Text>
          <Text style={[screen.mealTime, on && { color: colors.greenSoft }]} numberOfLines={1}>{food.serving}</Text>
        </View>
        {food.saved ? <Text style={screen.flipTag}>Flip</Text> : null}
        <Text style={[screen.foodCal, on && screen.foodCalOn]}>{formatNumber(food.cal)} kcal</Text>
        {on ? <Icon name="check" size={16} color={colors.greenMid} stroke={3} /> : null}
      </Pressable>
    );
  };
  return (
    <>
      <InputShell error={error} style={screen.foodShell}>
        <Icon name="search" size={17} color={colors.muted} stroke={2.6} />
        <TextInput
          accessibilityLabel="Food"
          value={open ? query : value}
          onChangeText={text => { setQuery(text); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={value || 'Search or choose a food'}
          placeholderTextColor={value ? colors.ink : colors.faint}
          style={screen.foodInput}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Toggle food list" onPress={() => { setOpen(!open); setQuery(''); }} style={screen.chevron} hitSlop={8}>
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
            <Icon name="chevronDown" size={18} color={colors.muted} stroke={2.6} />
          </View>
        </Pressable>
      </InputShell>
      {open ? (
        <View style={screen.picker}>
          <ScrollView style={screen.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {saved.length ? <Text style={screen.pickerSection}>Your meals</Text> : null}
            {saved.map(row)}
            {saved.length && common.length ? <Text style={screen.pickerSection}>Common foods</Text> : null}
            {common.map(row)}
            {!saved.length && !common.length ? (
              <View style={screen.noResultsBox}>
                <Text style={screen.noResults}>No foods match "{query.trim()}"</Text>
                {onAskFlip && q.length >= 3 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ask Flip about ${query.trim()}`} onPress={() => { setOpen(false); onAskFlip(query.trim()); }} style={({ pressed }) => [screen.askFlip, pressed && screen.askFlipPressed]}>
                    <IconTile name="leaf" bg={colors.limeBright} fg={colors.greenDark} size={28} radius={10} iconSize={15} />
                    <Text style={screen.askFlipText} numberOfLines={2}>Ask Flip to estimate “{query.trim()}”</Text>
                    <Icon name="arrowRight" size={16} color={colors.greenDark} stroke={2.6} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

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
  row6: { flexDirection: 'row', gap: 6 },
  row8: { flexDirection: 'row', gap: 8 },
  row10: { flexDirection: 'row', gap: 10 },
  rowCenter10: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap14: { gap: 14 },
  fullWidth: { alignSelf: 'stretch' },
  spacer44: { width: 44 },
  hidden: { display: 'none' },
  fabPressed: { transform: [{ scale: 0.95 }] },
  emptyCardLocal: { backgroundColor: colors.white, borderRadius: 24, gap: 14, paddingHorizontal: 20, paddingVertical: 24 },
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
  skeletonStatus: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', paddingTop: 6 },
  skeletonText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  planLink: { color: colors.greenText, fontSize: 14, fontWeight: '800' },
  insightTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  insightAction: { color: colors.greenDark, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  hero: { backgroundColor: colors.lime, borderRadius: 28, gap: 16, padding: 20 },
  heroEyebrow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  heroEyebrowText: { color: colors.greenDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  kickerText: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  heroNumber: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.7, lineHeight: 38 },
  heroUnit: { color: colors.greenDark, fontSize: 15, fontWeight: '600', letterSpacing: 0 },
  heroSub: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  heroLabel: { color: colors.greenDark, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  heroLeft: { color: colors.greenDark, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  heroUnitSmall: { color: colors.greenDark, fontSize: 13, fontWeight: '600', letterSpacing: 0 },
  gap2: { gap: 2 },
  detailsToggle: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.6)', borderRadius: 99, flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  detailsText: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
  flipped: { transform: [{ rotate: '180deg' }] },
  detailsLinks: { flexDirection: 'row', gap: 20 },
  nudge: { backgroundColor: 'rgba(255,255,255,.7)', borderRadius: 18, gap: 8, padding: 12 },
  countPill: { backgroundColor: colors.pale, borderRadius: 99, color: colors.greenDark, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 },
  mealList: { gap: 2, paddingHorizontal: 8, paddingVertical: 8 },
  mealRow: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 8, paddingVertical: 9 },
  mealRowPressed: { backgroundColor: colors.bg },
  mealName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  mealMeta: { color: colors.muted2, fontSize: 12, marginTop: 2 },
  mealKcal: { color: '#3f443a', fontSize: 14, fontWeight: '700' },
  mealsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  mealTime: { color: colors.muted2, fontSize: 12 },
  nav: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, bottom: 0, boxShadow: '0 -4px 20px rgba(0,0,0,.05)', flexDirection: 'row', left: 0, paddingTop: 12, position: 'absolute', right: 0 },
  navItem: { alignItems: 'center', flex: 1, gap: 3 },
  navIcon: { alignItems: 'center', borderRadius: 14, height: 30, justifyContent: 'center', width: 48 },
  navIconOn: { backgroundColor: colors.selected },
  navLabel: { color: colors.disabled, fontSize: 11 },
  navActive: { color: colors.ink, fontWeight: '700' },
  navDot: { backgroundColor: 'transparent', borderRadius: 3, height: 5, width: 5 },
  navDotOn: { backgroundColor: colors.green },
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
  // Fits above the iPhone keyboard together with the sheet header and search field.
  pickerList: { maxHeight: 250 },
  foodRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 9 },
  foodCal: { color: '#3f443a', fontSize: 13, fontWeight: '600' },
  foodCalOn: { color: colors.greenDark, fontWeight: '700' },
  pickerSection: { color: colors.muted2, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingBottom: 2, paddingHorizontal: 10, paddingTop: 8, textTransform: 'uppercase' },
  flipTag: { backgroundColor: colors.pale, borderRadius: 8, color: colors.greenDark, fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  noResultsBox: { gap: 4, paddingBottom: 6 },
  askFlip: { alignItems: 'center', backgroundColor: colors.pale, borderRadius: 14, flexDirection: 'row', gap: 10, marginHorizontal: 4, paddingHorizontal: 10, paddingVertical: 9 },
  askFlipPressed: { backgroundColor: colors.selected },
  askFlipText: { color: colors.greenDark, flex: 1, fontSize: 14, fontWeight: '800' },
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
