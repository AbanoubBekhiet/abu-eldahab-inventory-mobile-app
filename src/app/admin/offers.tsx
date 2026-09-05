import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchAllOffers,
  createOffer,
  deleteOffer,
  fetchAdminProducts,
  logoutCustomer,
  OfferItem,
  Product,
} from '../../services/api';
import { AppImage } from '../../components/app-image';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import MobileFooterNav from '../../components/mobile-footer';

export default function AdminOffersScreen() {
  useRoleGuard('admin');
  const router = useRouter();

  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'expired'>('active');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerLimit, setOfferLimit] = useState('');
  const [durationDays, setDurationDays] = useState('3'); // Default 3 days
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAllOffers();
      setOffers(Array.isArray(res) ? res : []);
    } catch (e) {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const loadProductsForModal = async (search: string = '') => {
    setLoadingProducts(true);
    try {
      const res = await fetchAdminProducts(search, 'all', 1);
      setAdminProducts(res.products || []);
    } catch (e) {
      setAdminProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const openCreateModal = () => {
    setModalVisible(true);
    setSelectedProduct(null);
    setSearchQuery('');
    setOfferPrice('');
    setOfferLimit('');
    setDurationDays('3');
    setCustomExpiresAt('');
    loadProductsForModal('');
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

  const handleCreateOffer = async () => {
    if (!selectedProduct) {
      Alert.alert('تنبيه', 'يرجى اختيار منتج للعرض.');
      return;
    }
    const priceNum = parseFloat(offerPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال سعر عرض صحيح أكبر من صفر.');
      return;
    }

    let expiryDateStr = '';
    if (customExpiresAt.trim()) {
      expiryDateStr = customExpiresAt.trim();
    } else {
      const days = parseInt(durationDays, 10) || 1;
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiryDateStr = d.toISOString().slice(0, 19).replace('T', ' ');
    }

    const payload = {
      product_id: selectedProduct.id,
      offer_price: priceNum,
      offer_max_quantity: offerLimit ? parseInt(offerLimit, 10) : undefined,
      expires_at: expiryDateStr,
    };

    setCreating(true);
    const result = await createOffer(payload);
    setCreating(false);

    if (result.success) {
      Alert.alert('تم بنجاح 🌟', result.message || 'تمت إضافة العرض وإرسال إشعار للعملاء!');
      setModalVisible(false);
      loadOffers();
    } else {
      Alert.alert('خطأ', result.message || 'فشل في إضافة العرض.');
    }
  };

  const handleDeleteOffer = (offer: OfferItem) => {
    Alert.alert(
      'إلغاء العرض',
      `هل أنت تأكد من إلغاء العرض على "${offer.product?.name || 'هذا المنتج'}"؟ سيتم استرجاع السعر الأصلي.`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'إلغاء العرض',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteOffer(offer.id);
            if (success) {
              Alert.alert('تم الإلغاء', 'تم إلغاء العرض واسترجاع سعر المنتج الأصلي.');
              loadOffers();
            } else {
              Alert.alert('خطأ', 'فشل إلغاء العرض.');
            }
          },
        },
      ]
    );
  };

  const filteredOffers = offers.filter((o) => {
    if (filterTab === 'active') return o.is_active;
    if (filterTab === 'expired') return !o.is_active;
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#BA1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة العروض</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <MaterialIcons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentWrapper}>
        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, filterTab === 'active' && styles.tabBtnActive]}
            onPress={() => setFilterTab('active')}
          >
            <Text style={[styles.tabText, filterTab === 'active' && styles.tabTextActive]}>
              العروض النشطة ({offers.filter((o) => o.is_active).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, filterTab === 'expired' && styles.tabBtnActive]}
            onPress={() => setFilterTab('expired')}
          >
            <Text style={[styles.tabText, filterTab === 'expired' && styles.tabTextActive]}>
              المنتهية/الملغاة ({offers.filter((o) => !o.is_active).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, filterTab === 'all' && styles.tabBtnActive]}
            onPress={() => setFilterTab('all')}
          >
            <Text style={[styles.tabText, filterTab === 'all' && styles.tabTextActive]}>
              الكل ({offers.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <FlatList
            data={filteredOffers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="local-offer" size={48} color="#A8A29E" />
                <Text style={styles.emptyTitle}>لا توجد عروض في هذه الفئة</Text>
                <Text style={styles.emptySub}>اضغط على + لإضافة عرض جديد على أحد المنتجات.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const product = item.product;
              return (
                <View style={styles.offerCard}>
                  <View style={styles.cardHeader}>
                    <AppImage
                      uri={product?.image_url}
                      style={styles.thumbnail}
                      iconName="inventory"
                      iconSize={24}
                    />
                    <View style={styles.productDetails}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {product?.name || 'منتج غير معروف'}
                      </Text>
                      <Text style={styles.categoryText}>
                        {product?.category_name || 'عام'} • {product?.unit || 'علبة'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        item.is_active ? styles.statusActive : styles.statusExpired,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.is_active ? styles.statusTextActive : styles.statusTextExpired,
                        ]}
                      >
                        {item.is_active ? 'نشط' : 'منتهي'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>سعر العرض</Text>
                      <Text style={styles.detailValueOffer}>
                        {(Number(item.offer_price) || 0).toFixed(2)} ج.م
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>السعر الأصلي</Text>
                      <Text style={styles.detailValueOld}>
                        {(Number(item.original_price) || 0).toFixed(2)} ج.م
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>حد الشراء</Text>
                      <Text style={styles.detailValue}>
                        {item.offer_max_quantity ? `${item.offer_max_quantity} قطعة` : 'غير محدود'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.expiryText}>تاريخ الانتهاء: {item.expires_at}</Text>
                    {item.is_active && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteOffer(item)}
                      >
                        <MaterialIcons name="delete-outline" size={16} color="#BA1A1A" />
                        <Text style={styles.deleteBtnText}>إلغاء العرض</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* Create Offer Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>إضافة عرض جديد 🏷️</Text>
            </View>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalForm}>
                {/* Product Selector */}
                <Text style={styles.fieldLabel}>اختر المنتج *</Text>

                {selectedProduct ? (
                  <View style={styles.selectedProductBox}>
                    <View style={styles.selectedProductInfo}>
                      <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                      <Text style={styles.selectedProductPrice}>
                        السعر الحالي: {(Number(selectedProduct.price) || 0).toFixed(2)} ج.م
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedProduct(null)}
                      style={styles.changeProductBtn}
                    >
                      <Text style={styles.changeProductText}>تغيير</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.productPickerSection}>
                    <View style={styles.searchPickerBox}>
                      <MaterialIcons name="search" size={18} color="#75786E" />
                      <TextInput
                        style={styles.searchPickerInput}
                        placeholder="ابحث عن منتج بالاسم..."
                        value={searchQuery}
                        onChangeText={(txt) => {
                          setSearchQuery(txt);
                          loadProductsForModal(txt);
                        }}
                        placeholderTextColor="#9A978F"
                      />
                    </View>

                    {loadingProducts ? (
                      <ActivityIndicator size="small" color="#2D3C1F" style={{ marginVertical: 10 }} />
                    ) : (
                      <View style={styles.productListPicker}>
                        {adminProducts.slice(0, 5).map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={styles.pickerItem}
                            onPress={() => {
                              setSelectedProduct(p);
                              setOfferPrice(String(p.price || ''));
                              if (p.max_app_order_quantity) {
                                setOfferLimit(String(p.max_app_order_quantity));
                              }
                            }}
                          >
                            <Text style={styles.pickerItemName} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={styles.pickerItemPrice}>
                              {(Number(p.price) || 0).toFixed(2)} ج.م
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Offer Price */}
                <Text style={styles.fieldLabel}>سعر العرض الجديد (ج.م) *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="0.00"
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#9A978F"
                />

                {/* Max Order Limit */}
                <Text style={styles.fieldLabel}>الحد الأقصى للطلب لكل عميل (اختياري)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="مثال: 3 (اتركه فارغاً إذا كان غير محدود)"
                  value={offerLimit}
                  onChangeText={setOfferLimit}
                  keyboardType="numeric"
                  placeholderTextColor="#9A978F"
                />

                {/* Duration Picker */}
                <Text style={styles.fieldLabel}>مدة العرض *</Text>
                <View style={styles.daysRow}>
                  {['1', '2', '3', '7', '14', '30'].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.dayChip,
                        durationDays === d && !customExpiresAt && styles.dayChipActive,
                      ]}
                      onPress={() => {
                        setDurationDays(d);
                        setCustomExpiresAt('');
                      }}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          durationDays === d && !customExpiresAt && styles.dayChipTextActive,
                        ]}
                      >
                        {d} أيام
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>أو حدد تاريخ انتهاء مخصص (YYYY-MM-DD HH:MM)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="2026-09-10 23:59:00"
                  value={customExpiresAt}
                  onChangeText={setCustomExpiresAt}
                  placeholderTextColor="#9A978F"
                />

                {/* Submit */}
                <TouchableOpacity
                  style={styles.submitModalBtn}
                  onPress={handleCreateOffer}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitModalText}>حفظ وإرسال إشعار للعملاء 🚀</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  addBtn: {
    backgroundColor: '#2D3C1F',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  tabContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: '#D4EAB7',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#75786E',
  },
  tabTextActive: {
    color: '#2D3C1F',
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingBottom: 24,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
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
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  productDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  categoryText: {
    fontSize: 11,
    color: '#75786E',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#D4EAB7',
  },
  statusExpired: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusTextActive: {
    color: '#2D3C1F',
  },
  statusTextExpired: {
    color: '#991B1B',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EAE1D5',
    marginVertical: 10,
  },
  detailsGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 10,
    color: '#75786E',
    marginBottom: 2,
  },
  detailValueOffer: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  detailValueOld: {
    fontSize: 12,
    color: '#9A978F',
    textDecorationLine: 'line-through',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  expiryText: {
    fontSize: 11,
    color: '#75786E',
  },
  deleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#BA1A1A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  modalForm: {
    gap: 10,
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
    color: '#1F1B13',
    textAlign: 'right',
  },
  selectedProductBox: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F6EDE0',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4EAB7',
  },
  selectedProductInfo: {
    alignItems: 'flex-end',
  },
  selectedProductName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  selectedProductPrice: {
    fontSize: 11,
    color: '#75786E',
    marginTop: 2,
  },
  changeProductBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  changeProductText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  productPickerSection: {
    gap: 8,
  },
  searchPickerBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  searchPickerInput: {
    flex: 1,
    fontSize: 12,
    color: '#1F1B13',
    textAlign: 'right',
    paddingHorizontal: 6,
  },
  productListPicker: {
    gap: 6,
  },
  pickerItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  pickerItemName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F1B13',
    flex: 1,
    textAlign: 'right',
  },
  pickerItemPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  daysRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayChip: {
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dayChipActive: {
    backgroundColor: '#2D3C1F',
    borderColor: '#2D3C1F',
  },
  dayChipText: {
    fontSize: 11,
    color: '#75786E',
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  submitModalBtn: {
    backgroundColor: '#2D3C1F',
    borderRadius: 9999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
