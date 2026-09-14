import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import MobileFooterNav from '../components/mobile-footer';
import {
  fetchActiveOffers,
  fetchUserProfile,
  getFavoriteIds,
  toggleFavoriteId,
  getCartItems,
  addProductToCart,
  updateCartItemQty,
  isAdminOrSubAdmin,
  ActiveOffer,
  CartItem,
  User,
  Product,
} from '../services/api';
import { AppImage } from '../components/app-image';
import { useRoleGuard } from '../hooks/useRoleGuard';

export default function CustomerOffersScreen() {
  useRoleGuard('customer');
  const router = useRouter();

  const [offers, setOffers] = useState<ActiveOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [user, offersRes, favs, cart] = await Promise.all([
        fetchUserProfile(),
        fetchActiveOffers(),
        getFavoriteIds(),
        getCartItems(),
      ]);

      if (user) setUserProfile(user);
      setOffers(Array.isArray(offersRes) ? offersRes : []);
      setFavoriteIds(Array.isArray(favs) ? [...favs.map(Number)] : []);
      setCartItems(Array.isArray(cart) ? [...cart] : []);
    } catch (e) {
      setOffers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleFavorite = async (productId: number) => {
    setFavoriteIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
    const updated = await toggleFavoriteId(productId);
    setFavoriteIds([...updated.map(Number)]);
  };

  const handleAddToCart = async (offer: ActiveOffer) => {
    if (!offer.product) return;
    const targetId = Number(offer.product_id);
    const existing = cartItems.find((i) => Number(i.product_id) === targetId);
    const currentQty = existing?.quantity || 0;
    const maxAllowed = offer.offer_max_quantity ?? offer.product.max_app_order_quantity;
    const maxAllowedNum = Number(maxAllowed);

    if (!isAdminOrSubAdmin(userProfile)) {
      if (
        maxAllowed !== null &&
        maxAllowed !== undefined &&
        !isNaN(maxAllowedNum) &&
        maxAllowedNum > 0 &&
        currentQty >= maxAllowedNum
      ) {
        Alert.alert(
          'حد الكمية المسموحة',
          `عذراً، أقصى كمية مسموح بشرائها في هذا العرض هي ${maxAllowedNum} قطعة فقط.`
        );
        return;
      }
    }

    const productForCart: Product = {
      ...offer.product!,
      price: offer.offer_price,
      max_app_order_quantity: offer.offer_max_quantity ?? offer.product?.max_app_order_quantity,
    };

    setCartItems((prev) => {
      const idx = prev.findIndex((i) => Number(i.product_id) === targetId);
      if (idx > -1) {
        const updated = [...prev];
        let newQty = updated[idx].quantity + 1;
        const maxLimit = productForCart.max_app_order_quantity;
        const maxLimitNum = Number(maxLimit);
        if (maxLimit !== null && maxLimit !== undefined && !isNaN(maxLimitNum) && maxLimitNum > 0) {
          if (newQty > maxLimitNum) newQty = maxLimitNum;
        }
        updated[idx] = { ...updated[idx], quantity: newQty };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: targetId,
            product_id: targetId,
            name: offer.product?.name || '',
            price: Number(offer.offer_price) || 0,
            quantity: 1,
            image_url: offer.product?.image_url,
            category_name: offer.product?.category_name,
            max_app_order_quantity: offer.offer_max_quantity ?? offer.product?.max_app_order_quantity,
          },
        ];
      }
    });

    const updatedCart = await addProductToCart(productForCart, 1);
    setCartItems([...updatedCart]);
  };

  const handleUpdateCartQty = async (productId: number, delta: number) => {
    const existing = cartItems.find((i) => Number(i.product_id) === productId);

    if (delta > 0 && existing && !isAdminOrSubAdmin(userProfile)) {
      const maxAllowed = existing.max_app_order_quantity;
      const maxAllowedNum = Number(maxAllowed);
      if (
        maxAllowed !== null &&
        maxAllowed !== undefined &&
        !isNaN(maxAllowedNum) &&
        maxAllowedNum > 0 &&
        existing.quantity >= maxAllowedNum
      ) {
        Alert.alert(
          'حد الكمية المسموحة',
          `عذراً، أقصى كمية مسموح بشرائها هي ${maxAllowedNum} قطعة فقط.`
        );
        return;
      }
    }

    setCartItems((prev) => {
      const updated = prev
        .map((item) => {
          if (Number(item.product_id) === productId) {
            let newQty = item.quantity + delta;
            const maxLimit = item.max_app_order_quantity;
            const maxLimitNum = Number(maxLimit);
            if (delta > 0 && maxLimit !== null && maxLimit !== undefined && !isNaN(maxLimitNum) && maxLimitNum > 0) {
              if (newQty > maxLimitNum) newQty = maxLimitNum;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
      return [...updated];
    });

    const updatedCart = await updateCartItemQty(productId, delta);
    setCartItems([...updatedCart]);
  };

  const formatExpiry = (expiresAt: string) => {
    try {
      const expDate = new Date(expiresAt);
      const now = new Date();
      const diffMs = expDate.getTime() - now.getTime();
      if (diffMs <= 0) return 'منتهي';

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return `ينتهي خلال ${diffDays} يوم`;
      } else if (diffHours > 0) {
        return `ينتهي خلال ${diffHours} ساعة`;
      } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `ينتهي خلال ${diffMins} دقيقة`;
      }
    } catch (e) {
      return expiresAt;
    }
  };

  const totalCartItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>العروض الترويجية 🏷️</Text>
        <Text style={styles.headerSubtitle}>أقوى التخفيضات والصفقات الحصرية</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2D3C1F" />
          <Text style={styles.loadingText}>جاري تحميل العروض الحالية...</Text>
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2D3C1F']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="local-offer" size={56} color="#A8A29E" />
              <Text style={styles.emptyTitle}>لا توجد عروض حالياً</Text>
              <Text style={styles.emptySubtitle}>تابعنا دائماً للحصول على أحدث العروض والخصومات!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const product = item.product;
            if (!product) return null;

            const pId = Number(product.id);
            const isFav = favoriteIds.includes(pId);
            const cartItem = cartItems.find((ci) => Number(ci.product_id || ci.id) === pId);
            const qtyInCart = cartItem?.quantity || 0;
            const limit = item.offer_max_quantity ?? product.max_app_order_quantity;

            return (
              <View style={styles.offerCard}>
                {/* Image and Badges Container */}
                <View style={styles.imageSection}>
                  <AppImage
                    uri={product.image_url}
                    style={styles.offerImage}
                    iconName="shopping-basket"
                    iconSize={48}
                  />

                  {/* Top Left Discount Badge */}
                  {item.discount_percentage ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>خصم {item.discount_percentage}%</Text>
                    </View>
                  ) : null}

                  {/* Favorite Button */}
                  <TouchableOpacity
                    style={styles.favBtn}
                    onPress={() => handleToggleFavorite(pId)}
                  >
                    <MaterialIcons
                      name={isFav ? 'favorite' : 'favorite-border'}
                      size={20}
                      color={isFav ? '#BA1A1A' : '#75786E'}
                    />
                  </TouchableOpacity>

                  {/* Expiry Timer Pill */}
                  <View style={styles.expiryPill}>
                    <MaterialIcons name="timer" size={14} color="#92400E" />
                    <Text style={styles.expiryText}>{formatExpiry(item.expires_at)}</Text>
                  </View>
                </View>

                {/* Details Section */}
                <View style={styles.detailsSection}>
                  <Text style={styles.categoryText}>{product.category_name || 'عرض خاص'}</Text>
                  <Text style={styles.productTitle}>{product.name}</Text>

                  {/* Price Row */}
                  <View style={styles.priceRow}>
                    <View style={styles.priceContainer}>
                      <Text style={styles.offerPriceText}>
                        {(Number(item.offer_price) || 0).toFixed(2)} ج.م
                      </Text>
                      {item.original_price ? (
                        <Text style={styles.originalPriceText}>
                          {(Number(item.original_price) || 0).toFixed(2)} ج.م
                        </Text>
                      ) : null}
                    </View>

                    {limit ? (
                      <View style={styles.limitBadge}>
                        <MaterialIcons name="info-outline" size={12} color="#92400E" />
                        <Text style={styles.limitText}>الحد: {limit} قطعة</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Cart Action */}
                  {qtyInCart === 0 ? (
                    <TouchableOpacity
                      style={styles.addCartBtn}
                      onPress={() => handleAddToCart(item)}
                    >
                      <MaterialIcons name="add-shopping-cart" size={18} color="#FFFFFF" />
                      <Text style={styles.addCartText}>إضافة للعرض بالسلة</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.qtyControlRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleUpdateCartQty(pId, -1)}
                      >
                        <MaterialIcons name="remove" size={16} color="#1F1B13" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qtyInCart}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtnAdd}
                        onPress={() => handleUpdateCartQty(pId, 1)}
                      >
                        <MaterialIcons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <MobileFooterNav cartCount={totalCartItems} wishlistCount={favoriteIds.length} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1',
  },
  headerBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF8F1',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#75786E',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#75786E',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    overflow: 'hidden',
    shadowColor: '#1F1B13',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  imageSection: {
    width: '100%',
    height: 160,
    backgroundColor: '#F6EDE0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#BA1A1A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  favBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400E',
  },
  detailsSection: {
    padding: 16,
  },
  categoryText: {
    fontSize: 11,
    color: '#75786E',
    textAlign: 'right',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
    marginTop: 2,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  priceContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 8,
  },
  offerPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  originalPriceText: {
    fontSize: 13,
    color: '#9A978F',
    textDecorationLine: 'line-through',
  },
  limitBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  limitText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400E',
  },
  addCartBtn: {
    backgroundColor: '#2D3C1F',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  addCartText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F6EDE0',
    borderRadius: 14,
    padding: 6,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnAdd: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#2D3C1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
});
