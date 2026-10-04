import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader, Card, EmptyCard, Icon, type IconName, IconTile, InfoNote, PillButton, styles as ui } from '../../components/ui';
import { colors } from '../../constants/theme';

type Category = 'Nutrition' | 'Meal planning' | 'Hydration' | 'Consistency' | 'Mindful eating';
export const TIP_CATEGORIES: Category[] = ['Nutrition', 'Meal planning', 'Hydration', 'Consistency', 'Mindful eating'];

type Tip = {
  id: string;
  category: Category;
  title: string;
  preview: string;
  body: string[];
  action: string;
  tryText: string;
};

const CATEGORY: Record<Category, { icon: IconName; bg: string; fg: string; ink: string; soft: string }> = {
  Nutrition: { icon: 'nutrition', bg: colors.pale, fg: colors.greenText, ink: colors.greenDark, soft: '#eef8dc' },
  'Meal planning': { icon: 'calendarCheck', bg: colors.carbsBg, fg: '#b06c0e', ink: '#7f4c06', soft: '#fdf3e0' },
  Hydration: { icon: 'droplet', bg: colors.fatBg, fg: '#2f72b5', ink: '#24598e', soft: '#e9f3fc' },
  Consistency: { icon: 'repeat', bg: colors.proteinBg, fg: colors.protein, ink: '#5c3aa3', soft: '#f3eefc' },
  'Mindful eating': { icon: 'leaf', bg: '#fde4d4', fg: '#b0552a', ink: '#8f4220', soft: '#fdeee4' },
};

const TIPS: Tip[] = [
  {
    id: 'protein',
    category: 'Nutrition',
    title: 'Build meals around protein and fiber',
    preview: 'Starting with these two makes meals more filling and easier to plan.',
    body: [
      'Protein and fiber both take longer to digest, so meals built around them tend to keep you satisfied for longer. That can make the gap between meals feel more comfortable.',
      'Protein shows up in foods like dal, paneer, eggs, curd, tofu, chicken and fish. Fiber comes from vegetables, fruit, whole grains, beans and lentils.',
      "You don't need to measure anything. Choosing one of each when you put a plate together is a simple starting point, and the rest of the meal can fill in around them.",
      'A few easy pairings: dal with a side salad, eggs with whole-wheat toast, curd with fruit, or rajma with brown rice.',
      'If a meal leaves you hungry soon after, adding a protein or fiber source is often a more satisfying fix than a bigger portion of everything.',
    ],
    action: 'When you build your next plate, choose a protein first, then add a vegetable or whole grain beside it.',
    tryText: 'Add one extra vegetable to your lunch today.',
  },
  {
    id: 'breakfast',
    category: 'Meal planning',
    title: 'Keep a repeatable breakfast for busy mornings',
    preview: 'One reliable default saves a decision when time is short.',
    body: [
      'Mornings are often when routines slip. Having one breakfast you can make without thinking removes a decision at the busiest point of the day.',
      'It also makes logging quicker, since the same meal can be picked from the list in a couple of taps.',
    ],
    action: 'Pick one breakfast you enjoy and can make in under ten minutes. Keep its ingredients stocked.',
    tryText: "Decide tonight what tomorrow's breakfast will be.",
  },
  {
    id: 'approx',
    category: 'Consistency',
    title: 'Approximate logging is better than skipping a meal',
    preview: 'A rough entry keeps your day complete and your trend useful.',
    body: [
      "It's easy to skip logging when you're unsure of exact amounts. A best guess still gives a clearer picture of your day than a blank.",
      "Over a week, small estimation differences tend to even out. Missing meals don't.",
    ],
    action: 'If you are unsure, pick the closest food and adjust the calories to a reasonable guess.',
    tryText: 'Log your next meal within 15 minutes of eating, even if it is an estimate.',
  },
  {
    id: 'onemeal',
    category: 'Mindful eating',
    title: 'One high-calorie meal does not ruin your day',
    preview: 'Your overall pattern matters more than any single meal.',
    body: [
      'Celebrations, travel and eating out are part of normal life. A single larger meal is one point in a much longer pattern.',
      'Logging it honestly and carrying on with your usual routine is more helpful than trying to make up for it.',
    ],
    action: 'Log the meal as it was, then plan your next meal the way you normally would.',
    tryText: 'Notice how you feel after your next meal, without judging it.',
  },
  {
    id: 'water',
    category: 'Hydration',
    title: 'Keep water accessible throughout the day',
    preview: "Water within reach is water you're more likely to drink.",
    body: [
      "Thirst is easy to overlook when you're busy. Keeping water in sight is a simple reminder to drink regularly.",
      'A refillable bottle at your desk, in your bag or by the stove turns it into a default rather than a decision.',
    ],
    action: 'Keep a filled water bottle wherever you spend most of your day.',
    tryText: 'Refill your bottle each time you log a meal.',
  },
  {
    id: 'plan',
    category: 'Meal planning',
    title: 'Plan one easy meal before the day gets busy',
    preview: 'A little planning early takes pressure off later.',
    body: [
      'Later in the day, energy for decisions runs low and the most convenient option usually wins. Deciding on one meal earlier takes that pressure off.',
      'It does not need to be elaborate. Knowing what dinner will be, or having leftovers ready, is enough.',
    ],
    action: 'Each morning, choose one meal for the day and check you have what you need for it.',
    tryText: "Pick tonight's dinner before lunch.",
  },
];

const DISCLAIMER = 'General wellness tips, not medical advice. For guidance on a health condition, talk to a qualified professional.';

type Props = { popSignal: number };

