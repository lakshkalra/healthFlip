import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DailyInsight } from '../../services/api';
import { HealthRow, type HomeHealthActions, WaterCard } from '../../components/health/HealthCards';
import { goalLabel, macroTargets, mealTypeLabel, mealTypeOf } from '../../features/meals/meals';
import { formatNumber, formatTime } from '../../utils/format';
import type { Dashboard, Meal } from '../../types';
import { Banner, Card, ErrorCard, Icon, IconTile, MacroBar, MealTypeTile, PillButton, ProgressRing, RoundIconButton, Spinner, styles as ui } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { DashState, MealTypes } from '../../app/types';

const DETAILS_KEY = 'healthflip.homeDetails';

export function HomeScreen({ dashboard, state, insight, insightState, target, mealTypes, viewing, userName, health, onLogMeal, onOpenMeal, onBackToToday, onRefresh, onRetry, onInsightRetry, onEditGoal, onOpenProfile, onRecalculate }: { dashboard: Dashboard | null; state: DashState; insight: DailyInsight | null; insightState: 'idle' | 'loading' | 'ready' | 'error'; target: number; mealTypes: MealTypes; viewing: Dashboard | null; userName: string | null; health: HomeHealthActions; onLogMeal: () => void; onOpenMeal: (meal: Meal) => void; onBackToToday: () => void; onRefresh: () => void; onRetry: () => void; onInsightRetry: () => void; onEditGoal: () => void; onOpenProfile: () => void; onRecalculate: () => void }) {
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

      {!viewing && state === 'loading' ? <HomeSkeleton /> : null}
      {!viewing && (state === 'error' || (!dashboard && state === 'fail')) ? (
        <ErrorCard title="Today didn't load" body="Your meals are safe. We just couldn't fetch them. Give it another go." onRetry={onRetry} style={screen.dashError} />
      ) : null}
      {hasContent && dashboard ? (
        <>
          {!viewing && state === 'fail' ? <Banner message="Couldn't refresh. Showing your last update." onRetry={onRefresh} /> : null}
          <HomeContent dashboard={dashboard} health={health} insight={insight} insightState={insightState} target={target} mealTypes={mealTypes} viewing={!!viewing} onLogMeal={onLogMeal} onOpenMeal={onOpenMeal} onInsightRetry={onInsightRetry} onEditGoal={onEditGoal} onRecalculate={onRecalculate} />
        </>
      ) : null}
    </ScrollView>
  );
}

function HomeSkeleton() {
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

function HomeContent({ dashboard, health, insight, insightState, target, mealTypes, viewing, onLogMeal, onOpenMeal, onInsightRetry, onEditGoal, onRecalculate }: { dashboard: Dashboard; health: HomeHealthActions; insight: DailyInsight | null; insightState: 'idle' | 'loading' | 'ready' | 'error'; target: number; mealTypes: MealTypes; viewing: boolean; onLogMeal: () => void; onOpenMeal: (meal: Meal) => void; onInsightRetry: () => void; onEditGoal: () => void; onRecalculate: () => void }) {
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

const screen = StyleSheet.create({
  grow: { flex: 1, gap: 2, minWidth: 0 },
  row8: { flexDirection: 'row', gap: 8 },
  rowCenter10: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  gap6: { gap: 6 },
  gap10: { gap: 10 },
  gap14: { gap: 14 },
  emptyCardLocal: { backgroundColor: colors.white, borderRadius: 24, gap: 14, paddingHorizontal: 20, paddingVertical: 24 },
  body14: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 13 },
  headline: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  greeting: { alignItems: 'center', flexDirection: 'row', gap: 12 },
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
});
