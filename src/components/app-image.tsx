import React, { useState } from 'react';
import { View, Image, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface AppImageProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  iconSize?: number;
  iconName?: keyof typeof MaterialIcons.glyphMap;
}

const defaultLogo = require('../../assets/images/logo.jpeg');

export function AppImage({
  uri,
  style,
  iconSize = 32,
  iconName = 'eco',
}: AppImageProps) {
  const [error, setError] = useState(false);

  const imageSource = uri && !error ? { uri } : defaultLogo;

  return (
    <Image
      source={imageSource}
      style={style}
      onError={() => {
        if (uri) {
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
