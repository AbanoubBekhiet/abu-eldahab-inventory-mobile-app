import AsyncStorage from '@react-native-async-storage/async-storage';

const FCM_TOKEN_STORAGE_KEY = 'user_fcm_token';

/**
 * Retrieves the stored FCM token or generates a unique FCM token for this device/session.
 */
export async function getOrGenerateFcmToken(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    // Generate a unique FCM token for testing / Expo fallback
    const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newToken = `fcm_${Date.now()}_${randomPart}`;
    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, newToken);
    return newToken;
  } catch (e) {
    return `fcm_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

/**
 * Retrieves cached FCM token if present.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Saves a specific FCM token (e.g. from Firebase SDK).
 */
export async function saveFcmToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  } catch (e) {}
}

/**
 * Clears FCM token from local storage upon logout.
 */
export async function clearFcmToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
  } catch (e) {}
}
