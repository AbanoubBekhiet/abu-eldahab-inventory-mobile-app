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
    console.log('Running in Expo Go (SDK 53+): remote notifications disabled in Expo Go. Use a development build for native push notifications.');
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
    console.warn('Could not load expo-notifications module:', e);
    NotificationsModule = null;
  }

  return NotificationsModule;
}

/**
 * Sends the FCM token to the backend server if the user is authenticated.
 */
export async function syncFcmTokenWithServer(fcmToken: string): Promise<void> {
  try {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (!authToken) return;

    // Use the same production API URL as the rest of the app
    const { API_BASE_URL } = require('./api');

    await fetch(`${API_BASE_URL}/auth/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fcm_token: fcmToken }),
    });
  } catch (e) {}
}

/**
 * Registers for push notifications and obtains an Expo Push Token or Device FCM Token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Notifications = getNotificationsModule();

  if (!Notifications) {
    // In Expo Go or non-supported environment, safely generate/retrieve a fallback token
    const token = await getOrGenerateFcmToken();
    await syncFcmTokenWithServer(token);
    return token;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
    }

    if (!Device.isDevice) {
      console.log('Push notifications are recommended on a physical device');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted!');
      const fallbackToken = await getOrGenerateFcmToken();
      await syncFcmTokenWithServer(fallbackToken);
      return fallbackToken;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId }).catch((e) => {
      console.error('getExpoPushTokenAsync failed:', e);
      return null;
    });
    const pushToken = tokenData?.data;

    if (pushToken) {
      await saveFcmToken(pushToken);
      await syncFcmTokenWithServer(pushToken);
      return pushToken;
    }

    const fallbackToken = await getOrGenerateFcmToken();
    await syncFcmTokenWithServer(fallbackToken);
    return fallbackToken;
  } catch (e) {
    console.error('Failed to get push token:', e);
    const fallbackToken = await getOrGenerateFcmToken();
    await syncFcmTokenWithServer(fallbackToken);
    return fallbackToken;
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
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type) {
        onNavigate(String(data.type), data);
      }
    });

    return () => {
      responseSubscription.remove();
    };
  } catch (e) {
    return () => {};
  }
}

/**
 * Retrieves the stored FCM token or generates a unique token fallback for this device/session.
 */
export async function getOrGenerateFcmToken(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (existing) {
      return existing;
    }

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
