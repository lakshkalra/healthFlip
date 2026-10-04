import AsyncStorage from '@react-native-async-storage/async-storage';

const guestTokenKey = '@healthflip/guest-token';

export async function getGuestToken(): Promise<string | null> {
  return AsyncStorage.getItem(guestTokenKey);
}

export async function saveGuestToken(token: string): Promise<void> {
  await AsyncStorage.setItem(guestTokenKey, token);
}

export async function clearGuestToken(): Promise<void> {
  await AsyncStorage.removeItem(guestTokenKey);
}
