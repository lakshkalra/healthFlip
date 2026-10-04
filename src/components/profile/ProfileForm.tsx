import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ActivityLevel, Profile, Sex } from '../../types';
import { Banner, FieldError, Icon, IconTile, InputShell, NumberInput, PillButton } from '../ui';
import { colors } from '../../constants/theme';

export type OnboardingStep = 'about' | 'goal' | 'plan';

const SEXES: { id: Sex; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'unspecified', label: 'Prefer not to say' },
];
const ACTIVITY: { desc: string; id: ActivityLevel; label: string }[] = [
  { desc: 'Mostly sitting, little exercise', id: 'sedentary', label: 'Sedentary' },
  { desc: 'Light walks or 1–2 workouts a week', id: 'light', label: 'Lightly active' },
  { desc: 'On your feet often or 3–4 workouts', id: 'moderate', label: 'Moderately active' },
  { desc: 'Daily training or a physical job', id: 'active', label: 'Very active' },
];


/** Name, age, sex, height, weight and activity, with inline validation. Reused by the Profile screen. */
export function ProfileForm({ initial, onSubmit, submitLabel }: { initial: Profile | null; onSubmit: (profile: Profile) => Promise<void>; submitLabel: string }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(initial ? String(initial.age) : '');
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'unspecified');
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : '');
  const [activity, setActivity] = useState<ActivityLevel>(initial?.activityLevel ?? 'light');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'fail'>('idle');

  const submit = async () => {
    if (status === 'saving') return;
    const next: Record<string, string> = {};
    const ageValue = Number(age);
    const heightValue = Number(height.replace(',', '.'));
    const weightValue = Number(weight.replace(',', '.'));
    if (!name.trim()) next.name = 'What should Flip call you?';
    if (!/^\d+$/.test(age.trim()) || ageValue < 18 || ageValue > 100) next.age = 'healthFlip plans are for adults aged 18 to 100.';
    if (!height.trim() || !Number.isFinite(heightValue) || heightValue < 120 || heightValue > 230) next.height = 'Enter your height in cm (120–230).';
    if (!weight.trim() || !Number.isFinite(weightValue) || weightValue < 30 || weightValue > 300) next.weight = 'Enter your weight in kg (30–300).';
    setErrors(next);
    if (Object.keys(next).length) return;
    setStatus('saving');
    try {
      await onSubmit({ activityLevel: activity, age: ageValue, heightCm: heightValue, name: name.trim(), sex, weightKg: weightValue });
      setStatus('idle');
    } catch {
      setStatus('fail');
    }
  };

  const clear = (key: string) => setErrors(current => ({ ...current, [key]: '' }));

  return (
    <View style={styles.gap16}>
      <Field label="Your name" error={errors.name}>
        <InputShell error={!!errors.name} style={styles.shell}>
          <TextInput accessibilityLabel="Your name" value={name} onChangeText={text => { setName(text); clear('name'); }} placeholder="e.g. Priya" placeholderTextColor={colors.faint} autoCapitalize="words" maxLength={60} style={styles.textInput} />
        </InputShell>
      </Field>
      <View style={styles.row}>
        <Field label="Age" error={errors.age} grow>
          <InputShell error={!!errors.age} style={styles.shell}>
            <NumberInput accessibilityLabel="Age" value={age} onChangeText={text => { setAge(text); clear('age'); }} placeholder="30" maxLength={3} style={styles.textInput} />
            <Text style={styles.unit}>yrs</Text>
          </InputShell>
        </Field>
        <Field label="Height" error={errors.height} grow>
          <InputShell error={!!errors.height} style={styles.shell}>
            <NumberInput accessibilityLabel="Height in centimetres" value={height} onChangeText={text => { setHeight(text); clear('height'); }} placeholder="170" keyboardType="decimal-pad" maxLength={5} style={styles.textInput} />
            <Text style={styles.unit}>cm</Text>
          </InputShell>
        </Field>
        <Field label="Weight" error={errors.weight} grow>
          <InputShell error={!!errors.weight} style={styles.shell}>
            <NumberInput accessibilityLabel="Weight in kilograms" value={weight} onChangeText={text => { setWeight(text); clear('weight'); }} placeholder="65" keyboardType="decimal-pad" maxLength={5} style={styles.textInput} />
            <Text style={styles.unit}>kg</Text>
          </InputShell>
        </Field>
      </View>
      <Field label="Sex (for the calorie formula)">
        <View style={styles.segment}>
          {SEXES.map(option => (
            <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected: sex === option.id }} onPress={() => setSex(option.id)} style={[styles.segmentItem, sex === option.id && styles.segmentOn]}>
              <Text style={[styles.segmentText, sex === option.id && styles.segmentTextOn]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="How active are you?">
        <View style={styles.gap8}>
          {ACTIVITY.map(option => {
            const on = option.id === activity;
            return (
              <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setActivity(option.id)} style={[styles.activity, on && styles.optionOn]}>
                <View style={styles.grow}>
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  <Text style={[styles.small, on && styles.smallOn]}>{option.desc}</Text>
                </View>
                {on ? <IconTile name="check" bg={colors.green} fg={colors.white} size={22} radius={11} iconSize={13} stroke={3.4} /> : <View style={styles.radioOffSmall} />}
              </Pressable>
            );
          })}
        </View>
      </Field>
      {status === 'fail' ? <Banner icon message="We couldn’t save your details. Check your connection and try again." /> : null}
      <PillButton title={status === 'fail' ? 'Retry' : submitLabel} glow busy={status === 'saving'} busyLabel="Saving…" onPress={submit} />
    </View>
  );
}

