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
  Switch,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchAdminProducts,
  fetchCategories,
  logoutCustomer,
  updateProductOnServer,
  Product,
  Category,
} from '../../services/api';
import { AppImage } from '../../components/app-image';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import MobileFooterNav from '../../components/mobile-footer';

export default function AdminProductsScreen() {
  useRoleGuard('admin');
  const router = useRouter();

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

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | number>('all');
  const [loading, setLoading] = useState(true);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Price Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editPriceInput, setEditPriceInput] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  useEffect(() => {
    fetchCategories().then((cats) => setCategories(Array.isArray(cats) ? cats : []));
  }, []);

  useEffect(() => {
    loadProducts(1);
  }, [search, selectedFilter]);

  const loadProducts = async (pageToLoad: number = 1) => {
    if (pageToLoad === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetchAdminProducts(search, selectedFilter, pageToLoad);
      if (pageToLoad === 1) {
        setProducts(res.products);
      } else {
        setProducts((prev) => [...prev, ...res.products]);
      }
      setNextPage(res.nextPage);
    } catch (e) {
      if (pageToLoad === 1) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && nextPage !== null) {
      loadProducts(nextPage);
    }
  };

  // Toggle availability on app (real API call)
  const toggleActive = async (id: number, currentVal: boolean) => {
    const newVal = !currentVal;
    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_available_on_app: newVal } : p))
    );

    const success = await updateProductOnServer(id, { is_available_on_app: newVal });
    if (!success) {
      // Revert if API failed
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_available_on_app: currentVal } : p))
      );
      Alert.alert('خطأ', 'تعذر تحديث حالة توفر المنتج على السيرفر.');
    }
  };

  // Open Edit Price Modal
  const openEditPriceModal = (product: Product) => {
    setEditingProduct(product);
    setEditPriceInput(String(product.price || 0));
  };

  // Save new price (real API call)
  const handleSavePrice = async () => {
    if (!editingProduct) return;
    const newPriceNum = parseFloat(editPriceInput);
    if (isNaN(newPriceNum) || newPriceNum < 0) {
      Alert.alert('تنبيه', 'يرجى إدخال سعر صحيح.');
      return;
    }

    setUpdatingPrice(true);
    const success = await updateProductOnServer(editingProduct.id, { price: newPriceNum });
    setUpdatingPrice(false);

    if (success) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, price: newPriceNum } : p))
      );
      setEditingProduct(null);
      Alert.alert('تم بنجاح 🌟', 'تم تعديل سعر المنتج بنجاح!');
    } else {
      Alert.alert('خطأ', 'فشل تعديل سعر المنتج على السيرفر.');
    }
  };

  const renderProductItem = useCallback(({ item }: { item: Product }) => {
    return (
      <View style={styles.productCard}>
        {/* Top Section: Image, Name, Category, Price */}
        <View style={styles.cardHeaderRow}>
          <AppImage
            uri={item.image_url}
            style={styles.thumbnailImage}
            iconName="inventory"
            iconSize={28}
          />

          <View style={styles.productMainDetails}>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.categoryBadgeText}>
              {item.category_name || 'عام'} • {item.unit || 'علبة'}
            </Text>
          </View>

          <View style={styles.priceTagBox}>
            <Text style={styles.priceText}>{(Number(item.price) || 0).toFixed(2)}</Text>
            <Text style={styles.currencyText}>ج.م</Text>
          </View>
        </View>

        {/* Divider Line */}
        <View style={styles.cardDivider} />

        {/* Bottom Section: Availability Switch & Edit Price Button */}
        <View style={styles.cardFooterRow}>
          <View style={styles.switchRow}>
            <Switch
              value={Boolean(item.is_available_on_app)}
              onValueChange={() => toggleActive(item.id, Boolean(item.is_available_on_app))}
              trackColor={{ false: '#EAE1D5', true: '#D4EAB7' }}
              thumbColor={item.is_available_on_app ? '#2D3C1F' : '#75786E'}
            />
            <Text style={[
              styles.stockLabel,
              { color: item.is_available_on_app ? '#2D3C1F' : '#991B1B' }
            ]}>
              {item.is_available_on_app ? 'متاح بالتطبيق' : 'مخفي من التطبيق'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editPriceBtn}
            onPress={() => openEditPriceModal(item)}
          >
            <MaterialIcons name="edit" size={15} color="#2D3C1F" />
            <Text style={styles.editPriceBtnText}>تعديل السعر</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#BA1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المنتجات</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.contentWrapper}>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#75786E" />
          <TextInput
            style={styles.searchInput}
            placeholder="البحث عن منتج بالاسم..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9A978F"
          />
        </View>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScrollView}
          contentContainerStyle={styles.chipsContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              (selectedFilter === 'all' || selectedFilter === 'الكل') && styles.filterChipActive,
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.filterChipText,
                (selectedFilter === 'all' || selectedFilter === 'الكل') && styles.filterChipTextActive,
              ]}
            >
              الكل
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isActive = selectedFilter === cat.id || selectedFilter === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(cat.id)}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Products FlatList with Infinite Scrolling */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <FlatList
            data={products}
            renderItem={renderProductItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="inventory-2" size={48} color="#A8A29E" />
                <Text style={styles.emptyTitle}>لا توجد منتجات</Text>
                <Text style={styles.emptySub}>لم يتم العثور على منتجات مطابقة لعملية البحث.</Text>
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

      {/* Edit Price Modal */}
      <Modal
        visible={Boolean(editingProduct)}
        animationType="fade"
        transparent
        onRequestClose={() => setEditingProduct(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingProduct(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditingProduct(null)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل سعر المنتج</Text>
            </View>

            {editingProduct && (
              <View style={styles.modalForm}>
                <Text style={styles.productNameModal}>{editingProduct.name}</Text>
                <Text style={styles.fieldLabel}>السعر الجديد (ج.م) *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="0.00"
                  value={editPriceInput}
                  onChangeText={setEditPriceInput}
                  keyboardType="numeric"
                  placeholderTextColor="#9A978F"
                />

                <TouchableOpacity
                  style={styles.submitModalBtn}
                  onPress={handleSavePrice}
                  disabled={updatingPrice}
                >
                  {updatingPrice ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitModalText}>حفظ السعر الجديد</Text>
                  )}
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
    gap: 12,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  thumbnailImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  productMainDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
  },
  categoryBadgeText: {
    fontSize: 11,
    color: '#75786E',
    marginTop: 4,
    textAlign: 'right',
  },
  priceTagBox: {
    alignItems: 'center',
    backgroundColor: '#F6EDE0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  currencyText: {
    fontSize: 10,
    color: '#75786E',
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EAE1D5',
    marginVertical: 12,
  },
  cardFooterRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  stockLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  editPriceBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D4EAB7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  editPriceBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3C1F',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
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
  productNameModal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3C1F',
    textAlign: 'right',
    marginBottom: 12,
  },
  modalForm: {
    gap: 12,
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
    fontSize: 15,
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
});
