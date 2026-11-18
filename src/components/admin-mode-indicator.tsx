import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  fetchUserProfile,
  isAdminOrSubAdmin,
  User,
} from '../services/api';
import {
  getActiveAppMode,
  setActiveAppMode,
} from '../services/app-mode';

export default function AdminModeIndicator() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<User | null>(null);
  const [activeMode, setActiveMode] = useState<string>('customer');

  const checkUserStatus = useCallback(async () => {
    try {
      const u = await fetchUserProfile();
      setUser(u);
      const mode = await getActiveAppMode();
      setActiveMode(mode);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkUserStatus();

    const authSub = DeviceEventEmitter.addListener('auth_updated', () => {
      checkUserStatus();
    });

    const modeSub = DeviceEventEmitter.addListener('app_mode_changed', (newMode) => {
      setActiveMode(newMode);
    });

    return () => {
      authSub.remove();
      modeSub.remove();
    };
  }, [checkUserStatus]);

  // If user is not admin/sub-admin, never show this
  if (!user || !isAdminOrSubAdmin(user)) {
    return null;
  }

  // If already on admin routes or login screen, don't show
  if (!pathname || pathname.startsWith('/admin') || pathname === '/login') {
    return null;
  }

  const handleSwitchToAdmin = () => {
    Alert.alert(
      'لوحة الإدارة',
      'أنت تتصفح التطبيق حالياً بوضع العميل. هل تريد العودة إلى لوحة تحكم الأدمن؟',
      [
        { text: 'البقاء هنا', style: 'cancel' },
        {
          text: 'العودة للإدارة 👑',
          style: 'default',
          onPress: async () => {
            await setActiveAppMode('admin');
            router.replace('/admin' as any);
            Toast.show({
              type: 'success',
              text1: 'وضع الإدارة',
              text2: 'تم التبديل إلى لوحة تحكم الأدمن بنجاح',
            });
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.floatingContainer,
        { top: Math.max(insets.top + 6, 44) },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={handleSwitchToAdmin}
        activeOpacity={0.85}
      >
        <View style={styles.badgeDot} />
        <MaterialIcons name="admin-panel-settings" size={16} color="#FCD34D" />
        <Text style={styles.pillText}>لوحة الإدارة 👑</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 14,
    zIndex: 9999,
    elevation: 10,
  },
  pill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E3E2B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
