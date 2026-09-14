import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import MobileFooterNav from '../components/mobile-footer';
import { AppImage } from '../components/app-image';
import {
  fetchAppProducts,
  fetchProductsByIds,
  fetchUserProfile,
  getFavoriteIds,
  toggleFavoriteId,
  getCartItems,
  addProductToCart,
  updateCartItemQty,
  isAdminOrSubAdmin,
  Product,
  CartItem,
  User,
} from '../services/api';
import { useRoleGuard } from '../hooks/useRoleGuard';

export default function WishlistScreen() {
  useRoleGuard('customer');
  const router = useRouter();
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFavoriteProducts = useCallback(async () => {
    setLoading(true);
    try {
      const favIds = await getFavoriteIds();
      const favIdsNum = favIds.map(Number);
      setFavoriteIds(favIdsNum);

      if (favIdsNum.length === 0) {
        setFavoriteProducts([]);
        return;
      }

      const prods = await fetchProductsByIds(favIdsNum);
      setFavoriteProducts(prods);
    } catch (e) {
      setFavoriteProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Focus effect to reload favorites, cart, and user profile
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadData = async () => {
        try {
          const [user, cart] = await Promise.all([
            fetchUserProfile(),
            getCartItems(),
          ]);
          if (!active) return;
          if (user) setUserProfile(user);
          setCartItems(Array.isArray(cart) ? [...cart] : []);
        } catch (e) {}
        if (active) {
          loadFavoriteProducts();
        }
      };
      loadData();
      return () => { active = false; };
    }, [loadFavoriteProducts])
  );

  const handleRemoveFavorite = async (productId: number) => {
    const updatedIds = await toggleFavoriteId(productId);
    setFavoriteIds(updatedIds);
    setFavoriteProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleAddToCart = async (product: Product) => {
    if (!product || !product.id) return;
    const targetId = Number(product.id);
    const existing = cartItems.find((i) => Number(i.product_id) === targetId);
    const currentQty = existing?.quantity || 0;
    const maxAllowed = product.max_app_order_quantity;
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
          `عذراً، أقصى كمية مسموح بشرائها هي ${maxAllowedNum} قطعة فقط.`
        );
        return;
      }
    }

    setCartItems((prev) => {
      const idx = prev.findIndex((i) => Number(i.product_id) === targetId);
      if (idx > -1) {
        const updated = [...prev];
        let newQty = updated[idx].quantity + 1;
        const maxLimit = product.max_app_order_quantity;
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
            name: product.name,
            price: Number(product.price) || 0,
            quantity: 1,
            image_url: product.image_url,
            category_name: product.category_name,
            max_app_order_quantity: product.max_app_order_quantity,
          },
        ];
      }
    });

    const updatedCart = await addProductToCart(product, 1);
    setCartItems([...updatedCart]);
  };

  const handleUpdateCartQty = async (productId: number | string, delta: number) => {
    const pId = Number(productId);
    const existing = cartItems.find((i) => Number(i.product_id) === pId);

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
          if (Number(item.product_id) === pId) {
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

    const updatedCart = await updateCartItemQty(pId, delta);
    setCartItems([...updatedCart]);
  };

  const totalCartItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <Text style={styles.pageTitle}>المفضلة</Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
            <Text style={styles.loadingText}>جاري تحميل المنتجات المفضلة...</Text>
          </View>
        ) : favoriteProducts.length === 0 ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="favorite-border" size={54} color="#75786E" />
            <Text style={styles.emptyTitle}>قائمة المفضلة فارغة</Text>
            <Text style={styles.emptySub}>
              احفظ منتجاتك المفضلة بالضغط على أيقونة القلب في المتجر.
            </Text>
            <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/')}>
              <Text style={styles.shopBtnText}>تصفح المنتجات الآن</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {favoriteProducts.map((item) => {
              if (!item) return null;
              const itemId = Number(item.id);
              const cartItem = cartItems.find((i) => Number(i.product_id) === itemId);
              const qtyInCart = cartItem?.quantity || 0;

              return (
                <View key={item.id} style={styles.productCard}>
                  <View style={styles.imagePlaceholder}>
                    <TouchableOpacity
                      style={styles.heartButton}
                      onPress={() => handleRemoveFavorite(item.id)}
                    >
                      <MaterialIcons name="favorite" size={16} color="#BA1A1A" />
                    </TouchableOpacity>

                    {item.unit ? (
                      <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText} numberOfLines={1}>
                          {item.unit}{item.number_of_items_in_unit && item.number_of_items_in_unit > 1 ? ` (${item.number_of_items_in_unit} قطعة)` : ''}
                        </Text>
                      </View>
                    ) : null}

                    <AppImage
                      uri={item.image_url}
                      style={styles.productImage}
                      iconName="shopping-basket"
                      iconSize={36}
                    />
                  </View>

                  <Text style={styles.categoryName}>{item.category_name || "خردوات ومنظفات وورقيات"}</Text>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.priceText}>{(Number(item.price) || 0).toFixed(2)} ج.م</Text>

                  {/* Add to Cart Button or Stepper Controls */}
                  {qtyInCart === 0 ? (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => handleAddToCart(item)}
                    >
                      <Text style={styles.addButtonText}>+ إضافة للسلة</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.qtyControlRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleUpdateCartQty(item.id, -1)}
                      >
                        <MaterialIcons name="remove" size={14} color="#1F1B13" />
                      </TouchableOpacity>
                      <Text style={styles.qtyNumber}>{qtyInCart}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtnAdd}
                        onPress={() => handleUpdateCartQty(item.id, 1)}
                      >
                        <MaterialIcons name="add" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <MobileFooterNav cartCount={totalCartItems} wishlistCount={favoriteIds.length} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1',
  },
  topAppBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
    backgroundColor: '#FFF8F1',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  scrollContent: {
    flex: 1,
    paddingTop: 16,
  },
  productsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 14,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#F6EDE0',
    borderRadius: 16,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  heartButton: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  unitBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    zIndex: 10,
  },
  unitBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2D3C1F',
    textAlign: 'right',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontSize: 10,
    color: '#75786E',
    fontWeight: '600',
    textAlign: 'right',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
    marginVertical: 2,
  },
  priceText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
    marginVertical: 4,
  },
  addButton: {
    backgroundColor: '#2D3C1F',
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F6EDE0',
    borderRadius: 12,
    padding: 4,
    marginTop: 4,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnAdd: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#2D3C1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#75786E',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginTop: 10,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#75786E',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  shopBtn: {
    backgroundColor: '#2D3C1F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
  },
  shopBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
