// The checklist under an AI meal estimate: tick items on or off, adjust weights, add what was missed.
import type { MealItem } from './types';

export type CheckItem = {
  /** Added by the user after the first estimate (always counts as a change to the meal). */
  added: boolean;
  checked: boolean;
  grams: number;
  key: string;
  /** The AI's values; calories and macros scale from these by grams / original.grams. */
  original: MealItem;
};

export type Totals = { caloriesKcal: number; carbsGrams: number | null; fatGrams: number | null; proteinGrams: number | null };

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

export function toCheckItems(items: MealItem[], keyPrefix: string, added = false): CheckItem[] {
  return items.map((item, index) => ({ added, checked: true, grams: item.grams, key: `${keyPrefix}-${index}`, original: item }));
}

/** An item's values at its current weight. */
export function scaled(item: CheckItem): MealItem {
  const ratio = item.original.grams > 0 ? item.grams / item.original.grams : 1;
  const macro = (value: number | null) => (value === null ? null : oneDecimal(value * ratio));
  return {
    caloriesKcal: Math.round(item.original.caloriesKcal * ratio),
    carbsGrams: macro(item.original.carbsGrams),
    fatGrams: macro(item.original.fatGrams),
    grams: item.grams,
    name: item.original.name,
    proteinGrams: macro(item.original.proteinGrams),
  };
}

/** Sum of the ticked items; a macro is null only when no ticked item has a value for it. */
export function totalsOf(items: CheckItem[]): Totals {
  const ticked = items.filter(item => item.checked).map(scaled);
  const sum = (key: 'carbsGrams' | 'fatGrams' | 'proteinGrams') => {
    const values = ticked.map(item => item[key]).filter((value): value is number => value !== null);
    return values.length ? oneDecimal(values.reduce((total, value) => total + value, 0)) : null;
  };
  return {
    caloriesKcal: ticked.reduce((total, item) => total + item.caloriesKcal, 0),
    carbsGrams: sum('carbsGrams'),
    fatGrams: sum('fatGrams'),
    proteinGrams: sum('proteinGrams'),
  };
}

/** ±10 g steps, kept between 10 g and 3 kg. */
export function stepGrams(grams: number, delta: number): number {
  return Math.min(3000, Math.max(10, Math.round((grams + delta) / 10) * 10));
}

/** Keeps the AI's meal name while the meal is unchanged; otherwise names it after the ticked items. */
export function confirmedName(estimateName: string, items: CheckItem[]): string {
  const unchanged = items.every(item => item.checked && !item.added);
  if (unchanged || !items.some(item => item.checked)) return estimateName;
  return items.filter(item => item.checked).map(item => item.original.name).join(', ').slice(0, 120);
}

/** "Roti ~80 g, Dal ~200 g": the serving text for "Pick from list" and the meal note. */
export function itemSummary(items: CheckItem[]): string {
  return items.filter(item => item.checked).map(item => `${item.original.name} ~${item.grams} g`).join(', ').slice(0, 200);
}
