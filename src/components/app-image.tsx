import React, { useState } from 'react';
import { View, Image, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface AppImageProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  iconSize?: number;
  iconName?: keyof typeof MaterialIcons.glyphMap;
}

import { API_BASE_URL } from '../services/api';

const SESSION_TS = Date.now();

export function AppImage({
  uri,
  style,
  iconSize = 32,
  iconName = 'eco',
}: AppImageProps) {
  const [error, setError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  const fallbackUri = `${API_BASE_URL}/settings-logo?v=${SESSION_TS}`;
  const imageUri = uri && !error ? uri : fallbackUri;

  if (fallbackError) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <View style={styles.badgeCircle}>
          <MaterialIcons name={iconName} size={iconSize} color="#2D3C1F" />
        </View>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUri }}
      style={style}
      onError={() => {
        if (imageUri === fallbackUri) {
          setFallbackError(true);
        } else {
          setError(true);
        }
      }}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#F6EDE0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D4EAB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
