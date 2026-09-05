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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useRoleGuard } from '../../hooks/useRoleGuard';
import {
  fetchCustomersAccounts,
  fetchCustomerAccountDetails,
  addCustomerTransaction,
  logoutCustomer,
  CustomerAccount,
  CustomerAccountStats,
  CustomerTransactionItem,
} from '../../services/api';
import MobileFooterNav from '../../components/mobile-footer';

export default function AdminCustomersScreen() {
  useRoleGuard('admin');
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [stats, setStats] = useState<CustomerAccountStats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Payment / Debt Modal State
  const [activeCustomer, setActiveCustomer] = useState<CustomerAccount | null>(null);
  const [transactionType, setTransactionType] = useState<'payment' | 'debt'>('payment');
  const [amountInput, setAmountInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Account History Modal State
  const [historyCustomer, setHistoryCustomer] = useState<CustomerAccount | null>(null);
  const [historyTransactions, setHistoryTransactions] = useState<CustomerTransactionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyNextPage, setHistoryNextPage] = useState<number | null>(null);
  const [loadingHistoryMore, setLoadingHistoryMore] = useState(false);

  const openHistoryModal = async (customer: CustomerAccount) => {
    setHistoryCustomer(customer);
    setHistoryTransactions([]);
    setHistoryNextPage(null);
    loadHistoryTransactions(customer.id, 1);
  };

  const loadHistoryTransactions = async (customerId: number | string, pageToLoad: number = 1) => {
    if (pageToLoad === 1) setLoadingHistory(true);
    else setLoadingHistoryMore(true);

    try {
      const details = await fetchCustomerAccountDetails(customerId, pageToLoad);
      if (details) {
        if (pageToLoad === 1) {
          setHistoryTransactions(details.transactions);
        } else {
          setHistoryTransactions((prev) => [...prev, ...details.transactions]);
        }
        setHistoryNextPage(details.nextPage);
      }
    } catch (e) {
      if (pageToLoad === 1) setHistoryTransactions([]);
    } finally {
      setLoadingHistory(false);
      setLoadingHistoryMore(false);
    }
  };

  const handleLoadMoreHistory = () => {
    if (!loadingHistoryMore && historyNextPage !== null && historyCustomer) {
      loadHistoryTransactions(historyCustomer.id, historyNextPage);
    }
  };

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
    loadCustomers(1);
  }, [search]);

  const loadCustomers = async (pageToLoad: number = 1) => {
    if (pageToLoad === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetchCustomersAccounts(search, pageToLoad);
      if (pageToLoad === 1) {
        setCustomers(res.customers);
      } else {
        setCustomers((prev) => [...prev, ...res.customers]);
      }
      if (res.stats) setStats(res.stats);
      setNextPage(res.nextPage);
    } catch (e) {
      if (pageToLoad === 1) setCustomers([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && nextPage !== null) {
      loadCustomers(nextPage);
    }
  };

  const openTransactionModal = (customer: CustomerAccount, type: 'payment' | 'debt') => {
    setActiveCustomer(customer);
    setTransactionType(type);
    setAmountInput('');
    setDescriptionInput(type === 'payment' ? 'سداد دفعة نقداً' : 'إضافة دَيْن جديد');
  };

  const handleSaveTransaction = async () => {
    if (!activeCustomer) return;
    const numAmount = parseFloat(amountInput);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    setSubmitting(true);
    try {
      // Negative amount = payment/deduct debt, Positive amount = add debt
      const finalAmount = transactionType === 'payment' ? -numAmount : numAmount;
      const res = await addCustomerTransaction(activeCustomer.id, finalAmount, descriptionInput);

      if (res.success) {
        Alert.alert('تم بنجاح 🌟', res.message);
        setActiveCustomer(null);
        // Refresh customer list
        loadCustomers(1);
      } else {
        Alert.alert('خطأ', res.message);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر تسجيل المعاملة');
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToHistory = (customer: CustomerAccount) => {
    router.push({
      pathname: '/admin/customer-history',
      params: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || '',
        balance: String(customer.balance || 0),
        address: customer.address || '',
        latitude: customer.latitude ? String(customer.latitude) : '',
        longitude: customer.longitude ? String(customer.longitude) : '',
      },
    } as any);
  };

  const renderCustomerItem = useCallback(({ item: cust }: { item: CustomerAccount }) => {
    const bal = Number(cust.balance || 0);
    const owesMoney = bal > 0;
    const hasCredit = bal < 0;

    return (
      <View style={styles.customerCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigateToHistory(cust)}
          style={styles.cardHeader}
        >
          <View style={styles.customerInfoGroup}>
            <Text style={styles.customerName}>{cust.name}</Text>
            {cust.shop_name && cust.shop_name !== '—' && (
              <Text style={styles.customerShop}>محل: {cust.shop_name}</Text>
            )}
            {cust.phone && cust.phone !== '—' && (
              <Text style={styles.customerPhone}>{cust.phone}</Text>
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
                ? `عليه: ${bal.toFixed(2)} ج.م`
                : hasCredit
                ? `له: ${Math.abs(bal).toFixed(2)} ج.م`
                : 'خالص (0.00 ج.م)'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => openTransactionModal(cust, 'payment')}
          >
            <MaterialIcons name="payments" size={18} color="#FFFFFF" />
            <Text style={styles.payBtnText}>تنزيل حساب (سداد)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.debtBtn}
            onPress={() => openTransactionModal(cust, 'debt')}
          >
            <MaterialIcons name="add-circle-outline" size={18} color="#2D3C1F" />
            <Text style={styles.debtBtnText}>إضافة دَيْن</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => navigateToHistory(cust)}
          >
            <MaterialIcons name="history" size={18} color="#75786E" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#BA1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>حسابات العملاء</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.contentWrapper}>

        {/* Global Debt Stats Cards */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statTitle}>إجمالي الديون المستحقة</Text>
              <Text style={styles.statValueOwed}>
                {Number(stats.total_debts_on_customers || 0).toFixed(2)} ج.م
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statTitle}>عدد العملاء المدينين</Text>
              <Text style={styles.statValueCount}>
                {stats.customers_with_debt || 0} عميل
              </Text>
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#75786E" />
          <TextInput
            style={styles.searchInput}
            placeholder="البحث بالاسم أو رقم الهاتف أو المحل..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9A978F"
          />
        </View>

        {/* Customers List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <FlatList
            data={customers}
            renderItem={renderCustomerItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="person-off" size={48} color="#A8A29E" />
                <Text style={styles.emptyTitle}>لا يوجد عملاء</Text>
                <Text style={styles.emptySub}>لم يتم العثور على عملاء مطابقتين للبحث.</Text>
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

      {/* Payment / Debt Transaction Modal */}
      <Modal
        visible={Boolean(activeCustomer)}
        animationType="fade"
        transparent
        onRequestClose={() => setActiveCustomer(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActiveCustomer(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActiveCustomer(null)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {transactionType === 'payment' ? 'تنزيل حساب (سداد دفعة)' : 'تسجيل دَيْن جديد'}
              </Text>
            </View>

            {activeCustomer && (
              <View style={styles.modalForm}>
                <View style={styles.customerBriefBox}>
                  <Text style={styles.customerBriefName}>{activeCustomer.name}</Text>
                  <Text style={styles.customerBriefBalance}>
                    الرصيد الحالي:{' '}
                    {Number(activeCustomer.balance) > 0
                      ? `عليه ${Number(activeCustomer.balance).toFixed(2)} ج.م`
                      : Number(activeCustomer.balance) < 0
                      ? `له ${Math.abs(Number(activeCustomer.balance)).toFixed(2)} ج.م`
                      : 'خالص (0.00 ج.م)'}
                  </Text>
                </View>

                {/* Quick Presets for Payments */}
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
                    {Number(activeCustomer.balance) > 0 && (
                      <TouchableOpacity
                        style={[styles.presetChip, styles.presetFullChip]}
                        onPress={() => setAmountInput(String(Number(activeCustomer.balance).toFixed(2)))}
                      >
                        <Text style={styles.presetFullChipText}>سداد كامل الدين</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.fieldLabel}>المبلغ المراد {transactionType === 'payment' ? 'تنزيله / تسديده' : 'إضافته كدَيْن'} (ج.م) *</Text>
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
                  onPress={() => setActiveCustomer(null)}
                >
                  <Text style={styles.cancelModalBtnText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Account History Modal */}
      <Modal
        visible={Boolean(historyCustomer)}
        animationType="fade"
        transparent
        onRequestClose={() => setHistoryCustomer(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setHistoryCustomer(null)}>
          <Pressable style={[styles.modalCard, { maxHeight: '80%' }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setHistoryCustomer(null)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>سجل المعاملات والتنزيلات</Text>
            </View>

            {historyCustomer && (
              <View style={{ flex: 1 }}>
                <Text style={styles.customerBriefName}>{historyCustomer.name}</Text>

                {loadingHistory ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#2D3C1F" />
                  </View>
                ) : (
                  <FlatList
                    data={historyTransactions}
                    keyExtractor={(tx) => String(tx.id)}
                    style={{ marginTop: 12 }}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMoreHistory}
                    onEndReachedThreshold={0.4}
                    renderItem={({ item: tx }) => {
                      const isPay = tx.is_payment || tx.amount < 0;
                      return (
                        <View style={styles.txRow}>
                          <View style={{ alignItems: 'flex-start' }}>
                            <Text
                              style={[
                                styles.txAmount,
                                { color: isPay ? '#166534' : '#991B1B' },
                              ]}
                            >
                              {isPay
                                ? `- ${Math.abs(tx.amount).toFixed(2)} ج.م`
                                : `+ ${tx.amount.toFixed(2)} ج.م`}
                            </Text>
                            <Text style={styles.txDate}>{tx.date}</Text>
                          </View>

                          <View style={{ alignItems: 'flex-end', flex: 1, paddingRight: 10 }}>
                            <Text style={styles.txDesc}>
                              {tx.description || (isPay ? 'سداد حساب' : 'إضافة دَيْن')}
                            </Text>
                            {tx.order_id && (
                              <Text style={styles.txOrderId}>طلب #{tx.order_id}</Text>
                            )}
                          </View>
                        </View>
                      );
                    }}
                    ListEmptyComponent={
                      <Text style={styles.emptySub}>لا توجد معاملات سابقة لهذا العميل.</Text>
                    }
                    ListFooterComponent={
                      loadingHistoryMore ? (
                        <View style={styles.footerLoader}>
                          <ActivityIndicator size="small" color="#2D3C1F" />
                        </View>
                      ) : null
                    }
                  />
                )}
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
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 11,
    color: '#75786E',
    fontWeight: '600',
  },
  statValueOwed: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#BA1A1A',
    marginTop: 4,
  },
  statValueCount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2D3C1F',
    marginTop: 4,
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
  listContainer: {
    paddingBottom: 24,
    gap: 12,
  },
  customerCard: {
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
  customerInfoGroup: {
    alignItems: 'flex-end',
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  customerShop: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 2,
  },
  customerPhone: {
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#D4EAB7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  debtBtnText: {
    color: '#2D3C1F',
    fontSize: 12,
    fontWeight: 'bold',
  },
  historyBtn: {
    backgroundColor: '#F3EFEA',
    padding: 10,
    borderRadius: 14,
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
  customerBriefBox: {
    backgroundColor: '#FFF8F1',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    alignItems: 'flex-end',
  },
  customerBriefName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  customerBriefBalance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#75786E',
    marginTop: 2,
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
  txRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  txDate: {
    fontSize: 10,
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
  },
});
