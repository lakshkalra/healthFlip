import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createMeal, listFoods, type MealInput, updateMeal } from '../../services/api';
import { type Food, foodFromSaved, FOODS, MEAL_TYPES, type MealType } from '../../features/meals/meals';
import { formatTime } from '../../utils/format';
import { isWholeNumber } from '../../utils/validation';
import type { Meal } from '../../types';
import { Banner, FieldError, Icon, InputShell, NumberInput, Overlay, PillButton, RoundIconButton, styles as ui } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { MealTypes } from '../../app/types';
import { FoodPicker } from './FoodPicker';

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

export function MealSheet({ visible, mode, initialType, meal, onClose, onSaved, onAskFlip }: { visible: boolean; mode: 'add' | 'edit'; initialType: MealType; meal: Meal | null; onClose: () => void; onSaved: (types: MealTypes, mode: 'add' | 'edit') => void; onAskFlip?: (query: string, type: MealType) => void }) {
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

const screen = StyleSheet.create({
  row6: { flexDirection: 'row', gap: 6 },
  row8: { flexDirection: 'row', gap: 8 },
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  label14: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.muted2, fontSize: 12 },
  fieldLabel: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  unitSmall: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  mealTime: { color: colors.muted2, fontSize: 12 },
  loggedRow: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  handleRow: { alignItems: 'center', paddingBottom: 4, paddingTop: 10 },
  handle: { backgroundColor: colors.handle, borderRadius: 9, height: 5, width: 40 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', paddingBottom: 10, paddingHorizontal: 20, paddingTop: 6 },
  sheetTitle: { color: colors.ink, flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  sheetBody: { flexShrink: 1 },
  sheetContent: { gap: 16, paddingBottom: 12, paddingHorizontal: 20, paddingTop: 4 },
  sheetFooter: { borderTopColor: colors.chip, borderTopWidth: 1, gap: 10, paddingHorizontal: 20, paddingTop: 10 },
  chip: { alignItems: 'center', backgroundColor: colors.chip, borderRadius: 99, flex: 1, height: 40, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { color: '#3f443a', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.white, fontWeight: '700' },
  macroShell: { alignItems: 'stretch', flexDirection: 'column', justifyContent: 'center', paddingHorizontal: 12 },
  macroInputLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  macroInput: { flex: 0, fontSize: 16 },
  note: { backgroundColor: colors.bg, borderRadius: 16, color: colors.ink, fontSize: 15, fontWeight: '500', lineHeight: 21, minHeight: 66, paddingHorizontal: 16, paddingVertical: 12, textAlignVertical: 'top' },
});
