import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GOALS } from '../../features/meals/meals';
import { isWholeNumber } from '../../utils/validation';
import type { GoalType } from '../../types';
import { Banner, Card, FieldError, Icon, type IconName, IconTile, InputShell, PillButton, RoundIconButton, styles as ui } from '../../components/ui';
import { colors } from '../../constants/theme';

const goalIcons: Record<GoalType, IconName> = { lose: 'trendDown', maintain: 'equals', gain: 'trendUp' };

export function GoalSetupScreen({ initial, editing, onCancel, onSave }: { initial?: { dailyCalorieTarget: number; type: GoalType }; editing: boolean; onCancel?: () => void; onSave: (goal: { dailyCalorieTarget: number; type: GoalType }) => Promise<void> }) {
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

const screen = StyleSheet.create({
  grow: { flex: 1, gap: 2, minWidth: 0 },
  row8: { flexDirection: 'row', gap: 8 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 13 },
  label15: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  unit: { color: colors.muted, fontSize: 15, fontWeight: '600' },
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
});
