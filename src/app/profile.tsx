import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import MobileFooterNav from '../components/mobile-footer';
import {
  fetchUserAccount,
  setAuthToken,
  logoutCustomer,
  UserAccountData,
  OrderHistoryItem,
  isAdminOrSubAdmin,
  fetchAppSettings,
  AppSettingsData,
} from '../services/api';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'قيد الانتظار', color: '#92400E', bg: '#FEF3C7' },
  confirmed: { label: 'تم التأكيد',   color: '#166534', bg: '#DCFCE7' },
  shipped:   { label: 'تم الشحن',     color: '#1E40AF', bg: '#DBEAFE' },
  completed: { label: 'مكتمل',        color: '#166534', bg: '#DCFCE7' },
  delivered: { label: 'تم التوصيل',   color: '#2D3C1F', bg: '#D4EAB7' },
  cancelled: { label: 'ملغي',         color: '#991B1B', bg: '#FEE2E2' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const [accountData, setAccountData] = useState<UserAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettingsData | null>(null);
  const [loadingSupport, setLoadingSupport] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        try {
          const data = await fetchUserAccount();
          if (active) setAccountData(data);
        } catch {
          if (active) setAccountData(null);
        } finally {
          if (active) setLoading(false);
        }
      };
      load();
      return () => { active = false; };
    }, [])
  );

  const handleLogout = async () => {
    await logoutCustomer();
    setAccountData(null);
    router.replace('/login');
  };

  const openSupportModal = async () => {
    setShowSupportModal(true);
    if (!appSettings) {
      setLoadingSupport(true);
      const settings = await fetchAppSettings();
      setAppSettings(settings);
      setLoadingSupport(false);
    }
  };

  const handleCall = (phone?: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return;
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('01')) {
      cleaned = '2' + cleaned;
    }
    Linking.openURL(`https://wa.me/${cleaned}`);
  };

  const user = accountData?.user;
  const balance = accountData?.balance ?? 0;
  const orders = accountData?.orders ?? [];
  const isAdmin = isAdminOrSubAdmin(user);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topAppBar}>
        <Text style={styles.brandTitle}>أبو الدهب - حسابي</Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : !user ? (
          <View style={styles.authCard}>
            <MaterialIcons name="lock-outline" size={48} color="#2D3C1F" />
            <Text style={styles.authTitle}>تسجيل الدخول إلى حسابك</Text>
            <Text style={styles.authSub}>
              سجل الدخول حتى تتمكن من متابعة طلباتك وحفظ عنوانك.
            </Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
              <Text style={styles.loginBtnText}>تسجيل الدخول / حساب جديد</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Profile Header Card */}
            <View style={styles.profileHeaderCard}>
              <View style={styles.avatarCircle}>
                <MaterialIcons name="person" size={40} color="#2D3C1F" />
              </View>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.shop_name && <Text style={styles.userShop}>🏪 {user.shop_name}</Text>}
              {user.phone && <Text style={styles.userPhone}>📞 {user.phone}</Text>}
              {user.address && <Text style={styles.userAddress}>📍 {user.address}</Text>}

              <TouchableOpacity
                style={styles.editProfileBtn}
                onPress={() => router.push('/personal-info')}
              >
                <Text style={styles.editProfileText}>تعديل الملف الشخصي</Text>
              </TouchableOpacity>
            </View>



            {/* Quick Links */}
            <View style={styles.accountListCard}>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/orders-history')}>
                <MaterialIcons name="chevron-left" size={22} color="#75786E" />
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuTitle}>سجل الطلبات السابقة</Text>
                  <View style={styles.menuIconBadge}>
                    <MaterialIcons name="receipt-long" size={20} color="#2D3C1F" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/personal-info')}>
                <MaterialIcons name="chevron-left" size={22} color="#75786E" />
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuTitle}>المعلومات الشخصية وعنوان التوصيل</Text>
                  <View style={styles.menuIconBadge}>
                    <MaterialIcons name="person" size={20} color="#2D3C1F" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/wishlist')}>
                <MaterialIcons name="chevron-left" size={22} color="#75786E" />
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuTitle}>المنتجات المفضلة</Text>
                  <View style={styles.menuIconBadge}>
                    <MaterialIcons name="favorite" size={20} color="#2D3C1F" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                onPress={openSupportModal}
              >
                <MaterialIcons name="chevron-left" size={22} color="#75786E" />
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuTitle}>اتصل بنا والدعم الفني</Text>
                  <View style={styles.menuIconBadge}>
                    <MaterialIcons name="headset-mic" size={20} color="#2D3C1F" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutCardBtn} onPress={handleLogout} activeOpacity={0.8}>
              <MaterialIcons name="logout" size={20} color="#BA1A1A" />
              <Text style={styles.logoutText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Support Modal */}
      <Modal
        visible={showSupportModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSupportModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSupportModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>اتصل بنا والدعم الفني</Text>
            </View>

            {loadingSupport ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2D3C1F" />
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <Text style={styles.supportSubTitle}>
                  يمكنك التواصل المباشر معنا عبر الاتصال الهاتفي أو الدردشة السريعة عبر الواتساب:
                </Text>

                {/* Phone 1 */}
                {(appSettings?.phone1 || '01000000000') && (
                  <View style={styles.supportNumberCard}>
                    <Text style={styles.supportPhoneLabel}>الخط الرئيسي (1)</Text>
                    <Text style={styles.supportPhoneVal}>{appSettings?.phone1 || '01000000000'}</Text>
                    <View style={styles.supportActionsRow}>
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={() => handleCall(appSettings?.phone1 || '01000000000')}
                      >
                        <MaterialIcons name="phone" size={16} color="#FFFFFF" />
                        <Text style={styles.callBtnText}>اتصال</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.waBtn}
                        onPress={() => handleWhatsApp(appSettings?.phone1 || '01000000000')}
                      >
                        <MaterialIcons name="chat" size={16} color="#FFFFFF" />
                        <Text style={styles.waBtnText}>واتساب</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Phone 2 */}
                {Boolean(appSettings?.phone2) && (
                  <View style={styles.supportNumberCard}>
                    <Text style={styles.supportPhoneLabel}>الخط الإضافي (2)</Text>
                    <Text style={styles.supportPhoneVal}>{appSettings?.phone2}</Text>
                    <View style={styles.supportActionsRow}>
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={() => handleCall(appSettings?.phone2)}
                      >
                        <MaterialIcons name="phone" size={16} color="#FFFFFF" />
                        <Text style={styles.callBtnText}>اتصال</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.waBtn}
                        onPress={() => handleWhatsApp(appSettings?.phone2)}
                      >
                        <MaterialIcons name="chat" size={16} color="#FFFFFF" />
                        <Text style={styles.waBtnText}>واتساب</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <MobileFooterNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F1' },
  topAppBar: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5', backgroundColor: '#FFF8F1',
  },
  brandTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3C1F' },
  scrollContent: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },

  // Profile Header
  profileHeaderCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#EAE1D5', marginBottom: 16,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#D4EAB7', alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#1F1B13' },
  userEmail: { fontSize: 13, color: '#75786E', marginTop: 2 },
  userShop: { fontSize: 13, fontWeight: '600', color: '#2D3C1F', marginTop: 4 },
  userPhone: { fontSize: 12, color: '#75786E', marginTop: 2 },
  userAddress: { fontSize: 12, color: '#75786E', marginTop: 2, textAlign: 'center' },
  editProfileBtn: {
    backgroundColor: '#435334', paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: 9999, marginTop: 12,
  },
  editProfileText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },

  // Balance Card
  balanceCard: {
    borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1,
  },
  balanceCardDebt: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  balanceCardClear: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  balanceRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 },
  balanceLabel: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  balanceAmount: { fontSize: 20, fontWeight: 'bold', textAlign: 'right', marginTop: 2 },
  balanceDetails: {
    flexDirection: 'row-reverse', marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)',
  },
  balanceDetailItem: { flex: 1, alignItems: 'center' },
  balanceDetailLabel: { fontSize: 11, color: '#78716C', marginBottom: 2 },
  balanceDetailValue: { fontSize: 13, fontWeight: 'bold', color: '#1C1917' },
  balanceDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.1)' },

  // Orders
  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16,
    borderWidth: 1, borderColor: '#EAE1D5', marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F1B13', marginBottom: 12, textAlign: 'right' },
  orderCard: {
    backgroundColor: '#FFF8F1', borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#EAE1D5',
  },
  orderHeader: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  orderTopRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderId: { fontSize: 14, fontWeight: 'bold', color: '#2D3C1F' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  orderDate: { fontSize: 11, color: '#75786E', textAlign: 'right', marginBottom: 6 },
  orderBottomRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  orderItemsCount: { fontSize: 12, color: '#75786E' },
  orderTotal: { fontSize: 16, fontWeight: 'bold', color: '#1F1B13' },
  debtBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: '#FDEEEC', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, alignSelf: 'flex-end', marginTop: 6,
  },
  debtBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#C0392B' },

  // Expanded order items
  orderItemsList: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#EAE1D5',
  },
  orderNotes: {
    fontSize: 12, color: '#75786E', textAlign: 'right',
    backgroundColor: '#F7F5F0', borderRadius: 8,
    padding: 8, marginBottom: 8,
  },
  orderItemRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  orderItemName: { fontSize: 13, color: '#1F1B13', flex: 1, textAlign: 'right' },
  orderItemPrice: { fontSize: 13, fontWeight: 'bold', color: '#2D3C1F', marginLeft: 8 },

  // Quick links
  accountListCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1,
    borderColor: '#EAE1D5', overflow: 'hidden', marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#EAE1D5',
  },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconBadge: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#D4EAB7',
    alignItems: 'center', justifyContent: 'center',
  },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1F1B13' },

  // Logout
  logoutCardBtn: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FFDAD6',
    borderRadius: 20, padding: 16, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 24,
  },
  logoutText: { fontSize: 15, fontWeight: 'bold', color: '#BA1A1A' },

  // Auth
  authCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#EAE1D5', marginTop: 20,
  },
  authTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F1B13', marginTop: 10, marginBottom: 6 },
  authSub: { fontSize: 12, color: '#75786E', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  loginBtn: {
    backgroundColor: '#2D3C1F', paddingVertical: 14,
    paddingHorizontal: 24, borderRadius: 9999, width: '100%', alignItems: 'center',
  },
  loginBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  centerContainer: { paddingVertical: 50, alignItems: 'center', justifyContent: 'center' },

  // Support Modal Styles
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
  supportSubTitle: {
    fontSize: 13,
    color: '#75786E',
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 4,
  },
  supportNumberCard: {
    backgroundColor: '#FFF8F1',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  supportPhoneLabel: {
    fontSize: 11,
    color: '#75786E',
    textAlign: 'right',
  },
  supportPhoneVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3C1F',
    textAlign: 'right',
    marginVertical: 4,
  },
  supportActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 8,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2D3C1F',
    paddingVertical: 8,
    borderRadius: 12,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  waBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#166534',
    paddingVertical: 8,
    borderRadius: 12,
  },
  waBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
