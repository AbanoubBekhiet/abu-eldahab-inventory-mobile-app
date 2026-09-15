import { useEffect, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { registerForPushNotificationsAsync, setupNotificationListeners, syncFcmTokenWithServer, getFcmToken } from '../services/fcm';

// Keep the splash screen visible while we load resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const onLayoutReady = useCallback(async () => {
    // Small delay to ensure the first screen is fully rendered
    await new Promise(resolve => setTimeout(resolve, 1500));
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // Hide splash screen after layout is ready
    onLayoutReady();

    // Register for push notifications safely on app startup
    registerForPushNotificationsAsync();

    // After a short delay (to allow auto-login to complete), re-sync the push
    // token with the server. This ensures admin users who are already logged in
    // always have their latest real push token saved on the backend.
    const reSyncTimeout = setTimeout(async () => {
      try {
        const savedToken = await getFcmToken();
        if (savedToken) {
          console.log('[FCM] Re-syncing saved push token with server after startup...');
          await syncFcmTokenWithServer(savedToken);
        }
      } catch (e) {
        console.warn('[FCM] Post-startup re-sync failed:', e);
      }
    }, 4000);

    // Listen for notification taps safely
    const cleanup = setupNotificationListeners((type) => {
      if (type === 'order_status_updated') {
        router.push('/orders-history');
      } else if (type === 'new_order') {
        router.push('/admin/orders' as any);
      } else if (type === 'new_offer') {
        router.push('/offers');
      }
    });

    return () => {
      cleanup();
      clearTimeout(reSyncTimeout);
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
        <Stack.Screen name="offers" />
        <Stack.Screen name="admin/offers" />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="profile" />
      </Stack>
    </>
  );
}
