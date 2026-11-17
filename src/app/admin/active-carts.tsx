import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchActiveCarts,
  fetchActiveCartsPaginated,
  fetchRegions,
  updateActiveCartItemQty,
  deleteAppUserCartItem,
  clearActiveCart,
  checkoutActiveCart,
  searchProductsForCart,
  ActiveCartEntry,
  ActiveCartItem,
  Region,
  Product,
} from '../../services/api';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import MobileFooterNav from '../../components/mobile-footer';

export default function AdminActiveCartsScreen() {
  useRoleGuard('admin');
  const router = useRouter();

  const [activeCarts, setActiveCarts] = useState<ActiveCartEntry[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | number>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Selected Cart for Details Modal
  const [selectedCart, setSelectedCart] = useState<ActiveCartEntry | null>(null);

  // Product Search inside Modal
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Mutation Loading states
  const [actionLoading, setActionLoading] = useState(false);

  const loadCarts = useCallback(async (pageToLoad: number = 1) => {
    if (pageToLoad === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetchActiveCartsPaginated(pageToLoad, searchQuery, selectedRegion);
      if (pageToLoad === 1) {
        setActiveCarts(res.carts);
      } else {
        setActiveCarts((prev) => {
          const existingIds = new Set(prev.map((c) => c.user.id));
          const newItems = res.carts.filter((c) => !existingIds.has(c.user.id));
          return [...prev, ...newItems];
        });
      }
      setNextPage(res.nextPage);
    } catch (e) {
      console.warn('loadCarts error:', e);
      if (pageToLoad === 1) setActiveCarts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedRegion]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const regionsList = await fetchRegions();
      if (Array.isArray(regionsList) && regionsList.length > 0) {
        setRegions(regionsList);
      }
      await loadCarts(1);
    } catch (e) {
      console.warn('loadInitialData error:', e);
    } finally {
      setLoading(false);
    }
  }, [loadCarts]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadCarts(1);
  }, [searchQuery, selectedRegion, loadCarts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCarts(1);
  };

  const handleLoadMore = () => {
    if (!loadingMore && !loading && nextPage !== null) {
      loadCarts(nextPage);
    }
  };

  // Product search inside Modal
  useEffect(() => {
    if (!productSearch || productSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const results = await searchProductsForCart(productSearch.trim());
        setSearchResults(results);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  // Update item quantity (+ / -)
  const handleUpdateItemQty = async (productId: number, delta: number) => {
    if (!selectedCart || actionLoading) return;
    const currentItem = selectedCart.items.find((i) => i.id === productId);
    if (!currentItem) return;

    const newQty = (parseFloat(String(currentItem.quantity)) || 0) + delta;
    if (newQty <= 0) {
      Alert.alert('حذف الصنف', 'هل تريد حذف هذا المنتج من سلة العميل؟', [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const res = await deleteAppUserCartItem(selectedCart.user.id, productId);
            setActionLoading(false);
            if (res.success) {
              setSelectedCart((prev) => {
                if (!prev) return null;
                const newItems = prev.items.filter((i) => i.id !== productId);
                if (newItems.length === 0) return null;
                return { ...prev, items: newItems };
              });
              loadCarts();
            } else {
              Alert.alert('خطأ', res.message);
            }
          },
        },
      ]);
      return;
    }

    setActionLoading(true);
    const res = await updateActiveCartItemQty(selectedCart.user.id, productId, { delta });
    setActionLoading(false);

    if (res.success) {
      setSelectedCart((prev) => {
        if (!prev) return null;
        const newItems = prev.items.map((i) =>
          i.id === productId ? { ...i, quantity: newQty } : i
        );
        return { ...prev, items: newItems };
      });
      loadCarts();
    } else {
      Alert.alert('تنبيه', res.message);
    }
  };

  // Add product to cart from search
  const handleAddProductToCart = async (product: Product) => {
    if (!selectedCart || actionLoading) return;
    setActionLoading(true);

    const res = await updateActiveCartItemQty(selectedCart.user.id, Number(product.id), { delta: 1 });
    setActionLoading(false);

    if (res.success) {
      setSelectedCart((prev) => {
        if (!prev) return null;
        const existing = prev.items.find((i) => i.id === Number(product.id));
        if (existing) {
          const newItems = prev.items.map((i) =>
            i.id === Number(product.id)
              ? { ...i, quantity: (parseFloat(String(i.quantity)) || 0) + 1 }
              : i
          );
          return { ...prev, items: newItems };
        } else {
          const effPrice = (product as any).active_offer?.offer_price ?? product.price;
          const newItem: ActiveCartItem = {
            id: Number(product.id),
            name: product.name,
            price: Number(effPrice),
            original_price: Number(product.price),
            has_offer: Boolean((product as any).active_offer),
            image_url: product.image_url || null,
            quantity: 1,
            unit: product.unit || '',
            subtotal: Number(effPrice),
          };
          return { ...prev, items: [...prev.items, newItem] };
        }
      });
      setProductSearch('');
      setSearchResults([]);
      loadCarts();
    } else {
      Alert.alert('تنبيه', res.message);
    }
  };

  // Checkout Cart (Complete Order)
  const handleCheckoutCart = (cartEntry: ActiveCartEntry) => {
    Alert.alert(
      'إتمام الطلب',
      `هل أنت متأكد من إتمام الطلب للعميل "${cartEntry.user.name}" وتحويله إلى طلب مؤكد؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إتمام الطلب الآن',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            const res = await checkoutActiveCart(cartEntry.user.id);
            setActionLoading(false);
            if (res.success) {
              setSelectedCart(null);
              Alert.alert('نجاح', res.message);
              loadCarts();
            } else {
              Alert.alert('خطأ', res.message);
            }
          },
        },
      ]
    );
  };

  // Clear Cart
  const handleClearCart = (userId: number) => {
    Alert.alert('تفريغ السلة', 'هل أنت متأكد من تفريغ سلة هذا العميل بالكامل؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تفريغ السلة',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          const res = await clearActiveCart(userId);
          setActionLoading(false);
          if (res.success) {
            setSelectedCart(null);
            loadCarts();
          } else {
            Alert.alert('خطأ', res.message);
          }
        },
      },
    ]);
  };

  // Helper currency format
  const formatMoney = (val?: number | string) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculations for selected cart in modal
  const modalItems = selectedCart?.items || [];
  const modalItemsCount = modalItems.length;
  const modalTotalQty = modalItems.reduce((acc, it) => acc + (parseFloat(String(it.quantity)) || 0), 0);
  const modalTotalPrice = modalItems.reduce(
    (acc, it) => acc + (parseFloat(String(it.price)) || 0) * (parseFloat(String(it.quantity)) || 0),
    0
  );

  const selectedCartUserRegion = selectedCart
    ? regions.find(
        (r) =>
          (selectedCart.user.region_id && r.id == selectedCart.user.region_id) ||
          (selectedCart.user.region && r.name == selectedCart.user.region)
      )
    : null;
  const modalRegionName =
    selectedCart?.region_limits?.region_name ||
    selectedCart?.user.region ||
    selectedCartUserRegion?.name ||
    'المنطقة';
  const modalMinTotal =
    selectedCart?.region_limits?.min_order_total !== undefined
      ? Number(selectedCart.region_limits.min_order_total)
      : (selectedCartUserRegion ? Number(selectedCartUserRegion.min_order_total || 0) : 0);
  const modalRemainingTotal = Math.max(0, modalMinTotal - modalTotalPrice);
  const modalIsLimitMet = modalMinTotal <= 0 || modalTotalPrice >= modalMinTotal;

  // Filter active carts by selected region and search query
  const filteredCarts = useMemo(() => {
    return activeCarts.filter((cart) => {
      // 1. Region filter
      if (selectedRegion !== 'all') {
        const userRegId = cart.user.region_id;
        const userRegName = cart.user.region;
        const selectedRegObj = regions.find((r) => r.id == selectedRegion);
        const selectedRegName = selectedRegObj?.name ? selectedRegObj.name.trim().toLowerCase() : '';

        const matchesRegionId = userRegId && String(userRegId) === String(selectedRegion);
        const matchesRegionName = selectedRegName && userRegName && (
          userRegName.trim().toLowerCase() === selectedRegName ||
          userRegName.trim().toLowerCase().includes(selectedRegName) ||
          selectedRegName.includes(userRegName.trim().toLowerCase())
        );

        // Also check if address, shop name, or customer name contains the selected region name
        const fullText = `${cart.user.address || ''} ${cart.user.shop_name || ''} ${cart.user.name || ''}`.toLowerCase();
        const matchesText = selectedRegName && fullText.includes(selectedRegName);

        if (!matchesRegionId && !matchesRegionName && !matchesText) {
          return false;
        }
      }

      // 2. Search query filter
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = (cart.user.name || '').toLowerCase();
        const phone = (cart.user.phone || '').toLowerCase();
        const shop = (cart.user.shop_name || '').toLowerCase();
        const address = (cart.user.address || '').toLowerCase();
        const region = (cart.user.region || '').toLowerCase();

        return name.includes(q) || phone.includes(q) || shop.includes(q) || address.includes(q) || region.includes(q);
      }

      return true;
    });
  }, [activeCarts, selectedRegion, searchQuery, regions]);

  // Render Single Cart Card
  const renderCartCard = ({ item }: { item: ActiveCartEntry }) => {
    const totalQty = item.total_quantity !== undefined
      ? item.total_quantity
      : item.items.reduce((acc, it) => acc + (parseFloat(String(it.quantity)) || 0), 0);

    const totalPrice = item.total_price !== undefined
      ? item.total_price
      : item.items.reduce(
          (acc, it) => acc + (parseFloat(String(it.price)) || 0) * (parseFloat(String(it.quantity)) || 0),
          0
        );

    // Smart region limit resolution (from API, profile match, or address scan)
    let userRegion = regions.find(
      (r) =>
        (item.user.region_id && r.id == item.user.region_id) ||
        (item.user.region && (
          r.name.trim().toLowerCase() === String(item.user.region).trim().toLowerCase() ||
          r.name.includes(String(item.user.region)) ||
          String(item.user.region).includes(r.name)
        ))
    );

    // Fallback: search address or shop name for region name if still unassigned
    if (!userRegion && regions.length > 0) {
      const fullText = `${item.user.address || ''} ${item.user.shop_name || ''} ${item.user.name || ''}`;
      userRegion = regions.find((r) => r.name && fullText.includes(r.name));
    }

    const regionName =
      (item.region_limits?.region_name && item.region_limits.region_name !== 'غير محددة' ? item.region_limits.region_name : null) ||
      (item.user.region && item.user.region !== '—' && item.user.region !== 'غير محددة' ? item.user.region : null) ||
      userRegion?.name ||
      null;

    const minOrderTotal =
      item.region_limits?.min_order_total !== undefined && Number(item.region_limits.min_order_total) > 0
        ? Number(item.region_limits.min_order_total)
        : (userRegion ? Number(userRegion.min_order_total || 0) : 0);
    const remainingTotal =
      item.region_limits?.remaining_total !== undefined && Number(item.region_limits.min_order_total) > 0
        ? Number(item.region_limits.remaining_total)
        : Math.max(0, minOrderTotal - totalPrice);
    const isLimitMet =
      item.region_limits?.is_limit_met !== undefined
        ? item.region_limits.is_limit_met
        : (minOrderTotal <= 0 || totalPrice >= minOrderTotal);

    const percent = minOrderTotal > 0 ? Math.min(100, Math.round((totalPrice / minOrderTotal) * 100)) : 100;

    return (
      <View style={styles.card}>
        {/* Customer Header */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(item.user.name || 'ع').charAt(0)}</Text>
          </View>

          <View style={styles.customerInfoBox}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName}>{item.user.name}</Text>
              {item.user.registered_from_app && (
                <View style={styles.appBadge}>
                  <Text style={styles.appBadgeText}>📱 تطبيق</Text>
                </View>
              )}
            </View>

            {/* Region & Phone badges row */}
            <View style={styles.metaRow}>
              {regionName ? (
                <View style={styles.regionBadge}>
                  <MaterialIcons name="location-on" size={13} color="#1E3E2B" />
                  <Text style={styles.regionBadgeText}>{regionName}</Text>
                </View>
              ) : (
                <View style={[styles.regionBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <MaterialIcons name="location-off" size={13} color="#B45309" />
                  <Text style={[styles.regionBadgeText, { color: '#B45309' }]}>لم تحدد المنطقة</Text>
                </View>
              )}

              {item.user.phone && item.user.phone !== '—' && (
                <View style={styles.phoneBadge}>
                  <MaterialIcons name="phone" size={12} color="#556052" />
                  <Text style={styles.customerPhone}>{item.user.phone}</Text>
                </View>
              )}
            </View>

            {item.user.shop_name && item.user.shop_name !== '—' && (
              <Text style={styles.shopNameText}>🏪 {item.user.shop_name}</Text>
            )}

            {item.user.address && item.user.address !== '—' && (
              <Text style={styles.shopNameText} numberOfLines={1}>📍 {item.user.address}</Text>
            )}

            <Text style={styles.lastActivityText}>آخر إضافة: {item.last_added_date}</Text>
          </View>
        </View>

        {/* Region Limits Status Banner */}
        {regionName ? (
          minOrderTotal > 0 ? (
            isLimitMet ? (
              <View style={styles.limitMetBanner}>
                <View style={styles.limitRow}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="check-circle" size={18} color="#15803D" />
                    <Text style={styles.limitMetTitle}>تم استيفاء حد طلب المنطقة</Text>
                  </View>
                  <View style={styles.limitMetPill}>
                    <Text style={styles.limitMetPillText}>مستوفي الحد ✅</Text>
                  </View>
                </View>
                <Text style={styles.limitMetSub}>
                  حد منطقة {regionName}: {formatMoney(minOrderTotal)} ج.م • طلب العميل الحالي: {formatMoney(totalPrice)} ج.م
                </Text>
              </View>
            ) : (
              <View style={styles.limitPendingBanner}>
                <View style={styles.limitRow}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="error-outline" size={18} color="#D97706" />
                    <Text style={styles.limitPendingTitle}>فاضل على حد منطقة {regionName}:</Text>
                  </View>
                  <View style={styles.limitPendingAmountBadge}>
                    <Text style={styles.limitPendingAmountText}>{formatMoney(remainingTotal)} ج.م</Text>
                  </View>
                </View>

                {/* Visual Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                </View>

                <View style={styles.progressLabelsRow}>
                  <Text style={styles.progressSubText}>
                    تم جمع {formatMoney(totalPrice)} من {formatMoney(minOrderTotal)} ج.م
                  </Text>
                  <Text style={styles.progressPercentText}>{percent}%</Text>
                </View>
              </View>
            )
          ) : (
            <View style={styles.noLimitBanner}>
              <MaterialIcons name="info-outline" size={15} color="#64748B" />
              <Text style={styles.noLimitText}>
                منطقة العميل ({regionName}): لا يوجد حد أدنى للطلب
              </Text>
            </View>
          )
        ) : (
          <View style={styles.noLimitBanner}>
            <MaterialIcons name="info-outline" size={15} color="#B45309" />
            <Text style={[styles.noLimitText, { color: '#B45309' }]}>
              لم يتم تحديد منطقة لهذا العميل في حسابه
            </Text>
          </View>
        )}

        {/* Cart Contents Summary Strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryColRight}>
            <View style={styles.cartIconCircle}>
              <MaterialIcons name="shopping-cart" size={16} color="#1E3E2B" />
            </View>
            <View>
              <Text style={styles.stripLabel}>محتويات السلة</Text>
              <Text style={styles.stripValue}>
                {item.items_count} أصناف ({totalQty} قطعة)
              </Text>
            </View>
          </View>

          <View style={styles.summaryColLeft}>
            <Text style={styles.stripLabel}>إجمالي الحساب</Text>
            <Text style={styles.totalPriceText}>{formatMoney(totalPrice)} ج.م</Text>
            {minOrderTotal > 0 && !isLimitMet && (
              <Text style={styles.remainingUnderPrice}>
                (فاضل: {formatMoney(remainingTotal)} ج.م)
              </Text>
            )}
          </View>
        </View>

        {/* Card Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setSelectedCart(item)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="visibility" size={16} color="#1E3E2B" />
            <Text style={styles.detailsBtnText}>معاينة وتعديل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => handleCheckoutCart(item)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="check" size={16} color="#FFFFFF" />
            <Text style={styles.checkoutBtnText}>إتمام الطلب</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/admin')}>
          <MaterialIcons name="arrow-forward" size={24} color="#1A2D23" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>السلال النشطة للعملاء</Text>
        <View style={styles.activeCountBadge}>
          <Text style={styles.activeCountText}>{filteredCarts.length}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Search Input */}
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#7C7870" />
          <TextInput
            style={styles.searchInput}
            placeholder="بحث بالاسم، الهاتف، المحل، المنطقة..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9A978F"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color="#7C7870" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Region Filter Chips */}
        <View style={styles.regionsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.regionsContainer}
          >
            <TouchableOpacity
              style={[
                styles.regionChip,
                selectedRegion === 'all' && styles.regionChipActive,
              ]}
              onPress={() => setSelectedRegion('all')}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="layers"
                size={16}
                color={selectedRegion === 'all' ? '#FFFFFF' : '#1A2D23'}
              />
              <Text
                style={[
                  styles.regionChipText,
                  selectedRegion === 'all' && styles.regionChipTextActive,
                ]}
              >
                كل المناطق
              </Text>
            </TouchableOpacity>

            {regions.map((reg) => {
              const isSelected = selectedRegion == reg.id;
              return (
                <TouchableOpacity
                  key={reg.id}
                  style={[
                    styles.regionChip,
                    isSelected && styles.regionChipActive,
                  ]}
                  onPress={() => setSelectedRegion(reg.id)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="location-on"
                    size={16}
                    color={isSelected ? '#A7F3D0' : '#2D3C1F'}
                  />
                  <Text
                    style={[
                      styles.regionChipText,
                      isSelected && styles.regionChipTextActive,
                    ]}
                  >
                    {reg.name}
                  </Text>
                  {Number(reg.min_order_total) > 0 && (
                    <View
                      style={[
                        styles.regionLimitPill,
                        isSelected && styles.regionLimitPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.regionLimitPillText,
                          isSelected && styles.regionLimitPillTextActive,
                        ]}
                      >
                        {formatMoney(reg.min_order_total)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active Carts List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2E5A44" />
            <Text style={styles.loadingText}>جاري تحميل السلال النشطة...</Text>
          </View>
        ) : filteredCarts.length === 0 ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="remove-shopping-cart" size={48} color="#D5D2C4" />
            <Text style={styles.emptyTitle}>لا توجد سلال تطابق الفلتر</Text>
            <Text style={styles.emptySubtitle}>
              {selectedRegion !== 'all'
                ? `لم يتم العثور على سلال نشطة في منطقة ${regions.find((r) => r.id == selectedRegion)?.name || 'المحددة'}`
                : searchQuery
                ? 'لم يتم العثور على سلال تطابق كلمة البحث'
                : 'جميع سلال العملاء فارغة حالياً'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCarts}
            keyExtractor={(item) => String(item.user.id)}
            renderItem={renderCartCard}
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E5A44']} />
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color="#2E5A44" />
                  <Text style={styles.footerLoaderText}>جاري تحميل المزيد من السلال...</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>

      {/* Cart Details & Edit Modal */}
      <Modal
        visible={Boolean(selectedCart)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedCart(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedCart(null)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={22} color="#1A2D23" />
              </TouchableOpacity>
              <View style={styles.modalTitleBox}>
                <Text style={styles.modalTitle}>{selectedCart?.user.name}</Text>
                <Text style={styles.modalSubtitle}>{selectedCart?.user.phone}</Text>
              </View>
              <View style={{ width: 32 }} />
            </View>

            {/* Region Limit Banner in Modal */}
            {modalMinTotal > 0 && (
              <View
                style={[
                  styles.modalRegionBanner,
                  modalIsLimitMet ? styles.modalLimitMet : styles.modalLimitPending,
                ]}
              >
                <MaterialIcons
                  name={modalIsLimitMet ? 'check-circle' : 'error-outline'}
                  size={18}
                  color={modalIsLimitMet ? '#15803D' : '#D97706'}
                />
                <Text
                  style={[
                    styles.modalRegionText,
                    { color: modalIsLimitMet ? '#15803D' : '#B45309' },
                  ]}
                >
                  {modalIsLimitMet
                    ? `تم استيفاء حد طلبات منطقة ${modalRegionName} (${formatMoney(modalMinTotal)} ج.م)`
                    : `فاضل ${formatMoney(modalRemainingTotal)} ج.م لتحقيق حد طلبات ${modalRegionName} (${formatMoney(modalMinTotal)} ج.م)`}
                </Text>
              </View>
            )}

            <ScrollView style={styles.modalScroll}>
              {/* Add Product Search Input */}
              <View style={styles.addProductSection}>
                <Text style={styles.addProductLabel}>إضافة منتج لسلة العميل:</Text>
                <View style={styles.productSearchBox}>
                  <MaterialIcons name="search" size={18} color="#7C7870" />
                  <TextInput
                    style={styles.productSearchInput}
                    placeholder="ابحث باسم المنتج لإضافته..."
                    value={productSearch}
                    onChangeText={setProductSearch}
                    placeholderTextColor="#9A978F"
                  />
                  {searchingProducts && <ActivityIndicator size="small" color="#2E5A44" />}
                </View>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <View style={styles.searchResultsList}>
                    {searchResults.map((prod) => {
                      const effPrice = (prod as any).active_offer?.offer_price ?? prod.price;
                      const inStock = prod.stock > 0;
                      return (
                        <View key={prod.id} style={styles.searchItemRow}>
                          <View style={styles.searchItemInfo}>
                            <Text style={styles.searchItemName}>{prod.name}</Text>
                            <Text style={styles.searchItemPrice}>
                              {formatMoney(effPrice)} ج.م / {prod.unit || 'وحدة'} •{' '}
                              <Text style={inStock ? styles.inStockText : styles.outStockText}>
                                {inStock ? `المتاح: ${prod.stock}` : 'نفذت'}
                              </Text>
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.addSearchBtn,
                              !inStock && styles.disabledBtn,
                            ]}
                            disabled={!inStock || actionLoading}
                            onPress={() => handleAddProductToCart(prod)}
                          >
                            <MaterialIcons name="add" size={16} color="#FFFFFF" />
                            <Text style={styles.addSearchBtnText}>إضافة</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Items List Header */}
              <View style={styles.itemsHeader}>
                <TouchableOpacity
                  onPress={() => selectedCart && handleClearCart(selectedCart.user.id)}
                  style={styles.clearCartBtn}
                >
                  <MaterialIcons name="delete-outline" size={16} color="#DC2626" />
                  <Text style={styles.clearCartText}>تفريغ السلة</Text>
                </TouchableOpacity>

                <View style={styles.itemsBadge}>
                  <Text style={styles.itemsBadgeText}>{modalItemsCount} أصناف بالسلة</Text>
                </View>
              </View>

              {/* Items List */}
              <View style={styles.modalItemsList}>
                {modalItems.map((item) => (
                  <View key={item.id} style={styles.cartItemRow}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.itemImg} />
                    ) : (
                      <View style={styles.itemImgPlaceholder}>
                        <MaterialIcons name="inventory-2" size={20} color="#D5D2C4" />
                      </View>
                    )}

                    <View style={styles.itemMainInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>
                        {formatMoney(item.price)} ج.م • الإجمالي:{' '}
                        <Text style={styles.itemSubtotal}>
                          {formatMoney(Number(item.price) * Number(item.quantity))} ج.م
                        </Text>
                      </Text>
                    </View>

                    {/* Quantity Adjustment (+ / -) */}
                    <View style={styles.qtyControlBox}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleUpdateItemQty(item.id, 1)}
                        disabled={actionLoading}
                      >
                        <MaterialIcons name="add" size={16} color="#2E5A44" />
                      </TouchableOpacity>

                      <Text style={styles.qtyText}>{item.quantity}</Text>

                      <TouchableOpacity
                        style={[styles.qtyBtn, styles.qtyMinusBtn]}
                        onPress={() => handleUpdateItemQty(item.id, -1)}
                        disabled={actionLoading}
                      >
                        <MaterialIcons name="remove" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Modal Footer Summary & Checkout */}
            <View style={styles.modalFooter}>
              <View style={styles.modalSummaryBox}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>توتال العناصر</Text>
                  <Text style={styles.summaryItemValue}>
                    {modalItemsCount} أصناف ({modalTotalQty} قطعة)
                  </Text>
                </View>

                <View style={styles.summaryItemLeft}>
                  <Text style={styles.summaryItemLabel}>توتال الحساب</Text>
                  <Text style={styles.summaryTotalValue}>{formatMoney(modalTotalPrice)} ج.م</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.confirmCheckoutBtn}
                onPress={() => selectedCart && handleCheckoutCart(selectedCart)}
                disabled={actionLoading || modalItemsCount === 0}
              >
                <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                <Text style={styles.confirmCheckoutText}>إتمام وتأكيد الطلب الآن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <MobileFooterNav isAdmin />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE8E2',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  backBtn: {
    padding: 4,
  },
  activeCountBadge: {
    backgroundColor: '#EEF4F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0E2D8',
  },
  activeCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1A2D23',
    textAlign: 'right',
  },
  regionsWrapper: {
    marginBottom: 12,
  },
  regionsContainer: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  regionChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4C7B5',
    elevation: 2,
    shadowColor: '#1F1B13',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  regionChipActive: {
    backgroundColor: '#1E3E2B',
    borderColor: '#1E3E2B',
  },
  regionChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2D23',
  },
  regionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  regionLimitPill: {
    backgroundColor: '#F3EDE2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  regionLimitPillActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  regionLimitPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#75786E',
  },
  regionLimitPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 20,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#7C7870',
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A2D23',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9A978F',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E5A44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerInfoBox: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  appBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  appBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4338CA',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  regionBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  regionBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E3E2B',
  },
  phoneBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5F5F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  customerPhone: {
    fontSize: 12,
    color: '#556052',
    fontWeight: '600',
  },
  shopNameText: {
    fontSize: 11,
    color: '#556052',
    fontWeight: '600',
    marginTop: 2,
  },
  lastActivityText: {
    fontSize: 11,
    color: '#B8B5AE',
    marginTop: 2,
  },
  limitMetBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 4,
  },
  limitMetTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
  },
  limitMetPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  limitMetPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
  },
  limitMetSub: {
    fontSize: 11,
    color: '#166534',
    textAlign: 'right',
  },
  limitPendingBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 6,
  },
  limitRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitPendingTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#B45309',
  },
  limitPendingAmountBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  limitPendingAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#B45309',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 4,
  },
  progressLabelsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSubText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '500',
  },
  progressPercentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#B45309',
  },
  noLimitBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  noLimitText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  remainingUnderPrice: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
    marginTop: 2,
  },
  limitLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  limitAmount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B45309',
  },
  limitSub: {
    fontSize: 10,
    color: '#92400E',
    textAlign: 'right',
  },
  summaryStrip: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F2EFE9',
    marginBottom: 14,
  },
  summaryColRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  cartIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryColLeft: {
    alignItems: 'flex-start',
  },
  stripLabel: {
    fontSize: 10,
    color: '#7C7870',
    fontWeight: '500',
  },
  stripValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E5A44',
    marginTop: 2,
  },
  totalPriceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A2D23',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#EAE8E2',
    paddingTop: 12,
  },
  detailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF4F1',
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  checkoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2E5A44',
    borderRadius: 12,
    paddingVertical: 10,
  },
  checkoutBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE8E2',
    backgroundColor: '#FAF9F6',
  },
  closeBtn: {
    padding: 4,
  },
  modalTitleBox: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#7C7870',
    marginTop: 2,
  },
  modalRegionBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modalLimitMet: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  modalLimitPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  modalRegionText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  addProductSection: {
    backgroundColor: '#FAF9F6',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    marginBottom: 16,
  },
  addProductLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A2D23',
    textAlign: 'right',
    marginBottom: 8,
  },
  productSearchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    gap: 6,
  },
  productSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1A2D23',
    textAlign: 'right',
  },
  searchResultsList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0E2D8',
    maxHeight: 180,
  },
  searchItemRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF9F6',
  },
  searchItemInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  searchItemName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  searchItemPrice: {
    fontSize: 11,
    color: '#2E5A44',
    marginTop: 2,
  },
  inStockText: {
    color: '#047857',
    fontWeight: 'bold',
  },
  outStockText: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  addSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E5A44',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  disabledBtn: {
    backgroundColor: '#D1D5DB',
  },
  addSearchBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDEEEC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearCartText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  itemsBadge: {
    backgroundColor: '#EEF4F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  itemsBadgeText: {
    fontSize: 11,
    color: '#2E5A44',
    fontWeight: 'bold',
  },
  modalItemsList: {
    gap: 10,
    marginBottom: 20,
  },
  cartItemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    gap: 10,
  },
  itemImg: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  itemImgPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAE8E2',
  },
  itemMainInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  itemPrice: {
    fontSize: 11,
    color: '#7C7870',
    marginTop: 2,
  },
  itemSubtotal: {
    color: '#2E5A44',
    fontWeight: 'bold',
  },
  qtyControlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    padding: 2,
    gap: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAE8E2',
  },
  qtyMinusBtn: {
    backgroundColor: '#FDEEEC',
    borderColor: '#FCD34D',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A2D23',
    minWidth: 22,
    textAlign: 'center',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAE8E2',
    backgroundColor: '#FAF9F6',
    gap: 12,
  },
  modalSummaryBox: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE8E2',
  },
  summaryItem: {
    alignItems: 'flex-end',
  },
  summaryItemLeft: {
    alignItems: 'flex-start',
  },
  summaryItemLabel: {
    fontSize: 10,
    color: '#9A978F',
    fontWeight: 'bold',
  },
  summaryItemValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A2D23',
    marginTop: 2,
  },
  summaryTotalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2E5A44',
    marginTop: 2,
  },
  confirmCheckoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A44',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  confirmCheckoutText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 12,
    color: '#75786E',
    fontWeight: 'bold',
  },
});
