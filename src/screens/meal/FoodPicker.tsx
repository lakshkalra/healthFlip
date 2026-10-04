import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Food, FOODS } from '../../features/meals/meals';
import { formatNumber } from '../../utils/format';
import { Icon, IconTile, InputShell } from '../../components/ui';
import { colors } from '../../constants/theme';

export function FoodPicker({ value, error, savedFoods, onAskFlip, onOpenChange, onPick }: { value: string; error: boolean; savedFoods: Food[]; onAskFlip?: (query: string) => void; onOpenChange?: (open: boolean) => void; onPick: (food: Food) => void }) {
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

const screen = StyleSheet.create({
  grow: { flex: 1, gap: 2, minWidth: 0 },
  bold: { color: colors.ink, fontWeight: '700' },
  mealName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  mealTime: { color: colors.muted2, fontSize: 12 },
  foodShell: { gap: 10, paddingRight: 14 },
  foodInput: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '600', minWidth: 0, padding: 0 },
  chevron: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  picker: { backgroundColor: colors.white, borderRadius: 18, boxShadow: '0 0 0 1.5px #e6eadc, 0 8px 18px rgba(28,31,26,.08)', marginTop: 2, padding: 6 },
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
});
