import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { getDashboard } from '../../services/api';
import { MEAL_TYPES, mealCalories, type MealType, mealTypeOf } from '../../features/meals/meals';
import { dateKey, daysAgo, MONTHS, parseDateKey, shortDate, WEEKDAYS } from '../../utils/date';
import { formatNumber } from '../../utils/format';
import type { Dashboard } from '../../types';
import { BackHeader, Card, EmptyCard, ErrorCard, Icon, type IconName, IconTile, InfoNote, MealGroupCard, PillButton, RoundIconButton, Spinner, Toggle, styles as ui } from '../../components/ui';
import { colors } from '../../constants/theme';

type DayStatus = 'ok' | 'over' | 'un';
type Day = { key: string; date: Date; dashboard?: Dashboard; calories: number; status: DayStatus };

const MAX_OFFSET = 12;
const STATUS: Record<DayStatus, { label: string; ink: string; bg: string }> = {
  ok: { label: 'Within target', ink: colors.greenDark, bg: colors.pale },
  over: { label: '', ink: colors.overText, bg: '#fde3cc' },
  un: { label: 'Not logged', ink: '#6f746a', bg: colors.chip },
};

const statusOf = (dashboard: Dashboard | undefined, calories: number, target: number): DayStatus =>
  !dashboard?.meals.length ? 'un' : calories > target ? 'over' : 'ok';

const dayTitle = (key: string) => {
  if (key === dateKey()) return 'Today';
  if (key === dateKey(daysAgo(1))) return 'Yesterday';
  return WEEKDAYS[parseDateKey(key).getDay()];
};

type Props = {
  target: number;
  hasGoal: boolean;
  mealTypes: Record<string, MealType>;
  /** Bumped whenever meals or the goal change, so cached history is refetched. */
  version: number;
  /** Bumped when the Progress tab is tapped again, to pop back to the list. */
  popSignal: number;
  onLogMeal: () => void;
  onSetGoal: () => void;
  onViewDay: (dashboard: Dashboard) => void;
};

