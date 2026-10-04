import type { MealType } from '../features/meals/meals';
import type { IconName } from '../components/ui/Icon';

export const colors = {
  ink: '#1c1f1a',
  bg: '#f5f7f1',
  white: '#ffffff',
  lime: '#d9f0a8',
  limeBright: '#b7e36a',
  primary: '#9fd34a',
  green: '#7fbf2a',
  greenDark: '#3d5a12',
  greenMid: '#5a8a17',
  greenText: '#4f7a14',
  greenSoft: '#4c6a1c',
  pale: '#e4f4c6',
  selected: '#f2fadf',
  muted: '#5c6157',
  muted2: '#7a7f73',
  faint: '#a3a79c',
  disabled: '#b4b8ad',
  chip: '#f0f2ec',
  ring: '#d5d9cd',
  handle: '#dfe2d8',
  dashed: '#cfd6c3',
  danger: '#c4452f',
  dangerText: '#b23b26',
  dangerBg: '#fde6dc',
  dangerInk: '#7a2a1a',
  over: '#ef8a3c',
  overText: '#9a4210',
  protein: '#8a63d2',
  proteinBg: '#ece4fb',
  carbs: '#e3a12f',
  carbsBg: '#fdeccc',
  fat: '#3a86d1',
  fatBg: '#dcecfb',
};

export const mealTypeStyle: Record<MealType, { bg: string; fg: string; icon: IconName }> = {
  breakfast: { bg: colors.carbsBg, fg: '#c27a12', icon: 'sun' },
  lunch: { bg: colors.pale, fg: colors.greenMid, icon: 'utensils' },
  snacks: { bg: colors.fatBg, fg: '#2f72b5', icon: 'apple' },
  dinner: { bg: colors.proteinBg, fg: '#7650c4', icon: 'moon' },
};

// ---------- Icons (Lucide paths from the design) ----------
