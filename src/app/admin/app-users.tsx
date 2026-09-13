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
import { MaterialIcons } from '@expo/vector-icons';

import { useRoleGuard } from '../../hooks/useRoleGuard';
import {
  fetchAppUsers,
  fetchAppUserCart,
  fetchAppUserWishlist,
  deleteAppUserCartItem,
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
        <Text style={styles.userMeta}><MaterialIcons name="phone" size={12} /> {item.phone}</Text>
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
            <View style={{ padding: 16, backgroundColor: '#F8F6F1', marginHorizontal: 20, marginBottom: 12, borderRadius: 12, gap: 8 }}>
              {selectedUser.phone !== '—' && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}
                  onPress={() => Linking.openURL(`tel:${selectedUser.phone}`)}
                >
                  <MaterialIcons name="phone" size={20} color="#2D3C1F" />
                  <Text style={{ fontSize: 15, color: '#1F1B13' }}>{selectedUser.phone}</Text>
                </TouchableOpacity>
              )}
              {selectedUser.address !== '—' && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}
                  onPress={() => {
                    if (selectedUser.latitude && selectedUser.longitude) {
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selectedUser.latitude},${selectedUser.longitude}`);
                    } else {
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedUser.address)}`);
                    }
                  }}
                >
                  <MaterialIcons name="location-on" size={20} color="#2D3C1F" />
                  <Text style={{ fontSize: 15, color: '#1F1B13' }}>{selectedUser.address} - {selectedUser.region}</Text>
                </TouchableOpacity>
              )}
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
