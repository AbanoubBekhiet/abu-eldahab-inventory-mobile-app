import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useRoleGuard } from '../../hooks/useRoleGuard';
import {
  fetchOrderDetails,
  updateOrderStatus,
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
} from '../../services/api';
import { AppImage } from '../../components/app-image';

const ALL_STATUSES = [
  { key: OrderStatus.PENDING, label: ORDER_STATUS_LABELS[OrderStatus.PENDING], color: '#92400E', bg: '#FEF3C7' },
  { key: OrderStatus.CONFIRMED, label: ORDER_STATUS_LABELS[OrderStatus.CONFIRMED], color: '#166534', bg: '#DCFCE7' },
  { key: OrderStatus.SHIPPED, label: ORDER_STATUS_LABELS[OrderStatus.SHIPPED], color: '#1E40AF', bg: '#DBEAFE' },
  { key: OrderStatus.DELIVERED, label: ORDER_STATUS_LABELS[OrderStatus.DELIVERED], color: '#2D3C1F', bg: '#D4EAB7' },
  { key: OrderStatus.COMPLETED, label: ORDER_STATUS_LABELS[OrderStatus.COMPLETED], color: '#166534', bg: '#DCFCE7' },
  { key: OrderStatus.CANCELLED, label: ORDER_STATUS_LABELS[OrderStatus.CANCELLED], color: '#991B1B', bg: '#FEE2E2' },
];

