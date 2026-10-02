import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MealType } from '../meals';

const guestTokenKey = '@healthflip/guest-token';
const mealTypesKey = '@healthflip/meal-types';

export async function getGuestToken(): Promise<string | null> {
  return AsyncStorage.getItem(guestTokenKey);
}

export async function saveGuestToken(token: string): Promise<void> {
  await AsyncStorage.setItem(guestTokenKey, token);
}

/** The API has no meal-type field yet, so the chosen type is kept on this device per meal id. */
export async function getMealTypes(): Promise<Record<string, MealType>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(mealTypesKey)) ?? '{}');
  } catch {
    return {};
  }
}

export async function setMealType(mealId: string, type: MealType | null): Promise<Record<string, MealType>> {
  const types = await getMealTypes();
  if (type) types[mealId] = type;
  else delete types[mealId];
  await AsyncStorage.setItem(mealTypesKey, JSON.stringify(types));
  return types;
}
