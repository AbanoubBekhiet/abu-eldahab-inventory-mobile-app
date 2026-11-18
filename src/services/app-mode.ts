import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export type AppMode = 'admin' | 'customer';

let cachedAppMode: AppMode | null = null;

export async function getActiveAppMode(): Promise<AppMode> {
  if (cachedAppMode) return cachedAppMode;
  try {
    const saved = await AsyncStorage.getItem('app_active_mode');
    if (saved === 'customer' || saved === 'admin') {
      cachedAppMode = saved as AppMode;
      return cachedAppMode;
    }
  } catch (e) {}

  // Check saved user profile in storage
  try {
    const rawUser = await AsyncStorage.getItem('user_profile_v1');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const role = String(u?.role || '').toLowerCase().trim();
      if (['admin', 'sub_admin', 'subadmin', 'sub-admin'].includes(role)) {
        cachedAppMode = 'admin';
        return 'admin';
      }
    }
  } catch (e) {}

  cachedAppMode = 'customer';
  return 'customer';
}

export async function setActiveAppMode(mode: AppMode): Promise<void> {
  cachedAppMode = mode;
  try {
    await AsyncStorage.setItem('app_active_mode', mode);
  } catch (e) {}
  DeviceEventEmitter.emit('app_mode_changed', mode);
}

export async function clearActiveAppMode(): Promise<void> {
  cachedAppMode = null;
  try {
    await AsyncStorage.removeItem('app_active_mode');
  } catch (e) {}
  DeviceEventEmitter.emit('app_mode_changed', 'customer');
}
