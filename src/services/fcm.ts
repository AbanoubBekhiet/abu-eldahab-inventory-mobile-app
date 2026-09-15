import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const FCM_TOKEN_STORAGE_KEY = 'user_fcm_token';

let NotificationsModule: typeof import('expo-notifications') | null = null;
let isModuleLoaded = false;

function getNotificationsModule(): typeof import('expo-notifications') | null {
  if (isModuleLoaded) return NotificationsModule;
  isModuleLoaded = true;

  // In Expo Go (SDK 53+), remote notifications native code is removed
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo) {
    console.warn(
      '⚠️ [FCM] Running in Expo Go — push notifications are NOT supported.\n' +
      'Use a development build (npx expo run:android) for real push notifications.'
    );
    NotificationsModule = null;
    return null;
  }

  try {
    NotificationsModule = require('expo-notifications');
    if (NotificationsModule && NotificationsModule.setNotificationHandler) {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (e) {
    console.warn('[FCM] Could not load expo-notifications module:', e);
    NotificationsModule = null;
  }

  return NotificationsModule;
}

/**
 * Sends the FCM token to the backend server if the user is authenticated.
 */
export async function syncFcmTokenWithServer(fcmToken: string): Promise<void> {
  try {
    // Reject fake/generated tokens
    if (!fcmToken || fcmToken.startsWith('fcm_') || fcmToken.startsWith('fake_')) {
      console.warn('[FCM] Refusing to sync invalid/fake token with server:', fcmToken?.substring(0, 30));
      return;
    }

    const authToken = await AsyncStorage.getItem('auth_token');
    if (!authToken) {
      console.log('[FCM] No auth token, skipping server sync');
      return;
    }

    // Use the same production API URL as the rest of the app
    const { API_BASE_URL } = require('./api');

    console.log('[FCM] Syncing token with server...');
    const response = await fetch(`${API_BASE_URL}/auth/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fcm_token: fcmToken }),
    });

    if (response.ok) {
      console.log('[FCM] ✅ Token synced with server successfully');
    } else {
      const data = await response.text();
      console.warn('[FCM] ❌ Server rejected token sync:', response.status, data);
    }
  } catch (e) {
    console.error('[FCM] ❌ Failed to sync token with server:', e);
  }
}

/**
 * Registers for push notifications and obtains a real push token.
 * Returns null if running in Expo Go or if permissions are denied.
 * NEVER returns a fake/generated token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Notifications = getNotificationsModule();

  if (!Notifications) {
    console.warn('[FCM] Notifications module not available (likely Expo Go). No token will be generated.');
    return null;
  }

  try {
    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
      console.log('[FCM] Android notification channel configured');
    }

    if (!Device.isDevice) {
      console.warn('[FCM] Running on emulator — push notifications may not work reliably');
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[FCM] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[FCM] ❌ Push notification permission denied by user');
      return null;
    }

    console.log('[FCM] ✅ Notification permissions granted');

    // Try Expo Push Token FIRST — the backend uses the Expo Push API
    // (no FCM_SERVER_KEY needed), so ExponentPushToken is the preferred format.
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (projectId) {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const pushToken = tokenData?.data;
        if (pushToken) {
          console.log('[FCM] ✅ Got Expo push token:', pushToken.substring(0, 30) + '...');
          await saveFcmToken(pushToken);
          await syncFcmTokenWithServer(pushToken);
          return pushToken;
        }
      } else {
        console.warn('[FCM] No EAS projectId found, cannot get Expo push token');
      }
    } catch (e) {
      console.warn('[FCM] Could not get Expo push token, trying native FCM token...', e);
    }

    // Fallback: try native device push token (FCM token)
    // Only useful if backend has FCM_SERVER_KEY configured
    try {
      const deviceTokenData = await Notifications.getDevicePushTokenAsync();
      const deviceToken = deviceTokenData?.data;
      if (deviceToken && typeof deviceToken === 'string' && deviceToken.length > 20) {
        console.log('[FCM] ✅ Got native FCM device token (fallback):', deviceToken.substring(0, 20) + '...');
        await saveFcmToken(deviceToken);
        await syncFcmTokenWithServer(deviceToken);
        return deviceToken;
      }
    } catch (e) {
      console.error('[FCM] ❌ getDevicePushTokenAsync also failed:', e);
    }

    console.error('[FCM] ❌ Could not obtain any push token');
    return null;
  } catch (e) {
    console.error('[FCM] ❌ Failed to register for push notifications:', e);
    return null;
  }
}

/**
 * Safely sets up notification tap listeners without crashing Expo Go.
 */
export function setupNotificationListeners(onNavigate: (type: string, data: any) => void): () => void {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  try {
    // Listen for notifications received while app is in foreground
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[FCM] 📬 Notification received in foreground:', notification.request.content.title);
    });

    // Listen for notification taps
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[FCM] 👆 Notification tapped:', data);
      if (data?.type) {
        onNavigate(String(data.type), data);
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  } catch (e) {
    console.error('[FCM] Failed to setup notification listeners:', e);
    return () => {};
  }
}

/**
 * Retrieves cached FCM token if present.
 * Automatically clears stale/fake tokens from older app versions.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    // Reject fake/generated tokens from older app versions
    if (token && (token.startsWith('fcm_') || token.startsWith('fake_'))) {
      console.warn('[FCM] Found stale fake token in storage, clearing it:', token.substring(0, 30));
      await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      return null;
    }
    return token;
  } catch (e) {
    return null;
  }
}

/**
 * Saves a specific FCM token.
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

/**
 * @deprecated - No longer generates fake tokens. Use registerForPushNotificationsAsync instead.
 * Kept for backward compatibility but now just retrieves the saved real token.
 */
export async function getOrGenerateFcmToken(): Promise<string | null> {
  return getFcmToken();
}
