import { confirmedName, itemSummary, scaled, stepGrams, toCheckItems, totalsOf } from '../../src/features/meals/mealItems';

const roti = { caloriesKcal: 210, carbsGrams: 42, fatGrams: 2.5, grams: 80, name: 'Roti', proteinGrams: 6 };
const dal = { caloriesKcal: 130, carbsGrams: 20, fatGrams: 3, grams: 200, name: 'Dal', proteinGrams: 7 };
const lassi = { caloriesKcal: 130, carbsGrams: null, fatGrams: 6, grams: 250, name: 'Sweet lassi', proteinGrams: null };

describe('meal item checklist', () => {
  test('totals add up the ticked items only', () => {
    const items = toCheckItems([roti, dal, lassi], 'a');
    expect(totalsOf(items)).toEqual({ caloriesKcal: 470, carbsGrams: 62, fatGrams: 11.5, proteinGrams: 13 });
    items[2].checked = false;
    expect(totalsOf(items)).toEqual({ caloriesKcal: 340, carbsGrams: 62, fatGrams: 5.5, proteinGrams: 13 });
    expect(totalsOf(items.map(item => ({ ...item, checked: false })))).toEqual({ caloriesKcal: 0, carbsGrams: null, fatGrams: null, proteinGrams: null });
  });

  test('changing the weight scales calories and macros', () => {
    const [item] = toCheckItems([roti], 'a');
    expect(scaled({ ...item, grams: 120 })).toEqual({ caloriesKcal: 315, carbsGrams: 63, fatGrams: 3.8, grams: 120, name: 'Roti', proteinGrams: 9 });
    expect(stepGrams(80, 10)).toBe(90);
    expect(stepGrams(10, -10)).toBe(10);
    expect(stepGrams(2995, 10)).toBe(3000);
  });

  test('names the meal after its items once it changes, and summarises weights', () => {
    const items = toCheckItems([roti, dal], 'a');
    expect(confirmedName('Roti with dal', items)).toBe('Roti with dal');
    const withLassi = [...items, ...toCheckItems([lassi], 'b', true)];
    expect(confirmedName('Roti with dal', withLassi)).toBe('Roti, Dal, Sweet lassi');
    withLassi[0].checked = false;
    expect(confirmedName('Roti with dal', withLassi)).toBe('Dal, Sweet lassi');
    expect(itemSummary(withLassi)).toBe('Dal ~200 g, Sweet lassi ~250 g');
  });
});
