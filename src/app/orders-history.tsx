import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { AppImage } from '../components/app-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import MobileFooterNav from '../components/mobile-footer';
import { fetchCustomerOrdersPaginated } from '../services/api';
import { useRoleGuard } from '../hooks/useRoleGuard';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'قيد الانتظار', color: '#92400E', bg: '#FEF3C7' },
  confirmed: { label: 'تم التأكيد',   color: '#166534', bg: '#DCFCE7' },
  shipped:   { label: 'تم الشحن',     color: '#1E40AF', bg: '#DBEAFE' },
  completed: { label: 'مكتمل',        color: '#166534', bg: '#DCFCE7' },
  delivered: { label: 'تم التوصيل',   color: '#2D3C1F', bg: '#D4EAB7' },
  cancelled: { label: 'ملغي',         color: '#991B1B', bg: '#FEE2E2' },
};

export default function OrdersHistoryScreen() {
  useRoleGuard('customer');
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<number | string | null>(null);

  const loadOrders = useCallback(async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
      try {
        const res = await fetchCustomerOrdersPaginated(1);
        setOrders(Array.isArray(res.orders) ? res.orders : []);
        setNextPage(res.nextPage);
      } catch (e) {
        setOrders([]);
        setNextPage(null);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const loadMoreOrders = async () => {
    if (!nextPage || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await fetchCustomerOrdersPaginated(nextPage);
      if (Array.isArray(res.orders) && res.orders.length > 0) {
        setOrders((prev) => [...prev, ...res.orders]);
      }
      setNextPage(res.nextPage);
    } catch (e) {
      // keep current orders
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadOrders(true);
  }, [loadOrders]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Header with Back button */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={24} color="#1F1B13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل الطلبات والتعليمات</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={loading ? [] : orders}
        keyExtractor={(item, index) => String(item.raw_id || item.id || index)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
        onEndReached={loadMoreOrders}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2D3C1F" />
              <Text style={styles.loadingText}>جاري تحميل سجل الطلبات...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="receipt-long" size={56} color="#75786E" />
              <Text style={styles.emptyTitle}>لا يوجد طلبات سابقة</Text>
              <Text style={styles.emptySub}>عند قيامك بطلب خردوات ومنظفات وورقيات ستظهر هنا فورياً</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (!item) return null;
          const orderId = item.id || (item.raw_id ? `#ORD-${String(item.raw_id).padStart(4, '0')}` : 'طلب');
          const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status || 'مكتمل', color: '#75786E', bg: '#F6EDE0' };
          const isExpanded = expandedOrder === (item.raw_id || item.id);
          const productsList = item.products || item.items || [];
          const netTotal = item.net_total || item.total || '0.00 ج.م';

          return (
            <TouchableOpacity
              style={styles.orderCard}
              onPress={() => setExpandedOrder(isExpanded ? null : (item.raw_id || item.id))}
              activeOpacity={0.85}
            >
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.orderTopRow}>
                    <Text style={styles.orderIdText}>{orderId}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderDateText}>{item.date || '—'}</Text>
                  <View style={styles.orderBottomRow}>
                    <Text style={styles.itemsCountText}>{productsList.length} منتجات</Text>
                    <Text style={styles.netTotalText}>
                      {typeof netTotal === 'number' ? `${netTotal.toFixed(2)} ج.م` : netTotal}
                    </Text>
                  </View>
                </View>
                <MaterialIcons
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={24}
                  color="#75786E"
                  style={{ marginRight: 8 }}
                />
              </View>

              {/* Expanded Products Details */}
              {isExpanded && (
                <View style={styles.orderItemsContainer}>
                  {item.notes ? (
                    <Text style={styles.orderNotesText}>📝 ملاحظات: {item.notes}</Text>
                  ) : null}
                  {productsList.map((prod: any, idx: number) => {
                    const prodName = prod.name || prod.product_name || 'منتج';
                    const prodQty = prod.quantity || prod.pivot?.quantity || 1;
                    const prodPrice = prod.price || prod.pivot?.price || 0;
                    const prodTotal = prod.total_price || (prodPrice * prodQty);

                    return (
                      <View key={idx} style={styles.orderItemRow}>
                        <View style={styles.orderItemRight}>
                          <AppImage
                            uri={prod.image_url}
                            style={styles.orderItemImage}
                            iconName="shopping-basket"
                            iconSize={24}
                          />
                          <View style={styles.orderItemInfo}>
                            <Text style={styles.orderItemNameText} numberOfLines={1}>
                              {prodName}
                            </Text>
                            <Text style={styles.orderItemQtyText}>
                              الكمية: {prodQty}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.orderItemPriceText}>
                          {(Number(prodTotal) || 0).toFixed(2)} ج.م
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center', width: '100%' }}>
              <ActivityIndicator size="small" color="#2D3C1F" />
              <Text style={{ fontSize: 11, color: '#75786E', marginTop: 4, fontWeight: '600' }}>
                جاري تحميل المزيد من الطلبات...
              </Text>
            </View>
          ) : null
        }
      />

      <MobileFooterNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1',
  },
  topAppBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF8F1',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#75786E',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 6,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  orderHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  orderTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  orderDateText: {
    fontSize: 11,
    color: '#75786E',
    textAlign: 'right',
    marginBottom: 8,
  },
  orderBottomRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsCountText: {
    fontSize: 12,
    color: '#75786E',
    fontWeight: '600',
  },
  netTotalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  orderItemsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F6EDE0',
  },
  orderNotesText: {
    fontSize: 12,
    color: '#45483F',
    backgroundColor: '#FAF5ED',
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
    textAlign: 'right',
  },
  orderItemRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF5ED',
  },
  orderItemRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  orderItemImage: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginLeft: 8,
    backgroundColor: '#F6EDE0',
  },
  orderItemInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  orderItemNameText: {
    fontSize: 13,
    color: '#1F1B13',
    textAlign: 'right',
  },
  orderItemQtyText: {
    fontSize: 11,
    color: '#75786E',
    marginTop: 2,
  },
  orderItemPriceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
});