/** Page 7 · Progress and Page 8 · Day detail. Stays mounted across tab switches so range, sub-screen and scroll persist. */
export function ProgressScreen({ target, hasGoal, mealTypes, version, popSignal, onLogMeal, onSetGoal, onViewDay }: Props) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<7 | 30>(7);
  const [offset, setOffset] = useState(0);
  const [showUnlogged, setShowUnlogged] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [cache, setCache] = useState<Record<string, Dashboard>>({});
  const [attempt, setAttempt] = useState(0);
  const loadedVersion = useRef(version);

  const keys = Array.from({ length: range }, (_, i) => dateKey(daysAgo(offset * range + range - 1 - i)));
  const keyList = keys.join(',');

  // Fetch the daily dashboards for the visible range; refetch everything after data changes.
  useEffect(() => {
    let cancelled = false;
    const stale = loadedVersion.current !== version;
    const wanted = keyList.split(',');
    const missing = wanted.filter(key => stale || !cache[key]);
    if (!missing.length) return;
    if (wanted.every(key => !cache[key])) setStatus('loading');
    Promise.all(missing.map(key => getDashboard(key)))
      .then(results => {
        if (cancelled) return;
        loadedVersion.current = version;
        setCache(current => {
          const next = stale ? {} : { ...current };
          if (stale) wanted.forEach(key => current[key] && (next[key] = current[key]));
          results.forEach(dashboard => (next[dashboard.date] = dashboard));
          return next;
        });
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
    // `cache` is read as a snapshot on purpose; including it would refetch after every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyList, version, attempt]);

  const firstPop = useRef(popSignal);
  useEffect(() => {
    if (popSignal !== firstPop.current) setOpenDay(null);
  }, [popSignal]);

  const days: Day[] = keys.map(key => {
    const dashboard = cache[key];
    const calories = dashboard?.totalCalories ?? 0;
    return { key, date: parseDateKey(key), dashboard, calories, status: statusOf(dashboard, calories, target) };
  });
  const logged = days.filter(day => day.status !== 'un');
  const within = logged.filter(day => day.status === 'ok');
  const anyLogged = Object.values(cache).some(dashboard => dashboard.meals.length > 0);
  const ready = status === 'ready' && hasGoal && anyLogged && logged.length > 0;
  const unlogged = days.length - logged.length;
  const rows = [...days].reverse().filter(day => range === 7 || showUnlogged || day.status !== 'un');
  const rangeLabel = `${offset === 0 ? `Last ${range} days · ` : ''}${shortDate(days[0].date)} – ${shortDate(days[days.length - 1].date)}`;

  const selected = openDay ? days.find(day => day.key === openDay) : undefined;

  return (
    <View style={ui.flex}>
      <ScrollView style={openDay ? styles.hidden : ui.flex} contentContainerStyle={[ui.tabContent, { paddingTop: insets.top + 14 }]}>
        <View style={styles.header}>
          <View style={ui.grow}>
            <Text style={ui.screenTitle}>Your progress</Text>
            <Text style={styles.subtitle}>{rangeLabel}</Text>
          </View>
          {status === 'ready' && hasGoal && anyLogged ? (
            <View style={styles.row8}>
              <View style={offset >= MAX_OFFSET && styles.dim}>
                <RoundIconButton name="chevronLeft" label="Previous range" size={42} iconSize={18} stroke={2.6} onPress={offset < MAX_OFFSET ? () => setOffset(offset + 1) : undefined} />
              </View>
              <View style={offset === 0 && styles.dim}>
                <RoundIconButton name="chevronRight" label="Next range" size={42} iconSize={18} stroke={2.6} onPress={offset > 0 ? () => setOffset(offset - 1) : undefined} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.segmented}>
          {([7, 30] as const).map(n => (
            <Pressable key={n} accessibilityRole="tab" accessibilityState={{ selected: range === n }} onPress={() => { setRange(n); setOffset(0); }} style={[styles.segment, range === n && styles.segmentOn]}>
              <Text style={[styles.segmentText, range === n && styles.segmentTextOn]}>{n} days</Text>
            </Pressable>
          ))}
        </View>

        {status === 'loading' ? <ProgressSkeleton /> : null}
        {status === 'error' ? <ErrorCard title="Progress didn't load" body="Your meals are safe. We just couldn't fetch your history. Give it another go." onRetry={() => setAttempt(attempt + 1)} style={styles.errorCard} /> : null}
        {status === 'ready' && !hasGoal ? (
          <EmptyCard icon="target" title="Set a daily goal first" body="Progress compares each day with your calorie target. Add one and your history will appear here.">
            <PillButton title="Set my goal" height={52} onPress={onSetGoal} />
          </EmptyCard>
        ) : null}
        {status === 'ready' && hasGoal && !anyLogged ? (
          <EmptyCard icon="chart" title="No progress yet" body="Log your first meal and your progress starts here. One logged day is enough to begin.">
            <PillButton title="Log a meal" icon="plus" height={52} onPress={onLogMeal} />
          </EmptyCard>
        ) : null}
        {status === 'ready' && hasGoal && anyLogged && !logged.length ? (
          <EmptyCard icon="calendarX" tone="muted" title="Nothing logged in this range" body={`No meals were logged during these ${range} days.`}>
            {offset > 0 ? <PillButton title="Back to latest" variant="dark" height={52} onPress={() => setOffset(0)} /> : <PillButton title="Log a meal" icon="plus" height={52} onPress={onLogMeal} />}
          </EmptyCard>
        ) : null}

        {ready ? (
          <>
            {logged.length < 3 ? <InfoNote tone="lime" text={`You've logged ${logged.length} ${logged.length === 1 ? 'day' : 'days'} in this range. Each day you log adds a point to your trend.`} /> : null}
            <Card style={styles.stats}>
              <StatRow icon="flame" bg={colors.carbsBg} fg="#c27a12" title="Average calories" sub="Per logged day" value={formatNumber(Math.round(logged.reduce((t, d) => t + d.calories, 0) / logged.length))} unit="kcal" />
              <StatRow icon="calendarCheck" bg={colors.fatBg} fg="#2f72b5" title="Days logged" sub="In this range" value={`${logged.length} of ${range}`} divider />
              <StatRow icon="target" bg={colors.pale} fg={colors.greenText} title="Days within target" sub={`At or under ${formatNumber(target)} kcal`} value={`${within.length} of ${logged.length}`} divider />
            </Card>
            <Card style={styles.gap12}>
              <View style={styles.cardHeader}>
                <Text style={ui.headline}>Calorie trend</Text>
                <Text style={ui.mealTime}>Daily total vs target</Text>
              </View>
              <TrendChart days={days} target={target} />
              <View style={styles.legend}>
                <Legend color={colors.green} label="Within target" />
                <Legend color={colors.over} label="Over target" />
                <Legend outline label="Not logged" />
              </View>
            </Card>
            <Card style={styles.log}>
              <View style={[styles.cardHeader, styles.logHeader]}>
                <Text style={ui.headline}>Daily log</Text>
                <Text style={ui.mealTime}>Tap a day for details</Text>
              </View>
              {range > 7 && unlogged > 0 ? (
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: showUnlogged }} onPress={() => setShowUnlogged(!showUnlogged)} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>
                    {showUnlogged ? 'Hide' : 'Show'} {unlogged} unlogged {unlogged === 1 ? 'day' : 'days'}
                  </Text>
                  <Toggle on={showUnlogged} />
                </Pressable>
              ) : null}
              {rows.map(day => (
                <DayRow key={day.key} day={day} target={target} onPress={() => setOpenDay(day.key)} />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>

      {openDay ? (
        <DayDetail
          key={openDay}
          dayKey={openDay}
          dashboard={selected?.dashboard}
          target={target}
          mealTypes={mealTypes}
          onBack={() => setOpenDay(null)}
          onViewDay={onViewDay}
        />
      ) : null}
    </View>
  );
}

function ProgressSkeleton() {
  return (
    <View style={styles.gap14}>
      <Card style={styles.skeletonStats}>
        {[0, 1, 2].map(i => (
          <View key={i} style={ui.rowCenter12}>
            <View style={styles.skeletonDot} />
            <View style={[ui.grow, ui.gap6]}>
              <View style={[styles.skeletonLine, styles.w58]} />
              <View style={[styles.skeletonLine, styles.skeletonLineSoft]} />
            </View>
            <View style={styles.skeletonValue} />
          </View>
        ))}
      </Card>
      <Card style={styles.gap14}>
        <View style={[styles.skeletonLine, styles.skeletonHeading]} />
        <View style={styles.skeletonChart} />
      </Card>
      <View style={styles.skeletonBlock} />
      <View style={styles.loadingRow}>
        <Spinner color={colors.muted} />
        <Text style={styles.loadingText}>Loading your progress…</Text>
      </View>
    </View>
  );
}

function StatRow({ icon, bg, fg, title, sub, value, unit, divider = false }: { icon: IconName; bg: string; fg: string; title: string; sub: string; value: string; unit?: string; divider?: boolean }) {
  return (
    <View style={[styles.statRow, divider && styles.divider]}>
      <IconTile name={icon} bg={bg} fg={fg} size={40} radius={20} iconSize={19} stroke={2.6} />
      <View style={ui.grow}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={ui.mealTime}>{sub}</Text>
      </View>
      <Text style={styles.statValue}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function Legend({ color, label, outline = false }: { color?: string; label: string; outline?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, outline ? styles.legendOutline : { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function TrendChart({ days, target }: { days: Day[]; target: number }) {
  const [width, setWidth] = useState(0);
  const n = days.length;
  const todayKey = dateKey();
  const maxY = Math.max(target * 1.25, ...days.map(day => day.calories * 1.08));
  const y = (value: number) => 130 - (value / maxY) * 112;
  const x = (i: number) => ((i + 0.5) * width) / n;
  const r = n > 7 ? 3.5 : 5.5;
  let line = '';
  days.forEach((day, i) => {
    if (day.status === 'un') return;
    const joined = i > 0 && days[i - 1].status !== 'un';
    line += `${joined ? 'L' : 'M'}${x(i).toFixed(1)},${y(day.calories).toFixed(1)}`;
  });
  const label = (day: Day, i: number) => {
    if (n <= 7) return day.key === todayKey ? 'Today' : WEEKDAYS[day.date.getDay()].slice(0, 3);
    return (n - 1 - i) % 7 === 0 ? (day.key === todayKey ? 'Today' : shortDate(day.date)) : '';
  };
  return (
    <View style={ui.gap6} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width ? (
        <Svg width={width} height={140}>
          <Line x1={0} x2={width} y1={130} y2={130} stroke="#eceee7" strokeWidth={1.5} />
          <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={colors.ink} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 5" />
          <SvgText x={width} y={y(target) - 6} textAnchor="end" fontSize={11} fontWeight="600" fill={colors.muted}>
            Target {formatNumber(target)}
          </SvgText>
          {line ? <Path d={line} fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}
          {days.map((day, i) =>
            day.status === 'un' ? (
              <Circle key={day.key} cx={x(i)} cy={130} r={r} fill={colors.white} stroke={colors.disabled} strokeWidth={1.75} />
            ) : (
              <Circle key={day.key} cx={x(i)} cy={y(day.calories)} r={r} fill={day.status === 'over' ? colors.over : colors.green} stroke={colors.white} strokeWidth={2} />
            ),
          )}
        </Svg>
      ) : (
        <View style={styles.chartPlaceholder} />
      )}
      <View style={styles.row}>
        {days.map((day, i) => (
          <Text key={day.key} numberOfLines={1} style={styles.axisLabel}>
            {label(day, i)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function DayRow({ day, target, onPress }: { day: Day; target: number; onPress: () => void }) {
  const tone = STATUS[day.status];
  const meals = day.dashboard?.meals.length ?? 0;
  const sub = day.status === 'un' ? (day.key === dateKey() ? 'Nothing logged yet' : 'No meals logged') : `${meals} ${meals === 1 ? 'meal' : 'meals'} · target ${formatNumber(target)}`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.dayRow, pressed && { backgroundColor: colors.bg }]}>
      <View style={[styles.dateTile, { backgroundColor: tone.bg }]}>
        <Text style={[styles.dateNum, { color: tone.ink }]}>{day.date.getDate()}</Text>
        <Text style={[styles.dateMonth, { color: tone.ink }]}>{MONTHS[day.date.getMonth()]}</Text>
      </View>
      <View style={ui.grow}>
        <Text style={styles.statTitle}>{dayTitle(day.key)}</Text>
        <Text style={ui.mealTime}>{sub}</Text>
      </View>
      <View style={styles.dayRight}>
        <Text style={styles.statTitle}>{day.status === 'un' ? '—' : `${formatNumber(day.calories)} kcal`}</Text>
        <Text style={[styles.dayStatus, { color: tone.ink }]}>{day.status === 'over' ? `${formatNumber(day.calories - target)} kcal over` : tone.label}</Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} />
    </Pressable>
  );
}

function DayDetail({ dayKey, dashboard, target, mealTypes, onBack, onViewDay }: { dayKey: string; dashboard?: Dashboard; target: number; mealTypes: Record<string, MealType>; onBack: () => void; onViewDay: (dashboard: Dashboard) => void }) {
  const insets = useSafeAreaInsets();
  const date = parseDateKey(dayKey);
  const meals = [...(dashboard?.meals ?? [])].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  const calories = dashboard?.totalCalories ?? mealCalories(meals);
  const over = calories > target;
  const ink = over ? '#8a3c0e' : colors.greenDark;
  const groups = MEAL_TYPES.map(type => ({ ...type, meals: meals.filter(meal => mealTypeOf(meal, mealTypes) === type.id) }));
  const missing = groups.filter(group => !group.meals.length).map(group => group.label);
  return (
    <ScrollView style={ui.flex} contentContainerStyle={[ui.tabContent, { paddingTop: insets.top + 8 }]}>
      <BackHeader title={`${dayKey === dateKey() ? 'Today' : WEEKDAYS[date.getDay()]}, ${shortDate(date)}`} onBack={onBack} />
      {meals.length ? (
        <>
          <View style={[styles.dayHero, over && styles.dayHeroOver]}>
            <Text style={[styles.dayKicker, { color: ink }]}>
              {over ? 'Over target' : 'Within target'} · {meals.length} {meals.length === 1 ? 'meal' : 'meals'}
            </Text>
            <View style={styles.dayHeroRow}>
              <View style={ui.gap4}>
                <Text style={styles.dayCal}>
                  {formatNumber(calories)} <Text style={[styles.dayUnit, { color: ink }]}>kcal</Text>
                </Text>
                <Text style={[ui.small, { color: ink }]}>of {formatNumber(target)} kcal target</Text>
              </View>
              <View style={styles.diffBox}>
                <Text style={styles.diffValue}>{formatNumber(Math.abs(target - calories))}</Text>
                <Text style={[styles.diffLabel, { color: ink }]}>{over ? 'kcal over' : 'kcal under'}</Text>
              </View>
            </View>
            <View style={styles.dayTrack}>
              <View style={[styles.dayFill, { width: `${Math.min(100, Math.round((calories / target) * 100))}%`, backgroundColor: over ? colors.over : colors.green }]} />
            </View>
          </View>
          {groups.map(group => (group.meals.length ? <MealGroupCard key={group.id} type={group.id} label={group.label} meals={group.meals} /> : null))}
          {missing.length ? <Text style={styles.missing}>Not logged: {missing.join(', ')}</Text> : null}
        </>
      ) : (
        <EmptyCard icon="calendarX" tone="muted" title="Nothing logged" body={`No meals were logged on this day, so it is not counted in your averages. Your target was ${formatNumber(target)} kcal.`} />
      )}
      {dashboard ? <PillButton title="View full day" variant="dark" trailingIcon="arrowRight" style={styles.viewDay} onPress={() => onViewDay(dashboard)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  dim: { opacity: 0.35 },
  row: { flexDirection: 'row' },
  row8: { flexDirection: 'row', gap: 8 },
  gap12: { gap: 12 },
  gap14: { gap: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  subtitle: { color: colors.muted, fontSize: 14 },
  segmented: { backgroundColor: colors.white, borderRadius: 99, flexDirection: 'row', gap: 4, padding: 4 },
  segment: { alignItems: 'center', borderRadius: 99, flex: 1, height: 40, justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.ink },
  segmentText: { color: '#3f443a', fontSize: 14, fontWeight: '700' },
  segmentTextOn: { color: colors.white },
  errorCard: { marginTop: 12, paddingHorizontal: 22, paddingVertical: 28 },
  stats: { gap: 0, paddingVertical: 4 },
  statRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 12 },
  divider: { borderTopColor: colors.chip, borderTopWidth: 1 },
  statTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  statValue: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  statUnit: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  cardHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  chartPlaceholder: { height: 140 },
  axisLabel: { color: colors.muted2, flex: 1, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  legend: { columnGap: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendDot: { borderRadius: 5, height: 9, width: 9 },
  legendOutline: { borderColor: colors.disabled, borderWidth: 1.75 },
  legendText: { color: colors.muted, fontSize: 12 },
  log: { gap: 4, paddingBottom: 8, paddingHorizontal: 8, paddingTop: 16 },
  logHeader: { paddingBottom: 6, paddingHorizontal: 8 },
  toggleRow: { alignItems: 'center', backgroundColor: colors.bg, borderRadius: 14, flexDirection: 'row', gap: 10, marginBottom: 6, marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 10 },
  toggleLabel: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '600' },
  dayRow: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 8, paddingVertical: 10 },
  dateTile: { alignItems: 'center', borderRadius: 14, height: 48, justifyContent: 'center', width: 46 },
  dateNum: { fontSize: 17, fontWeight: '800', lineHeight: 19 },
  dateMonth: { fontSize: 11, fontWeight: '600', lineHeight: 13 },
  dayRight: { alignItems: 'flex-end', gap: 2 },
  dayStatus: { fontSize: 12, fontWeight: '600' },
  skeletonStats: { gap: 18 },
  skeletonDot: { backgroundColor: '#eceee7', borderRadius: 20, height: 40, width: 40 },
  skeletonLine: { backgroundColor: '#eceee7', borderRadius: 9, height: 11 },
  skeletonLineSoft: { backgroundColor: '#f2f3ee', height: 9, width: '34%' },
  skeletonHeading: { height: 14, width: '42%' },
  w58: { width: '58%' },
  skeletonValue: { backgroundColor: '#eceee7', borderRadius: 9, height: 16, width: 56 },
  skeletonChart: { backgroundColor: '#f2f6e8', borderRadius: 16, height: 150 },
  skeletonBlock: { backgroundColor: '#eceee7', borderRadius: 20, height: 68 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  dayHero: { backgroundColor: colors.lime, borderRadius: 28, gap: 14, padding: 20 },
  dayHeroOver: { backgroundColor: '#fde3cc' },
  dayKicker: { fontSize: 13, fontWeight: '700' },
  dayHeroRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  dayCal: { color: colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1.2, lineHeight: 42 },
  dayUnit: { fontSize: 15, fontWeight: '600', letterSpacing: 0 },
  diffBox: { alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,.75)', borderRadius: 16, gap: 2, paddingHorizontal: 14, paddingVertical: 10 },
  diffValue: { color: colors.ink, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  diffLabel: { fontSize: 12, fontWeight: '700' },
  dayTrack: { backgroundColor: 'rgba(255,255,255,.7)', borderRadius: 9, height: 8, overflow: 'hidden' },
  dayFill: { borderRadius: 9, height: '100%' },
  missing: { color: colors.muted2, fontSize: 13, paddingHorizontal: 6 },
  viewDay: { marginTop: 4 },
});
