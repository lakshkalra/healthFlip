import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, AppState, Linking, Platform, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { type DailyInsight, deleteMeal, getCurrentGoal, getDailyInsight, getDashboard, getProfile, logWater, resetGuest, saveGoal, setWaterTarget, undoWater } from '../services/api';
import { LogMealScreen } from '../screens/log-meal/LogMealScreen';
import { AskFlipPill, FlipReveal, type RevealOrigin } from '../components/flip/FlipReveal';
import type { HomeHealthActions } from '../components/health/HealthCards';
import { firstName, type OnboardingStep } from '../components/profile/ProfileForm';
import { OnboardingChatScreen } from '../screens/onboarding/OnboardingChatScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { VoiceScreen } from '../screens/voice/VoiceScreen';
import { ProgressScreen } from '../screens/progress/ProgressScreen';
import { PlansScreen } from '../screens/plans/PlansScreen';
import { applyWaterReminders, clearAllReminders, DEFAULT_REMINDERS, loadReminderSettings, nextReminder, type ReminderSettings, saveReminderSettings } from '../features/reminders/waterReminders';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { TipsScreen } from '../screens/tips/TipsScreen';
import { clearWidget, syncWidget } from '../features/widget/widgetSync';
import { notificationStatus, takeLaunchURL, updateWidget } from '../services/native/healthFlipNative';
import { type MealType, mealTypeOf, typeForHour } from '../features/meals/meals';
import { dateKey } from '../utils/date';
import type { Dashboard, GoalType, Profile } from '../types';
import { Toast, styles as ui } from '../components/ui';
import { colors } from '../constants/theme';
import { BottomNav } from './navigation/BottomNav';
import type { BootState, DashState, MealTypes, Route, Tab } from './types';
import { BootScreen } from '../screens/boot/BootScreen';
import { GoalSetupScreen } from '../screens/goal/GoalSetupScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { DeleteMealDialog } from '../screens/meal/DeleteMealDialog';
import { MealDetailScreen } from '../screens/meal/MealDetailScreen';
import { MealSheet } from '../screens/meal/MealSheet';

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
        <OnboardingChatScreen
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
      {route === 'goal' ? <GoalSetupScreen initial={editingGoal ?? undefined} editing={!!editingGoal} onCancel={() => { setEditingGoal(null); setRoute('home'); }} onSave={handleGoalSaved} /> : null}
      {activeTab ? (
        <>
          <View style={[ui.flex, activeTab === 'home' ? null : screen.hidden]}>
            <HomeScreen
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
        <LogMealScreen
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
        <MealDetailScreen
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
      <DeleteMealDialog key={`delete-${deleteDialog.key}`} visible={deleteDialog.open} meal={selected} onCancel={() => setDeleteDialog(current => ({ ...current, open: false }))} onDelete={handleDelete} />

      <FlipReveal open={flip.open} instantClose={flip.instant} origin={flip.origin}>
        <VoiceScreen
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

const screen = StyleSheet.create({
  hidden: { display: 'none' },
  toastSlot: { left: 0, position: 'absolute', right: 0, zIndex: 80 },
});

export default App;
