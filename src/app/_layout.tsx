import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="profile" />
      </Stack>
    </>
  );
}
