import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Text style={styles.emoji}>🌿</Text>
    </View>
  );
}

export function AnimatedSplashOverlay() {
  return null;
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#2E5A44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
  },
});
