import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import MobileFooterNav from '../components/mobile-footer';
import {
  fetchAppProducts,
  fetchCategories,
  fetchUserProfile,
  getFavoriteIds,
  toggleFavoriteId,
  getCartItems,
  addProductToCart,
  updateCartItemQty,
  isAdminOrSubAdmin,
  Product,
  Category,
  CartItem,
  User,
} from '../services/api';
import { AppImage } from '../components/app-image';
import { useRoleGuard } from '../hooks/useRoleGuard';

export default function ShopExploreScreen() {
  useRoleGuard('customer');
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const params = useLocalSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string | number>('all');

  // Watch for categoryId param changes
  React.useEffect(() => {
    if (params.categoryId) {
      setSelectedCategory(
        params.categoryId === 'all' ? 'all' : Number(params.categoryId)
      );
    }
  }, [params.categoryId]);
  const [loading, setLoading] = useState(true);

  // User profile (for admin limit bypass)
  const [userProfile, setUserProfile] = useState<User | null>(null);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  // Persistent Cart items
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Reload cart + favorites + categories every time screen is focused
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadData = async () => {
        try {
          const [user, cats, favs, cart] = await Promise.all([
            fetchUserProfile(),
            fetchCategories(),
            getFavoriteIds(),
            getCartItems(),
          ]);
          if (!active) return;
          if (user) setUserProfile(user);
          setCategories(Array.isArray(cats) ? cats : []);
          setFavoriteIds(Array.isArray(favs) ? [...favs.map(Number)] : []);
          setCartItems(Array.isArray(cart) ? [...cart] : []);
        } catch (e) {
          if (!active) return;
          setCategories([]);
        }
      };
      loadData();
      return () => { active = false; };
    }, [])
  );

  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reload products when category changes
  const loadShopProducts = useCallback(async (catId: string | number) => {
    setLoading(true);
    try {
      const res = await fetchAppProducts(undefined, catId, 1);
      setProducts(Array.isArray(res.products) ? res.products : []);
      setNextPage(res.nextPage);
    } catch (e) {
      setProducts([]);
      setNextPage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreShopProducts = async () => {
    if (!nextPage || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await fetchAppProducts(undefined, selectedCategory, nextPage);
      if (Array.isArray(res.products) && res.products.length > 0) {
        setProducts((prev) => [...prev, ...res.products]);
      }
      setNextPage(res.nextPage);
    } catch (e) {
      // keep current products
    } finally {
      setLoadingMore(false);
    }
  };

  // Whenever selectedCategory changes, reload products
  React.useEffect(() => {
    loadShopProducts(selectedCategory);
  }, [selectedCategory, loadShopProducts]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadShopProducts(selectedCategory),
        (async () => {
          const [user, cats, favs, cart] = await Promise.all([
            fetchUserProfile(),
            fetchCategories(),
            getFavoriteIds(),
            getCartItems(),
          ]);
          if (user) setUserProfile(user);
          setCategories(Array.isArray(cats) ? cats : []);
          setFavoriteIds(Array.isArray(favs) ? [...favs.map(Number)] : []);
          setCartItems(Array.isArray(cart) ? [...cart] : []);
        })()
      ]);
    } catch (e) {
      console.log("Refresh error", e);
    } finally {
      setRefreshing(false);
    }
  }, [selectedCategory, loadShopProducts]);

  const handleToggleFavorite = async (productId: number | string) => {
    const pId = Number(productId);
    // Optimistic update
    setFavoriteIds((prev) => {
      if (prev.includes(pId)) {
        return prev.filter((id) => id !== pId);
      } else {
        return [...prev, pId];
      }
    });
    // Persist to storage
    const updated = await toggleFavoriteId(pId);
    setFavoriteIds([...updated.map(Number)]);
  };

  const handleAddToCart = async (product: Product) => {
    if (!product || !product.id) return;
    const targetId = Number(product.id);
    const existing = cartItems.find((i) => Number(i.product_id || i.id) === targetId);
    const currentQty = existing?.quantity || 0;
    const maxAllowed = product.active_offer?.offer_max_quantity ?? product.max_app_order_quantity;
    const maxAllowedNum = Number(maxAllowed);
    const effectivePrice = product.active_offer
      ? Number(product.active_offer.offer_price) || 0
      : Number(product.price) || 0;

    // Only enforce limits for customers — admins/sub-admins have no restrictions
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

    const productForCart: Product = {
      ...product,
      price: effectivePrice,
      max_app_order_quantity: maxAllowed,
    };

    // Optimistic update
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => Number(i.product_id || i.id) === targetId);
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
            price: effectivePrice,
            quantity: 1,
            image_url: product.image_url,
            category_name: product.category_name,
            max_app_order_quantity: maxAllowed,
          },
        ];
      }
    });

    // Persist to storage
    const updatedCart = await addProductToCart(productForCart, 1);
    setCartItems([...updatedCart]);
  };

  const handleUpdateCartQty = async (productId: number | string, delta: number) => {
    const pId = Number(productId);
    const existing = cartItems.find((i) => Number(i.product_id || i.id) === pId);

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

    // Optimistic update
    setCartItems((prev) => {
      const updated = prev
        .map((item) => {
          if (Number(item.product_id || item.id) === pId) {
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

    // Persist to storage
    const updatedCart = await updateCartItemQty(pId, delta);
    setCartItems([...updatedCart]);
  };

  const totalCartItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Header */}
      <View style={styles.topAppBar}>
        <Text style={styles.brandTitle}>أبو الدهب - الخردوات والمنظفات والورقيات</Text>
      </View>

      <FlatList
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E5A44"]} />
        }
        data={loading ? [] : products}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={loadMoreShopProducts}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <>
            {/* Category Filter Chips Bar */}
            <View style={styles.categoryFilterWrapper}>
              <Text style={styles.filterSectionTitle}>التصفية حسب الفئة والأقسام</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsContainer}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    selectedCategory === 'all' && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === 'all' && styles.categoryChipTextActive,
                    ]}
                  >
                    الكل
                  </Text>
                </TouchableOpacity>

                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === cat.id && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {loading && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2D3C1F" />
                <Text style={styles.loadingText}>جاري تحميل الخردوات والمنظفات والورقيات...</Text>
              </View>
            )}
            {!loading && products.length === 0 && (
              <View style={styles.centerContainer}>
                <MaterialIcons name="inventory-2" size={48} color="#75786E" />
                <Text style={styles.emptyText}>لا توجد خردوات أو منظفات أو ورقيات في هذه الفئة حالياً</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          if (!item) return null;
          const itemId = Number(item.id);
          const isFav = favoriteIds.includes(itemId);
          const cartItem = cartItems.find((i) => Number(i.product_id || i.id) === itemId);
          const qtyInCart = cartItem?.quantity || 0;
          const hasOffer = Boolean(item.active_offer);

          return (
            <View style={[styles.productCard, { width: '48%', marginBottom: 0 }]}>
              <View style={styles.imageContainer}>
                <TouchableOpacity
                  style={styles.heartBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => handleToggleFavorite(itemId)}
                >
                  <MaterialIcons
                    name={isFav ? "favorite" : "favorite-border"}
                    size={18}
                    color={isFav ? "#BA1A1A" : "#75786E"}
                  />
                </TouchableOpacity>

                {item.max_app_order_quantity ? (
                  <View style={styles.limitBadge}>
                    <Text style={styles.limitBadgeText} numberOfLines={1}>
                      حد: {item.max_app_order_quantity} قطعة
                    </Text>
                  </View>
                ) : null}

                {hasOffer ? (
                  <View style={styles.offerDiscountBadge}>
                    <Text style={styles.offerDiscountText}>
                      -{item.active_offer?.discount_percentage}%
                    </Text>
                  </View>
                ) : null}

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

              <Text style={styles.subCategory}>{item.category_name || "خردوات ومنظفات وورقيات"}</Text>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>

              {hasOffer ? (
                <View style={styles.priceRow}>
                  <Text style={styles.productPrice}>
                    {(Number(item.active_offer?.offer_price) || 0).toFixed(2)} ج.م
                  </Text>
                  <Text style={styles.oldPriceText}>
                    {(Number(item.active_offer?.original_price) || Number(item.price)).toFixed(2)} ج.م
                  </Text>
                </View>
              ) : (
                <Text style={styles.productPrice}>{(Number(item.price) || 0).toFixed(2)} ج.م</Text>
              )}

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
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center', width: '100%' }}>
              <ActivityIndicator size="small" color="#2D3C1F" />
              <Text style={{ fontSize: 11, color: '#75786E', marginTop: 4, fontWeight: '600' }}>جاري تحميل المزيد من المنتجات...</Text>
            </View>
          ) : null
        }
      />

      {/* Sticky Bottom Footer Navigation */}
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
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  scrollContent: {
    flex: 1,
  },
  categoryFilterWrapper: {
    marginTop: 14,
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F1B13',
    paddingHorizontal: 20,
    marginBottom: 8,
    textAlign: 'right',
  },
  categoryChipsContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  categoryChipActive: {
    backgroundColor: '#D4EAB7',
    borderColor: '#D4EAB7',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#75786E',
  },
  categoryChipTextActive: {
    color: '#2D3C1F',
    fontWeight: 'bold',
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
  imageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F6EDE0',
    borderRadius: 16,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  heartBtn: {
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
  subCategory: {
    fontSize: 10,
    color: '#75786E',
    textAlign: 'right',
  },
  productName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
    marginVertical: 2,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2D3C1F',
    textAlign: 'right',
    marginTop: 2,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  oldPriceText: {
    fontSize: 11,
    color: '#9A978F',
    textDecorationLine: 'line-through',
  },
  limitBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  limitBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#92400E',
  },
  offerDiscountBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#BA1A1A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  offerDiscountText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#2D3C1F',
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: 'center',
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
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#75786E',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#75786E',
  },
});
