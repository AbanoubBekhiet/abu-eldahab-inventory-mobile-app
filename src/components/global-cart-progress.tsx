import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  DeviceEventEmitter,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CartItem, fetchUserProfile, getCartItems, User, isAdminOrSubAdmin } from '../services/api';
import { useAudioPlayer } from 'expo-audio';

export default function GlobalCartProgress() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [sound, setSound] = useState<any>(null);
  const router = useRouter();
  const segments = useSegments();
  
  // Animation value for progress bar width
  const progressAnim = useRef(new Animated.Value(0)).current;
  const qtyProgressAnim = useRef(new Animated.Value(0)).current;

  // Draggable pan value
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  // Initialize expo-audio player
  const player = useAudioPlayer(require('../../assets/sound.mp3'));

  // Fetch initial profile and cart
  useEffect(() => {
    async function init() {
      const profile = await fetchUserProfile();
      setUserProfile(profile || null);
      if (profile && !isAdminOrSubAdmin(profile)) {
        const items = await getCartItems();
        setCartItems(items);
      } else {
        setCartItems([]);
      }
    }
    init();

    const authSub = DeviceEventEmitter.addListener('auth_updated', () => {
      init();
    });

    return () => {
      authSub.remove();
    };
  }, []);

  // Play sound function
  const playSound = async () => {
    if (player) {
      player.seekTo(0);
      player.play();
    }
  };

  // Event listener for cart updates
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('cart_updated', (payload) => {
      const { cartItems: newItems, action } = payload;
      setCartItems(newItems);
      
      if (action === 'add' || action === 'increase') {
        playSound();
      }
    });

    return () => {
      sub.remove();
    };
  }, [player]);

  // Calculate cart subtotal (we calculate this unconditionally to avoid hook conditionally rendering issues if we used a hook, though it's just a derived value)
  const subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const minOrder = userProfile?.region?.min_order_total || 1; // Default to 1 to avoid division by zero
  const minQty = userProfile?.region?.min_products_count || 0;
  
  // Progress percentage (max 100)
  const percentage = Math.min((subtotal / minOrder) * 100, 100);
  const qtyPercentage = minQty > 0 ? Math.min((totalQty / minQty) * 100, 100) : 100;
  
  // Animate progress bar width
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: percentage,
      duration: 500,
      useNativeDriver: false, // width cannot use native driver
    }).start();

    if (minQty > 0) {
      Animated.timing(qtyProgressAnim, {
        toValue: qtyPercentage,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [percentage, qtyPercentage, minQty]);

  // Do not show on the cart screen itself
  const currentRoute = segments[segments.length - 1];
  if (currentRoute === 'cart') return null;

  // If user is admin/subadmin, or doesn't have a minimum order region, we can just hide or simplify it.
  if (!userProfile || isAdminOrSubAdmin(userProfile)) return null;
  if (!userProfile.region || userProfile.region.min_order_total <= 0) return null;

  // Do not show if cart is completely empty (optional, but requested to show progress when adding).
  if (cartItems.length === 0) return null;

  const remaining = Math.max(minOrder - subtotal, 0);
  const isGoalReached = remaining === 0;

  const remainingQty = Math.max(minQty - totalQty, 0);
  const isQtyReached = remainingQty === 0;

  return (
    <Animated.View 
      style={[styles.container, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <View style={styles.contentRow}>
        <View style={styles.infoCol}>
          {/* Price Progress */}
          <View style={styles.barContainer}>
            <View style={styles.barHeader}>
              <Text style={styles.title}>
                {isGoalReached 
                  ? '🎉 السعر: وصلت للحد الأدنى!' 
                  : `السعر: باقي ${remaining.toFixed(2)} ج.م`}
              </Text>
              <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    }) 
                  }
                ]} 
              />
            </View>
          </View>

          {/* Quantity Progress */}
          {minQty > 0 && (
            <View style={styles.barContainer}>
              <View style={styles.barHeader}>
                <Text style={styles.title}>
                  {isQtyReached 
                    ? '🎉 العدد: وصلت للحد الأدنى!' 
                    : `العدد: باقي ${remainingQty} قطعة`}
                </Text>
                <Text style={styles.percentageText}>{Math.round(qtyPercentage)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    { width: qtyProgressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%']
                      }) 
                    }
                  ]} 
                />
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity 
          style={styles.checkoutBtn} 
          onPress={() => router.push('/cart')}
        >
          <Text style={styles.checkoutBtnText}>إتمام الطلب</Text>
          <MaterialIcons name="shopping-cart-checkout" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 65, // Just above MobileFooterNav
    left: 10,
    right: 10,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    elevation: 8,
    shadowColor: '#1F1B13',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    zIndex: 100, // Ensure it's above other elements
  },
  contentRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
  },
  barContainer: {
    marginBottom: 8,
  },
  barHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 11,
    fontFamily: 'Cairo-SemiBold',
    color: '#1F1B13',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F3F0EC',
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D4A373', // primary gold color
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    color: '#D4A373',
  },
  checkoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#2D3C1F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  checkoutBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 12,
    color: '#FFF',
    marginLeft: 6,
  },
});