/** Page 9 · Tips. Kept mounted across tab switches so the chosen filter, detail and scroll stay. */
export function TipsScreen({ popSignal }: Props) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'All' | Category>('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const list = filter === 'All' ? TIPS : TIPS.filter(tip => tip.category === filter);
  const firstPop = useRef(popSignal);
  useEffect(() => {
    if (popSignal !== firstPop.current) setOpenId(null);
  }, [popSignal]);

  const open = openId ? TIPS.find(tip => tip.id === openId) ?? null : null;

  return (
    <View style={ui.flex}>
      <ScrollView style={open ? styles.hidden : ui.flex} contentContainerStyle={[ui.tabContent, { paddingTop: insets.top + 14 }]}>
        <View style={ui.gap6}>
          <Text style={ui.screenTitle}>Tips for you</Text>
          <Text style={styles.lede}>Small, practical habits that make eating well easier to keep up.</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {(['All', ...TIP_CATEGORIES] as const).map(label => {
            const on = filter === label;
            return (
              <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setFilter(label)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {list.length ? (
          list.map(tip => <TipCard key={tip.id} tip={tip} onOpen={() => setOpenId(tip.id)} />)
        ) : (
          <EmptyCard icon="lightbulb" tone="muted" centered title={`No ${filter} tips yet`} body="We are adding more soon. There is plenty to read in the other categories.">
            <PillButton title="Show all tips" variant="dark" height={48} onPress={() => setFilter('All')} />
          </EmptyCard>
        )}
        <InfoNote text={DISCLAIMER} />
      </ScrollView>

      {open ? <TipDetail key={open.id} tip={open} tried={!!tried[open.id]} onBack={() => setOpenId(null)} onToggleTry={() => setTried(current => ({ ...current, [open.id]: !current[open.id] }))} /> : null}
    </View>
  );
}

function TipCard({ tip, onOpen }: { tip: Tip; onOpen: () => void }) {
  const style = CATEGORY[tip.category];
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <IconTile name={style.icon} bg={style.bg} fg={style.fg} size={48} radius={24} />
      <View style={ui.grow}>
        <Text style={[styles.cardCategory, { color: style.ink }]}>{tip.category}</Text>
        <Text style={styles.cardTitle}>{tip.title}</Text>
        <Text style={styles.cardPreview}>{tip.preview}</Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} />
    </Pressable>
  );
}

function TipDetail({ tip, tried, onBack, onToggleTry }: { tip: Tip; tried: boolean; onBack: () => void; onToggleTry: () => void }) {
  const insets = useSafeAreaInsets();
  const style = CATEGORY[tip.category];
  return (
    <ScrollView style={ui.flex} contentContainerStyle={[ui.tabContent, { paddingTop: insets.top + 8 }]}>
      <BackHeader title="Tip" onBack={onBack} />
      <View style={[styles.hero, { backgroundColor: style.soft }]}>
        <View style={ui.rowCenter12}>
          <IconTile name={style.icon} bg={colors.white} fg={style.fg} size={44} radius={22} />
          <Text style={[styles.heroCategory, { color: style.ink, backgroundColor: style.bg }]}>{tip.category}</Text>
        </View>
        <Text style={styles.heroTitle}>{tip.title}</Text>
      </View>
      <Card style={ui.gap8}>
        <Text style={styles.sectionLabel}>Why it helps</Text>
        {tip.body.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </Card>
      <Card style={styles.action}>
        <IconTile name="check" bg={colors.pale} fg={colors.greenText} size={36} radius={18} iconSize={18} stroke={2.6} />
        <View style={ui.grow}>
          <Text style={styles.sectionLabel}>Practical action</Text>
          <Text style={styles.actionText}>{tip.action}</Text>
        </View>
      </Card>
      <View style={styles.tryCard}>
        <View style={ui.gap4}>
          <Text style={styles.tryLabel}>Try this today</Text>
          <Text style={styles.tryText}>{tip.tryText}</Text>
        </View>
        {tried ? (
          <PillButton title="On your list for today" variant="light" icon="check" height={48} style={styles.triedButton} onPress={onToggleTry} />
        ) : (
          <PillButton title="I'll try this" variant="dark" height={48} onPress={onToggleTry} />
        )}
      </View>
      <InfoNote text={DISCLAIMER} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  lede: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  chipScroll: { flexGrow: 0, marginHorizontal: -18 },
  chipRow: { gap: 8, paddingHorizontal: 18 },
  chip: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 99, flexDirection: 'row', height: 40, paddingHorizontal: 16 },
  chipOn: { backgroundColor: colors.ink },
  chipText: { color: '#3f443a', fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: colors.white, fontWeight: '700' },
  card: { alignItems: 'flex-start', backgroundColor: colors.white, borderRadius: 24, flexDirection: 'row', gap: 14, padding: 16 },
  cardPressed: { boxShadow: '0 0 0 1.5px #dfe8cc' },
  cardCategory: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 21, marginBottom: 4 },
  cardPreview: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hero: { borderRadius: 28, gap: 14, padding: 22 },
  heroCategory: { borderRadius: 99, fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 5 },
  heroTitle: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30 },
  sectionLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  paragraph: { color: '#2c3029', fontSize: 15, lineHeight: 23 },
  action: { flexDirection: 'row', gap: 12 },
  actionText: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  tryCard: { backgroundColor: colors.lime, borderRadius: 24, gap: 14, padding: 18 },
  tryLabel: { color: colors.greenDark, fontSize: 13, fontWeight: '700' },
  tryText: { color: colors.ink, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  triedButton: { backgroundColor: 'rgba(255,255,255,.8)' },
});
