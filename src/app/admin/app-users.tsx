import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { makePhoneCall, openWhatsApp, promptContactCustomer } from '../../services/contact';

import { useRoleGuard } from '../../hooks/useRoleGuard';
import {
  fetchAppUsers,
  fetchAppUserCart,
  fetchAppUserWishlist,
  deleteAppUserCartItem,
  sendAdminNotification,
  AppUser,
  AppUserProductItem,
} from '../../services/api';
import MobileFooterNav from '../../components/mobile-footer';
import { AppImage } from '../../components/app-image';
import { API_BASE_URL, loadSavedAuthToken } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function fetchUserOrdersLocal(userId: number, page: number = 1) {
  let authToken = await AsyncStorage.getItem('auth_token');
  const url = `${API_BASE_URL}/app-users/${userId}/orders?page=${page}`;
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(url, { headers });
  if (!res.ok) return { data: [], nextPage: null };
  const resData = await res.json();
  const items = resData.orders?.data || [];
  const nextPage = resData.orders?.next_page ?? null;
  return { data: items, nextPage };
}

export default function AdminAppUsersScreen() {
  useRoleGuard('admin');
  const router = useRouter();

  // Users List State
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'cart' | 'wishlist'>('orders');

  // Tab Data State
  const [tabData, setTabData] = useState<any[]>([]);
  const [tabNextPage, setTabNextPage] = useState<number | null>(null);
  const [loadingTab, setLoadingTab] = useState(false);
  const [loadingTabMore, setLoadingTabMore] = useState(false);

  const [expandedOrderId, setExpandedOrderId] = useState<string | number | null>(null);

  // Notification Modal State
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  const handleSendUserNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان الإشعار ونص الرسالة');
      return;
    }
    if (!selectedUser) return;

    setSendingNotif(true);
    try {
      const res = await sendAdminNotification({
        title: notifTitle.trim(),
        body: notifBody.trim(),
        user_id: selectedUser.id,
      });
      if (res.success) {
        Alert.alert('نجاح', `تم إرسال الإشعار إلى ${selectedUser.name} بنجاح`);
        setIsNotifModalOpen(false);
        setNotifTitle('');
        setNotifBody('');
      } else {
        Alert.alert('خطأ', res.message || 'فشل إرسال الإشعار');
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'فشل إرسال الإشعار');
    } finally {
      setSendingNotif(false);
    }
  };

  useEffect(() => {
    loadUsers(1, search);
  }, [search]);

  const loadUsers = async (pageToLoad: number, query: string) => {
    if (pageToLoad === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetchAppUsers(pageToLoad, query);
      if (pageToLoad === 1) {
        setUsers(res.data);
      } else {
        setUsers((prev) => [...prev, ...res.data]);
      }
      setNextPage(res.nextPage);
    } catch (e) {
      if (pageToLoad === 1) setUsers([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMoreUsers = () => {
    if (!loadingMore && nextPage !== null) {
      loadUsers(nextPage, search);
    }
  };

  // --- Modal Logic ---

  const openUserModal = (user: AppUser) => {
    setSelectedUser(user);
    setActiveTab('orders');
    loadTabData(user.id, 'orders', 1);
  };

  const switchTab = (tab: 'orders' | 'cart' | 'wishlist') => {
    setActiveTab(tab);
    if (selectedUser) {
      loadTabData(selectedUser.id, tab, 1);
    }
  };

  const loadTabData = async (userId: number, tab: string, pageToLoad: number) => {
    if (pageToLoad === 1) setLoadingTab(true);
    else setLoadingTabMore(true);

    try {
      let res: { data: any[]; nextPage: number | null } = { data: [], nextPage: null };
      if (tab === 'orders') {
        res = await fetchUserOrdersLocal(userId, pageToLoad);
      } else if (tab === 'cart') {
        res = await fetchAppUserCart(userId, pageToLoad);
      } else if (tab === 'wishlist') {
        res = await fetchAppUserWishlist(userId, pageToLoad);
      }

      if (pageToLoad === 1) {
        setTabData(res.data);
      } else {
        setTabData((prev) => [...prev, ...res.data]);
      }
      setTabNextPage(res.nextPage);
    } catch (error) {
      if (pageToLoad === 1) setTabData([]);
    } finally {
      setLoadingTab(false);
      setLoadingTabMore(false);
    }
  };

  const handleLoadMoreTab = () => {
    if (!loadingTabMore && tabNextPage !== null && selectedUser) {
      loadTabData(selectedUser.id, activeTab, tabNextPage);
    }
  };

  // --- Renderers ---

  const renderUserItem = useCallback(({ item }: { item: AppUser }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => openUserModal(item)}>
      <View style={styles.userHeader}>
        <View style={styles.userIconCircle}>
          <MaterialIcons name="person" size={24} color="#2D3C1F" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userShop}>{item.shop_name !== '—' ? item.shop_name : 'بدون متجر'}</Text>
        </View>
        <MaterialIcons name="chevron-left" size={24} color="#A8A29E" />
      </View>
      <View style={styles.userDetails}>
        {item.phone && item.phone !== '—' ? (
          <View style={styles.phoneRowContainer}>
            <TouchableOpacity
              onPress={() => promptContactCustomer(item.name, item.phone)}
              style={styles.clickablePhoneRow}
              activeOpacity={0.7}
            >
              <MaterialIcons name="phone" size={13} color="#2D3C1F" />
              <Text style={styles.userMeta}>{item.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtnCall}
              onPress={() => makePhoneCall(item.phone)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <MaterialIcons name="call" size={12} color="#1E3E2B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtnWhatsapp}
              onPress={() => openWhatsApp(item.phone)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <FontAwesome name="whatsapp" size={13} color="#25D366" />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.userMeta}><MaterialIcons name="phone" size={12} /> بدون هاتف</Text>
        )}
        <Text style={styles.userMeta}><MaterialIcons name="location-on" size={12} /> {item.region}</Text>
      </View>
    </TouchableOpacity>
  ), []);

  const handleDeleteCartItem = async (productId: number) => {
    if (!selectedUser) return;
    Alert.alert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا المنتج من سلة العميل؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteAppUserCartItem(selectedUser.id, productId);
          if (res.success) {
            setTabData((prev) => prev.filter((p) => p.id !== productId));
          } else {
            Alert.alert('خطأ', res.message);
          }
        },
      },
    ]);
  };

  const renderTabItem = ({ item }: { item: any }) => {
    if (activeTab === 'orders') {
      const isExpanded = expandedOrderId === item.id;
      return (
        <TouchableOpacity style={styles.tabCard} onPress={() => setExpandedOrderId(isExpanded ? null : item.id)} activeOpacity={0.8}>
          <View style={styles.tabCardRow}>
            <Text style={styles.tabCardTitle}>{item.id || item.order_number}</Text>
            <Text style={styles.tabCardValue}>{item.total || item.total_amount || 0} ج.م</Text>
          </View>
          <View style={styles.tabCardRow}>
            <Text style={styles.tabCardSub}>{item.date || item.created_at}</Text>
            <Text style={styles.tabCardSub}>{item.items_count || item.items || 0} أصناف</Text>
          </View>
          {isExpanded && item.products && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EAE1D5' }}>
              {item.products.map((prod: any, idx: number) => (
                <View key={idx} style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 6, gap: 12 }}>
                  <AppImage uri={prod.image_url} style={{ width: 40, height: 40, borderRadius: 6 }} />
                  <Text style={{ fontSize: 13, color: '#1F1B13', flex: 1, textAlign: 'right' }}>{prod.name}</Text>
                  <Text style={{ fontSize: 13, color: '#2D3C1F', fontWeight: 'bold' }}>{prod.quantity} x {prod.price} ج.م</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      );
    } else {
      // Cart or Wishlist item
      return (
        <View style={styles.productCard}>
          <AppImage uri={item.image_url} style={styles.productImage as any} />
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productPrice}>{item.price || 0} ج.م</Text>
          </View>
          {activeTab === 'cart' && (
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{item.quantity} {item.unit}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteCartItem(item.id)} style={{ padding: 4 }}>
                <MaterialIcons name="delete-outline" size={20} color="#BA1A1A" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward-ios" size={20} color="#1F1B13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>مستخدمي التطبيق</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.contentWrapper}>
        {/* Search */}
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#75786E" />
          <TextInput
            style={styles.searchInput}
            placeholder="البحث بالاسم أو الهاتف..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9A978F"
          />
        </View>

        {/* Users List */}
        {loading && !users.length ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContainer}
            onEndReached={handleLoadMoreUsers}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="group-off" size={48} color="#A8A29E" />
                <Text style={styles.emptyTitle}>لا يوجد مستخدمين</Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color="#2D3C1F" style={{ marginVertical: 16 }} />
              ) : null
            }
          />
        )}
      </View>

      <MobileFooterNav isAdmin />

      {/* User Details Modal */}
      <Modal
        visible={!!selectedUser}
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.iconBtn}>
              <MaterialIcons name="close" size={24} color="#1F1B13" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedUser?.name}</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* User Contact Info */}
          {selectedUser && (
            <View style={{ padding: 14, backgroundColor: '#F8F6F1', marginHorizontal: 20, marginBottom: 12, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: '#EAE8E2' }}>
              {selectedUser.phone !== '—' && (
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}
                    onPress={() => promptContactCustomer(selectedUser.name, selectedUser.phone)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF4F1', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="phone" size={18} color="#2D3C1F" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 10, color: '#7C7870', textAlign: 'right' }}>رقم الهاتف (اضغط للخيارات)</Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1F1B13' }}>{selectedUser.phone}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Call & WhatsApp Quick Buttons */}
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: '#EEF4F1',
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#D0E2D8',
                      }}
                      onPress={() => makePhoneCall(selectedUser.phone)}
                    >
                      <MaterialIcons name="call" size={14} color="#2D3C1F" />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2D3C1F' }}>موبايل</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#E8F8EE',
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#C6F0D3',
                      }}
                      onPress={() => openWhatsApp(selectedUser.phone)}
                    >
                      <FontAwesome name="whatsapp" size={15} color="#25D366" />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1B803A' }}>واتساب</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {selectedUser.address !== '—' && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#EAE8E2' }}
                  onPress={() => {
                    if (selectedUser.latitude && selectedUser.longitude) {
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selectedUser.latitude},${selectedUser.longitude}`);
                    } else {
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedUser.address)}`);
                    }
                  }}
                >
                  <MaterialIcons name="location-on" size={18} color="#2D3C1F" />
                  <Text style={{ fontSize: 13, color: '#556052', flex: 1, textAlign: 'right' }}>{selectedUser.address} - {selectedUser.region}</Text>
                </TouchableOpacity>
              )}

              {/* Send Notification Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#2E5A44',
                  paddingVertical: 10,
                  borderRadius: 10,
                  marginTop: 4,
                }}
                onPress={() => setIsNotifModalOpen(true)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="send" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>
                  إرسال إشعار فوري لهذا العميل
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {['orders', 'cart', 'wishlist'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => switchTab(tab as any)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'orders' ? 'الطلبات' : tab === 'cart' ? 'السلة' : 'المفضلة'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View style={styles.tabContentWrapper}>
            {loadingTab && !tabData.length ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2D3C1F" />
              </View>
            ) : (
              <FlatList
                data={tabData}
                renderItem={renderTabItem}
                keyExtractor={(item, index) => String(item.id || index)}
                contentContainerStyle={styles.listContainer}
                onEndReached={handleLoadMoreTab}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>لا توجد بيانات</Text>
                  </View>
                }
                ListFooterComponent={
                  loadingTabMore ? (
                    <ActivityIndicator size="small" color="#2D3C1F" style={{ marginVertical: 16 }} />
                  ) : null
                }
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Send Notification To User Modal */}
      <Modal
        visible={isNotifModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsNotifModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A2D23' }}>
                إرسال إشعار إلى {selectedUser?.name}
              </Text>
              <TouchableOpacity onPress={() => setIsNotifModalOpen(false)}>
                <MaterialIcons name="close" size={20} color="#7C7870" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#5C5950', marginBottom: 4, textAlign: 'right' }}>
              عنوان الإشعار
            </Text>
            <TextInput
              style={{ backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: '#EAE8E2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, textAlign: 'right', marginBottom: 12 }}
              value={notifTitle}
              onChangeText={setNotifTitle}
              placeholder="مثال: تنبيه بخصوص طلبك"
              placeholderTextColor="#9A978F"
            />

            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#5C5950', marginBottom: 4, textAlign: 'right' }}>
              نص الرسالة
            </Text>
            <TextInput
              style={{ backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: '#EAE8E2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, textAlign: 'right', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 }}
              value={notifBody}
              onChangeText={setNotifBody}
              placeholder="اكتب نص الرسالة التي ستصل للعميل كإشعار..."
              placeholderTextColor="#9A978F"
              multiline
              numberOfLines={4}
            />

            <View style={{ flexDirection: 'row-reverse', gap: 10, justifyContent: 'flex-start' }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#2E5A44', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 6 }}
                onPress={handleSendUserNotification}
                disabled={sendingNotif}
              >
                {sendingNotif ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>إرسال الآن</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EAE8E2', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setIsNotifModalOpen(false)}
              >
                <Text style={{ color: '#5C5950', fontWeight: '600', fontSize: 14 }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F1' },
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF8F1',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F1B13' },
  contentWrapper: { flex: 1, padding: 16 },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  searchInput: { flex: 1, marginRight: 8, textAlign: 'right', fontSize: 14, color: '#1F1B13' },
  listContainer: { paddingBottom: 24, gap: 12 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, color: '#75786E', marginTop: 12, fontWeight: '600' },
  
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  userHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  userIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D4EAB7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: 'bold', color: '#1F1B13', textAlign: 'right' },
  userShop: { fontSize: 13, color: '#75786E', textAlign: 'right', marginTop: 2 },
  userDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
  },
  phoneRowContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  clickablePhoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  quickActionBtnCall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0E2D8',
  },
  quickActionBtnWhatsapp: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8F8EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C6F0D3',
  },
  userMeta: { fontSize: 12, color: '#75786E', textAlign: 'right' },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#FFF8F1' },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  tabsContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#2D3C1F' },
  tabText: { fontSize: 14, color: '#75786E', fontWeight: '600' },
  tabTextActive: { color: '#2D3C1F', fontWeight: 'bold' },
  tabContentWrapper: { flex: 1, padding: 16 },

  // Tab Cards
  tabCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  tabCardRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  tabCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1F1B13' },
  tabCardValue: { fontSize: 14, fontWeight: 'bold', color: '#2D3C1F' },
  tabCardSub: { fontSize: 12, color: '#75786E' },

  // Product Card
  productCard: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    alignItems: 'center',
  },
  productImage: { width: 50, height: 50, borderRadius: 8, marginLeft: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: '#1F1B13', textAlign: 'right' },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#2D3C1F', textAlign: 'right', marginTop: 4 },
  qtyBadge: {
    backgroundColor: '#F6EDE0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qtyText: { fontSize: 12, fontWeight: 'bold', color: '#45483F' },
});