export default function AdminOrderDetailsScreen() {
  useRoleGuard('admin');
  const router = useRouter();
  const { id, orderData } = useLocalSearchParams();

  const [order, setOrder] = useState<Order | any | null>(() => {
    if (orderData && typeof orderData === 'string') {
      try {
        return JSON.parse(orderData);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!order);
  const [updating, setUpdating] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  useEffect(() => {
    if (!order && id) loadOrder();
  }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await fetchOrderDetails(String(id));
      setOrder(data);
    } catch (e) {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatusPrompt = () => {
    if (!order) return;
    setStatusModalVisible(true);
  };

  const changeStatus = async (newStatusKey: string, newStatusLabel: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      await updateOrderStatus(order.raw_id || order.id || id, newStatusKey);
      setOrder((prev: any) =>
        prev
          ? {
              ...prev,
              status: newStatusKey,
              status_label: newStatusLabel,
            }
          : prev
      );
      setStatusModalVisible(false);
      Alert.alert('تم التحديث', `تم تغيير حالة الطلب إلى: ${newStatusLabel}`);
    } catch (e) {
      Alert.alert('خطأ', 'تعذر تحديث حالة الطلب على السيرفر.');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusObj = (statusKey?: string) => {
    return ALL_STATUSES.find((s) => s.key === statusKey) || ALL_STATUSES[0];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topAppBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-forward" size={22} color="#1F1B13" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>تفاصيل الطلب</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2D3C1F" />
        </View>
      </SafeAreaView>
    );
  }

  const currentStatusObj = getStatusObj(order?.status);
  const productsList = order?.products || [];
  const customerName = order?.customer || order?.customer_name || 'عميل المتجر';
  const customerPhone = order?.customer_phone || 'لا يوجد رقم هاتف';
  const customerAddress = order?.customer_address || 'توصيل عبر المتجر';
  const totalAmount = Number(order?.total_amount || order?.total || order?.total_price || 0).toFixed(2);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Header */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={22} color="#1F1B13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تفاصيل الطلب #{order?.id || id}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => Alert.alert('طباعة الفاتورة 🖨️', 'جاري إعداد الفاتورة للطباعة...')}
        >
          <MaterialIcons name="print" size={22} color="#2D3C1F" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Action Header Row */}
        <View style={styles.actionHeaderRow}>
          <TouchableOpacity
            style={styles.updateStatusBtn}
            onPress={handleUpdateStatusPrompt}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.updateStatusText}>
                  الحالة: {order?.status_label || currentStatusObj.label}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Customer Details Card */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>بيانات العميل 👤</Text>

          <View style={styles.customerRow}>
            <View style={styles.customerInfoGroup}>
              <Text style={styles.customerName}>{customerName}</Text>
              <Text style={styles.customerSub}>مصدر الطلب: {order?.source === 'app' ? 'تطبيق الموبايل' : 'سيستم POS'}</Text>
            </View>
            <View style={styles.customerAvatar}>
              <MaterialIcons name="person" size={26} color="#2D3C1F" />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.contactList}>
            <View style={styles.contactItem}>
              <Text style={styles.contactText}>{customerPhone}</Text>
              <MaterialIcons name="phone" size={18} color="#75786E" />
            </View>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => {
                if (order?.customer_latitude && order?.customer_longitude) {
                  const url = `https://www.google.com/maps/search/?api=1&query=${order.customer_latitude},${order.customer_longitude}`;
                  Linking.openURL(url).catch(() => {
                    Alert.alert('خطأ', 'لا يمكن فتح خرائط جوجل.');
                  });
                } else {
                  Alert.alert('تنبيه', 'لا يتوفر الموقع الجغرافي (GPS) لهذا العميل.');
                }
              }}
            >
              <Text style={[styles.contactText, { color: (order?.customer_latitude && order?.customer_longitude) ? '#0066CC' : '#75786E', textDecorationLine: (order?.customer_latitude && order?.customer_longitude) ? 'underline' : 'none' }]}>{customerAddress}</Text>
              <MaterialIcons name="location-on" size={18} color={(order?.customer_latitude && order?.customer_longitude) ? "#0066CC" : "#75786E"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Products List with IMAGES */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>منتجات الطلب ({productsList.length}) 📦</Text>

          {productsList.length === 0 ? (
            <Text style={styles.emptyProductsText}>لا توجد منتجات مسجلة في هذا الطلب.</Text>
          ) : (
            <View style={styles.itemList}>
              {productsList.map((prod: any, idx: number) => {
                const prodPrice = Number(prod.price || prod.pivot?.price || 0).toFixed(2);
                const prodQty = prod.quantity || prod.pivot?.quantity || 1;
                const prodTotal = Number(prod.total_price || prod.pivot?.total_price || (Number(prodPrice) * prodQty)).toFixed(2);

                return (
                  <React.Fragment key={prod.id || idx}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.itemRow}>
                      <View style={styles.itemRightGroup}>
                        <AppImage
                          uri={prod.image_url}
                          style={styles.productThumbnail}
                          iconName="inventory"
                          iconSize={24}
                        />
                        <View style={styles.itemDetailGroup}>
                          <Text style={styles.itemName}>{prod.name}</Text>
                          <Text style={styles.itemMeta}>
                            الكمية: {prodQty} {prod.unit || 'علبة'} • بسعر: {prodPrice} ج.م
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.itemPrice}>{prodTotal} ج.م</Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>

        {/* Payment Summary Card */}
        <View style={[styles.cardContainer, { marginBottom: 30 }]}>
          <Text style={styles.cardSectionTitle}>ملخص الدفع 💳</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryVal}>{order?.date || '—'}</Text>
            <Text style={styles.summaryLbl}>تاريخ الطلب</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryVal}>{order?.payment_type || 'آجل'}</Text>
            <Text style={styles.summaryLbl}>طريقة الدفع</Text>
          </View>

          {Number(order?.discount || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryVal, { color: '#BA1A1A' }]}>-{Number(order.discount).toFixed(2)} ج.م</Text>
              <Text style={styles.summaryLbl}>الخصم المطبق</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{totalAmount} ج.م</Text>
            <Text style={styles.totalLbl}>الإجمالي النهائي</Text>
          </View>
        </View>
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={statusModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStatusModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تحديث حالة الطلب</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubTitle}>اختر الحالة الجديدة للطلب:</Text>

              <View style={styles.statusOptionsList}>
                {ALL_STATUSES.map((st) => {
                  const isCurrent = order?.status === st.key;
                  return (
                    <TouchableOpacity
                      key={st.key}
                      style={[
                        styles.statusOptionItem,
                        isCurrent && { borderColor: st.color, backgroundColor: st.bg },
                      ]}
                      disabled={updating}
                      onPress={() => changeStatus(st.key, st.label)}
                    >
                      {updating && isCurrent ? (
                        <ActivityIndicator size="small" color={st.color} />
                      ) : (
                        <MaterialIcons
                          name={isCurrent ? 'radio-button-checked' : 'radio-button-unchecked'}
                          size={20}
                          color={st.color}
                        />
                      )}
                      <Text style={[styles.statusOptionText, { color: st.color }]}>
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setStatusModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionHeaderRow: {
    marginBottom: 16,
  },
  updateStatusBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D3C1F',
    paddingVertical: 14,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  updateStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2D3C1F',
    marginBottom: 14,
    textAlign: 'right',
  },
  customerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D4EAB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInfoGroup: {
    alignItems: 'flex-end',
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  customerSub: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAE1D5',
    marginVertical: 12,
  },
  contactList: {
    gap: 10,
  },
  contactItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 13,
    color: '#1F1B13',
  },
  itemList: {
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemRightGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  productThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  itemDetailGroup: {
    alignItems: 'flex-end',
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
  },
  itemMeta: {
    fontSize: 11,
    color: '#75786E',
    marginTop: 2,
    textAlign: 'right',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  emptyProductsText: {
    fontSize: 12,
    color: '#75786E',
    textAlign: 'center',
    paddingVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLbl: {
    fontSize: 13,
    color: '#75786E',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1B13',
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLbl: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  totalVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3C1F',
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
