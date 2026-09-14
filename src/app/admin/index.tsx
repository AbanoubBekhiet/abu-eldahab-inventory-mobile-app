import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchAdminOrdersPaginated,
  updateOrderStatus,
  logoutCustomer,
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
} from '../../services/api';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import MobileFooterNav from '../../components/mobile-footer';

export default function AdminDashboardScreen() {
  useRoleGuard('admin');
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleLogout = async () => {
    Alert.alert('تسجيل الخروج', 'هل أنت تأكد من تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await logoutCustomer();
          router.replace('/login');
        },
      },
    ]);
  };

  useEffect(() => {
    loadOrders(1);
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders(1);
    setRefreshing(false);
  }, []);

  const loadOrders = async (pageToLoad: number = 1) => {
    if (pageToLoad === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetchAdminOrdersPaginated(pageToLoad);
      if (pageToLoad === 1) {
        setOrders(res.orders);
      } else {
        setOrders((prev) => [...prev, ...res.orders]);
      }
      setNextPage(res.nextPage);
    } catch (e) {
      if (pageToLoad === 1) setOrders([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && nextPage !== null) {
      loadOrders(nextPage);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case OrderStatus.CONFIRMED:
        return { color: '#166534', bg: '#DCFCE7', label: ORDER_STATUS_LABELS[OrderStatus.CONFIRMED] };
      case OrderStatus.SHIPPED:
        return { color: '#1E40AF', bg: '#DBEAFE', label: ORDER_STATUS_LABELS[OrderStatus.SHIPPED] };
      case OrderStatus.DELIVERED:
        return { color: '#2D3C1F', bg: '#D4EAB7', label: ORDER_STATUS_LABELS[OrderStatus.DELIVERED] };
      case OrderStatus.CANCELLED:
        return { color: '#991B1B', bg: '#FEE2E2', label: ORDER_STATUS_LABELS[OrderStatus.CANCELLED] };
      case OrderStatus.PENDING:
      default:
        return { color: '#92400E', bg: '#FEF3C7', label: ORDER_STATUS_LABELS[OrderStatus.PENDING] };
    }
  };

  const filterOrders = orders.filter((ord) => {
    const status = ord.status || OrderStatus.PENDING;
    const matchesFilter = selectedFilter === 'all' || status === selectedFilter;
    const name = (ord as any).customer || ord.customer_name || '';
    const ordId = String(ord.id || '');
    const ordNum = String(ord.order_number || '');
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ordId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ordNum.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleUpdateStatus = async (orderId: string | number, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await updateOrderStatus(orderId, newStatus);
      const info = getStatusColor(newStatus);
      setOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(orderId)
            ? { ...o, status: newStatus, status_label: info.label }
            : o
        )
      );
      setSelectedOrderForStatus(null);
    } catch (e) {
      Alert.alert('خطأ', 'تعذر تحديث حالة الطلب');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePromptChangeStatus = (ord: Order) => {
    setSelectedOrderForStatus(ord);
  };

  const renderOrderItem = useCallback(({ item: ord }: { item: Order }) => {
    const statusInfo = getStatusColor(ord.status);
    const amount = Number(ord.total_amount || ord.total || 0).toFixed(2);
    const custName = (ord as any).customer || ord.customer_name || 'عميل المتجر';

    return (
      <View style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}
            onPress={() => handlePromptChangeStatus(ord)}
          >
            <MaterialIcons name="edit" size={12} color={statusInfo.color} />
            <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
              {ord.status_label || statusInfo.label}
            </Text>
          </TouchableOpacity>

          <View style={styles.orderTitleBox}>
            <Text style={styles.orderId}>#{ord.order_number || ord.id}</Text>
            <Text style={styles.customerName}>{custName}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBody}>
          <View style={styles.bodyColRight}>
            <Text style={styles.bodyLabel}>تاريخ الطلب</Text>
            <Text style={styles.bodyValue}>{ord.date || ord.created_at || 'اليوم'}</Text>
          </View>

          <View style={styles.bodyColLeft}>
            <Text style={styles.bodyLabel}>المبلغ الإجمالي</Text>
            <Text style={styles.totalValue}>{amount} ج.م</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() =>
              router.push({
                pathname: '/admin/order-details',
                params: { id: ord.id, orderData: JSON.stringify(ord) },
              } as any)
            }
          >
            <MaterialIcons name="visibility" size={18} color="#1F1B13" />
            <Text style={styles.detailsBtnText}>التفاصيل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.processBtn}
            onPress={() => handlePromptChangeStatus(ord)}
          >
            <MaterialIcons name="swap-horiz" size={18} color="#FFFFFF" />
            <Text style={styles.processBtnText}>تغيير الحالة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Admin Top Header */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#BA1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة الطلبات</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.contentWrapper}>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#75786E" />
          <TextInput
            style={styles.searchInput}
            placeholder="البحث برقم الطلب أو اسم العميل..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9A978F"
          />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScrollView}
          contentContainerStyle={styles.chipsContainer}
        >
          {[
            { key: 'all', label: `الكل (${orders.length})` },
            { key: OrderStatus.PENDING, label: ORDER_STATUS_LABELS[OrderStatus.PENDING] },
            { key: OrderStatus.CONFIRMED, label: ORDER_STATUS_LABELS[OrderStatus.CONFIRMED] },
            { key: OrderStatus.SHIPPED, label: ORDER_STATUS_LABELS[OrderStatus.SHIPPED] },
            { key: OrderStatus.DELIVERED, label: ORDER_STATUS_LABELS[OrderStatus.DELIVERED] },
            { key: OrderStatus.CANCELLED, label: ORDER_STATUS_LABELS[OrderStatus.CANCELLED] },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                selectedFilter === chip.key && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(chip.key)}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.filterChipText,
                  selectedFilter === chip.key && styles.filterChipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Orders FlatList with Infinite Scrolling */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <FlatList
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2D3C1F"]} />
            }
            data={filterOrders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="receipt-long" size={48} color="#A8A29E" />
                <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
                <Text style={styles.emptySub}>لم يتم العثور على طلبات تطابق هذا التصفية.</Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color="#2D3C1F" />
                </View>
              ) : null
            }
          />
        )}
      </View>

      {/* Status Update Modal */}
      <Modal
        visible={Boolean(selectedOrderForStatus)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedOrderForStatus(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedOrderForStatus(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedOrderForStatus(null)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تحديث حالة الطلب</Text>
            </View>

            {selectedOrderForStatus && (
              <View style={styles.modalBody}>
                <Text style={styles.modalSubTitle}>
                  طلب #{selectedOrderForStatus.order_number || selectedOrderForStatus.id}
                </Text>

                <View style={styles.statusOptionsList}>
                  {[
                    OrderStatus.PENDING,
                    OrderStatus.CONFIRMED,
                    OrderStatus.SHIPPED,
                    OrderStatus.DELIVERED,
                    OrderStatus.CANCELLED,
                  ].map((stKey) => {
                    const isCurrent = selectedOrderForStatus.status === stKey;
                    const colorInfo = getStatusColor(stKey);
                    return (
                      <TouchableOpacity
                        key={stKey}
                        style={[
                          styles.statusOptionItem,
                          isCurrent && { borderColor: colorInfo.color, backgroundColor: colorInfo.bg },
                        ]}
                        disabled={updatingStatus}
                        onPress={() => handleUpdateStatus(selectedOrderForStatus.id, stKey)}
                      >
                        {updatingStatus && isCurrent ? (
                          <ActivityIndicator size="small" color={colorInfo.color} />
                        ) : (
                          <MaterialIcons
                            name={isCurrent ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={colorInfo.color}
                          />
                        )}
                        <Text style={[styles.statusOptionText, { color: colorInfo.color }]}>
                          {ORDER_STATUS_LABELS[stKey]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setSelectedOrderForStatus(null)}
                >
                  <Text style={styles.cancelModalBtnText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <MobileFooterNav isAdmin />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
    backgroundColor: '#FFF8F1',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  iconBtn: {
    padding: 4,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  adminNavContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 14,
  },
  adminTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  adminTabActive: {
    backgroundColor: '#D4EAB7',
  },
  adminTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#75786E',
  },
  adminTabTextActive: {
    color: '#2D3C1F',
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F1B13',
    textAlign: 'right',
    paddingHorizontal: 8,
  },
  chipsScrollView: {
    flexGrow: 0,
    height: 50,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  filterChipActive: {
    backgroundColor: '#2D3C1F',
    borderColor: '#2D3C1F',
  },
  filterChipText: {
    fontSize: 13,
    color: '#75786E',
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 24,
    gap: 14,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderTitleBox: {
    alignItems: 'flex-end',
  },
  orderId: {
    fontSize: 11,
    color: '#75786E',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EAE1D5',
    marginVertical: 12,
  },
  cardBody: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bodyColRight: {
    alignItems: 'flex-end',
  },
  bodyColLeft: {
    alignItems: 'flex-start',
  },
  bodyLabel: {
    fontSize: 11,
    color: '#75786E',
  },
  bodyValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginTop: 2,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2D3C1F',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
  },
  processBtn: {
    flex: 1,
    backgroundColor: '#2D3C1F',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  processBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBF2E5',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailsBtnText: {
    color: '#1F1B13',
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 4,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  modalBody: {
    gap: 12,
  },
  modalSubTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#75786E',
    textAlign: 'right',
    marginBottom: 4,
  },
  statusOptionsList: {
    gap: 8,
  },
  statusOptionItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    backgroundColor: '#FAF7F2',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelModalBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#F3EFEA',
  },
  cancelModalBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#75786E',
  },
});
