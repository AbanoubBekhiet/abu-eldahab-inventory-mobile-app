import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { registerForPushNotificationsAsync, setupNotificationListeners } from '../services/fcm';

export default function RootLayout() {
  useEffect(() => {
    // Register for push notifications safely on app startup
    registerForPushNotificationsAsync();

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