function Field({ children, error, grow = false, label }: { children: React.ReactNode; error?: string; grow?: boolean; label: string }) {
  return (
    <View style={[styles.field, grow && styles.grow]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <View style={styles.inlineError}>
          <Icon name="alert" size={14} color={colors.dangerText} stroke={2.6} />
          <FieldError message={error} small />
        </View>
      ) : null}
    </View>
  );
}



export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1 },
  page: { flexGrow: 1, gap: 20, paddingHorizontal: 20 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  spacer44: { height: 44, width: 44 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { backgroundColor: colors.ring, borderRadius: 4, height: 8, width: 22 },
  dotOn: { backgroundColor: colors.green },
  center: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', paddingVertical: 60 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 34 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  smallOn: { color: colors.greenSoft },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  unit: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap16: { gap: 16 },
  row: { flexDirection: 'row', gap: 10 },
  field: { gap: 7 },
  shell: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 52, paddingHorizontal: 14 },
  textInput: { color: colors.ink, flex: 1, fontSize: 17, fontWeight: '600', padding: 0 },
  inlineError: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  segment: { backgroundColor: colors.chip, borderRadius: 16, flexDirection: 'row', gap: 4, padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 6 },
  segmentOn: { backgroundColor: colors.white, boxShadow: '0 2px 8px rgba(28,31,26,.08)' },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  segmentTextOn: { color: colors.ink },
  option: { alignItems: 'center', backgroundColor: colors.white, borderColor: 'transparent', borderRadius: 22, borderWidth: 2, flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  activity: { alignItems: 'center', backgroundColor: colors.white, borderColor: 'transparent', borderRadius: 18, borderWidth: 2, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  optionOn: { backgroundColor: colors.selected, borderColor: colors.green },
  optionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  radioOff: { borderColor: colors.ring, borderRadius: 12, borderWidth: 2, height: 24, width: 24 },
  radioOffSmall: { borderColor: colors.ring, borderRadius: 11, borderWidth: 2, height: 22, width: 22 },
  planCard: { gap: 16, padding: 18 },
  stepperRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bigNumber: { color: colors.ink, fontSize: 38, fontWeight: '800', letterSpacing: -0.8 },
  macroRow: { flexDirection: 'row', gap: 8 },
  macroChip: { alignItems: 'center', borderRadius: 16, flex: 1, gap: 2, paddingVertical: 12 },
  macroValue: { fontSize: 20, fontWeight: '800' },
  stepsRow: { alignItems: 'center', backgroundColor: colors.bg, borderRadius: 16, flexDirection: 'row', gap: 12, padding: 12 },
});
