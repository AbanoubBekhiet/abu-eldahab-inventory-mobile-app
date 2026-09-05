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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useRoleGuard } from '../../hooks/useRoleGuard';
import {
  fetchCustomerAccountDetails,
  addCustomerTransaction,
  CustomerAccount,
  CustomerTransactionItem,
} from '../../services/api';
import MobileFooterNav from '../../components/mobile-footer';

export default function AdminCustomerHistoryScreen() {
  useRoleGuard('admin');
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string; phone?: string; balance?: string; address?: string; latitude?: string; longitude?: string }>();

  const customerId = params.id;

  const [customer, setCustomer] = useState<CustomerAccount | null>({
    id: Number(customerId || 0),
    name: params.name || 'عميل',
    phone: params.phone || '—',
    balance: Number(params.balance || 0),
    address: params.address || '—',
    latitude: params.latitude ? Number(params.latitude) : null,
    longitude: params.longitude ? Number(params.longitude) : null,
  });

  const [transactions, setTransactions] = useState<CustomerTransactionItem[]>([]);
  const [balance, setBalance] = useState<number>(Number(params.balance || 0));
  const [loading, setLoading] = useState(true);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Transaction Modal State (for quick payment/debt inside this page)
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'payment' | 'debt'>('payment');
  const [amountInput, setAmountInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadHistory(1);
    }
  }, [customerId]);

  const loadHistory = async (pageToLoad: number = 1) => {
    if (!customerId) return;
    if (pageToLoad === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const details = await fetchCustomerAccountDetails(customerId, pageToLoad);
      if (details) {
        if (details.customer) {
          setCustomer(details.customer);
        }
        setBalance(details.balance);

        if (pageToLoad === 1) {
          setTransactions(details.transactions);
        } else {
          setTransactions((prev) => [...prev, ...details.transactions]);
        }
        setNextPage(details.nextPage);
      }
    } catch (e) {
      if (pageToLoad === 1) setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && nextPage !== null && customerId) {
      loadHistory(nextPage);
    }
  };

  const openTransactionModal = (type: 'payment' | 'debt') => {
    setTransactionType(type);
    setAmountInput('');
    setDescriptionInput(type === 'payment' ? 'سداد دفعة نقداً' : 'إضافة دَيْن جديد');
    setShowModal(true);
  };

  const handleSaveTransaction = async () => {
    if (!customerId) return;
    const numAmount = parseFloat(amountInput);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    setSubmitting(true);
    try {
      const finalAmount = transactionType === 'payment' ? -numAmount : numAmount;
      const res = await addCustomerTransaction(customerId, finalAmount, descriptionInput);

      if (res.success) {
        Alert.alert('تم بنجاح 🌟', res.message);
        setShowModal(false);
        // Refresh customer transactions & balance
        loadHistory(1);
      } else {
        Alert.alert('خطأ', res.message);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر تسجيل المعاملة');
    } finally {
      setSubmitting(false);
    }
  };

  const owesMoney = balance > 0;
  const hasCredit = balance < 0;

  const renderTransactionItem = useCallback(({ item: tx }: { item: CustomerTransactionItem }) => {
    const isPay = tx.is_payment || tx.amount < 0;
    const prev = tx.previous_balance;
    const curr = tx.new_balance;

    const formatBalText = (val?: number) => {
      if (val === undefined || val === null) return '—';
      if (val > 0) return `عليه ${val.toFixed(2)} ج.م`;
      if (val < 0) return `له ${Math.abs(val).toFixed(2)} ج.م`;
      return 'خالص (0.00 ج.م)';
    };

    return (
      <View style={styles.txCard}>
        <View style={styles.txHeader}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={[styles.txAmount, { color: isPay ? '#166534' : '#991B1B' }]}>
              {isPay ? `- ${Math.abs(tx.amount).toFixed(2)} ج.م` : `+ ${tx.amount.toFixed(2)} ج.م`}
            </Text>
            <Text style={styles.txDate}>{tx.date}</Text>
          </View>

          <View style={{ alignItems: 'flex-end', flex: 1, paddingRight: 10 }}>
            <Text style={styles.txDesc}>{tx.description || (isPay ? 'سداد حساب' : 'إضافة دَيْن')}</Text>
            {tx.order_id && <Text style={styles.txOrderId}>طلب #{tx.order_id}</Text>}
          </View>
        </View>

        {prev !== undefined && (
          <View style={styles.auditRow}>
            <Text style={styles.auditText}>
              قبل المعاملة: <Text style={styles.auditVal}>{formatBalText(prev)}</Text>
            </Text>
            {curr !== undefined && (
              <Text style={styles.auditText}>
                بعد المعاملة: <Text style={styles.auditVal}>{formatBalText(curr)}</Text>
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={24} color="#2D3C1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          سجل معاملات: {customer?.name || 'العميل'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.contentWrapper}>
        {loading && transactions.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransactionItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshing={loading && transactions.length > 0}
            onRefresh={() => loadHistory(1)}
            ListHeaderComponent={
              <>
                {customer && (
                  <View style={styles.customerHeaderCard}>
                    <View style={styles.customerInfoRow}>
                      <View style={styles.infoGroup}>
                        <Text style={styles.customerName}>{customer.name}</Text>
                        {customer.phone && customer.phone !== '—' && (
                          <Text style={styles.customerSub}>هاتف: {customer.phone}</Text>
                        )}
                        {customer.shop_name && customer.shop_name !== '—' && (
                          <Text style={styles.customerSub}>محل: {customer.shop_name}</Text>
                        )}
                        {customer.address && customer.address !== '—' && (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                            onPress={() => {
                              if (customer.latitude && customer.longitude) {
                                const url = `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`;
                                Linking.openURL(url).catch(() => {
                                  Alert.alert('خطأ', 'لا يمكن فتح خرائط جوجل.');
                                });
                              } else {
                                Alert.alert('تنبيه', 'لا يتوفر الموقع الجغرافي (GPS) لهذا العميل.');
                              }
                            }}
                          >
                            <Text style={[styles.customerSub, { color: (customer.latitude && customer.longitude) ? '#0066CC' : '#75786E', textDecorationLine: (customer.latitude && customer.longitude) ? 'underline' : 'none' }]}>
                              العنوان: {customer.address}
                            </Text>
                            <MaterialIcons
                              name="location-on"
                              size={14}
                              color={(customer.latitude && customer.longitude) ? "#0066CC" : "#75786E"}
                              style={{ marginLeft: 4 }}
                            />
                          </TouchableOpacity>
                        )}
                      </View>

                      <View
                        style={[
                          styles.balanceBadge,
                          owesMoney
                            ? styles.balanceBadgeOwed
                            : hasCredit
                            ? styles.balanceBadgeCredit
                            : styles.balanceBadgeZero,
                        ]}
                      >
                        <Text
                          style={[
                            styles.balanceBadgeText,
                            owesMoney
                              ? styles.balanceTextOwed
                              : hasCredit
                              ? styles.balanceTextCredit
                              : styles.balanceTextZero,
                          ]}
                        >
                          {owesMoney
                            ? `عليه: ${balance.toFixed(2)} ج.م`
                            : hasCredit
                            ? `له: ${Math.abs(balance).toFixed(2)} ج.م`
                            : 'خالص (0.00 ج.م)'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    {/* Quick Action Buttons */}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => openTransactionModal('payment')}
                      >
                        <MaterialIcons name="payments" size={18} color="#FFFFFF" />
                        <Text style={styles.payBtnText}>تنزيل حساب (سداد)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.debtBtn}
                        onPress={() => openTransactionModal('debt')}
                      >
                        <MaterialIcons name="add-circle-outline" size={18} color="#2D3C1F" />
                        <Text style={styles.debtBtnText}>إضافة دَيْن</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Text style={styles.sectionTitle}>سجل الحركات والتنزيلات التاريخية</Text>
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="history" size={48} color="#A8A29E" />
                <Text style={styles.emptyTitle}>لا توجد معاملات سابقة</Text>
                <Text style={styles.emptySub}>لم يتم تسجيل معاملات أو تنزيلات سابقة لهذا العميل.</Text>
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

      {/* Transaction Modal */}
      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {transactionType === 'payment' ? 'تنزيل حساب (سداد)' : 'تسجيل دَيْن جديد'}
              </Text>
            </View>

            <View style={styles.modalForm}>
              {/* Presets */}
              {transactionType === 'payment' && (
                <View style={styles.presetsContainer}>
                  {[50, 100, 200, 500].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={styles.presetChip}
                      onPress={() => setAmountInput(String(preset))}
                    >
                      <Text style={styles.presetChipText}>{preset} ج.م</Text>
                    </TouchableOpacity>
                  ))}
                  {balance > 0 && (
                    <TouchableOpacity
                      style={[styles.presetChip, styles.presetFullChip]}
                      onPress={() => setAmountInput(String(balance.toFixed(2)))}
                    >
                      <Text style={styles.presetFullChipText}>سداد كامل الدين</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>
                المبلغ المراد {transactionType === 'payment' ? 'تنزيله / تسديده' : 'إضافته كدَيْن'} (ج.م) *
              </Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="0.00"
                value={amountInput}
                onChangeText={setAmountInput}
                keyboardType="numeric"
                placeholderTextColor="#9A978F"
              />

              <Text style={styles.fieldLabel}>البيان / ملاحظات المعاملة</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={transactionType === 'payment' ? 'مثال: سداد نقدي بالمحل' : 'مثال: بضاعة آجلة جديدة'}
                value={descriptionInput}
                onChangeText={setDescriptionInput}
                placeholderTextColor="#9A978F"
              />

              <TouchableOpacity
                style={[
                  styles.submitModalBtn,
                  transactionType === 'debt' && { backgroundColor: '#92400E' },
                ]}
                onPress={handleSaveTransaction}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitModalText}>
                    {transactionType === 'payment' ? 'تأكيد تنزيل الحساب' : 'تأكيد إضافة الدَيْن'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
    backgroundColor: '#FFF8F1',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2D3C1F',
    flex: 1,
    textAlign: 'center',
  },
  iconBtn: {
    padding: 4,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  customerHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 16,
  },
  customerInfoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoGroup: {
    alignItems: 'flex-end',
    flex: 1,
  },
  customerName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  customerSub: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 2,
  },
  balanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  balanceBadgeOwed: {
    backgroundColor: '#FEE2E2',
  },
  balanceBadgeCredit: {
    backgroundColor: '#DBEAFE',
  },
  balanceBadgeZero: {
    backgroundColor: '#DCFCE7',
  },
  balanceBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  balanceTextOwed: {
    color: '#991B1B',
  },
  balanceTextCredit: {
    color: '#1E40AF',
  },
  balanceTextZero: {
    color: '#166534',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EAE1D5',
    marginVertical: 12,
  },
  cardActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center',
  },
  payBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2D3C1F',
    paddingVertical: 10,
    borderRadius: 14,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debtBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#D4EAB7',
    paddingVertical: 10,
    borderRadius: 14,
  },
  debtBtnText: {
    color: '#2D3C1F',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3C1F',
    textAlign: 'right',
    marginBottom: 10,
  },
  listContainer: {
    paddingBottom: 24,
    gap: 10,
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  txHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  txDate: {
    fontSize: 11,
    color: '#9A978F',
    marginTop: 2,
  },
  txDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1B13',
  },
  txOrderId: {
    fontSize: 11,
    color: '#75786E',
    marginTop: 2,
  },
  auditRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3EFEA',
  },
  auditText: {
    fontSize: 11,
    color: '#75786E',
  },
  auditVal: {
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
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
    textAlign: 'center',
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
  modalForm: {
    gap: 12,
  },
  presetsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  presetChip: {
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1B13',
  },
  presetFullChip: {
    backgroundColor: '#D4EAB7',
    borderColor: '#2D3C1F',
  },
  presetFullChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1B13',
    textAlign: 'right',
  },
  fieldInput: {
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
  },
  submitModalBtn: {
    backgroundColor: '#2D3C1F',
    borderRadius: 9999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#75786E',
  },
});
