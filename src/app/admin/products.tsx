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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchAdminProducts,
  fetchCategories,
  logoutCustomer,
  updateProductOnServer,
  UpdateProductPayload,
  Product,
  Category,
} from '../../services/api';
import { AppImage } from '../../components/app-image';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import MobileFooterNav from '../../components/mobile-footer';

const PRODUCT_UNITS = ['قطعة', 'علبة', 'كرتونة', 'شكارة', 'شريط', 'دستة', 'لفة'];

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

  // Full Product Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    category_id: 0,
    price: '',
    cost_price: '',
    stock: '',
    unit: 'قطعة',
    number_of_items_in_unit: '1',
    max_app_order_quantity: '',
    description: '',
    is_available_on_app: true,
  });

  useEffect(() => {
    fetchCategories().then((cats) => setCategories(Array.isArray(cats) ? cats : []));
  }, []);

  useEffect(() => {
    loadProducts(1);
  }, [search, selectedFilter]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts(1);
    setRefreshing(false);
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

    const res = await updateProductOnServer(id, { is_available_on_app: newVal });
    if (!res.success) {
      // Revert if API failed
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_available_on_app: currentVal } : p))
      );
      Alert.alert('خطأ', res.message || 'تعذر تحديث حالة توفر المنتج على السيرفر.');
    }
  };

  // Open Full Product Edit Modal
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name || '',
      category_id: product.category_id || (categories[0]?.id ?? 0),
      price: product.price !== undefined ? String(product.price) : '',
      cost_price: product.cost_price !== undefined ? String(product.cost_price) : '',
      stock: product.stock !== undefined ? String(product.stock) : '0',
      unit: product.unit || 'قطعة',
      number_of_items_in_unit: product.number_of_items_in_unit ? String(product.number_of_items_in_unit) : '1',
      max_app_order_quantity: product.max_app_order_quantity ? String(product.max_app_order_quantity) : '',
      description: product.description || '',
      is_available_on_app: Boolean(product.is_available_on_app),
    });
  };

  // Save updated product
  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    if (!editForm.name.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المنتج.');
      return;
    }
    const priceNum = parseFloat(editForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('تنبيه', 'يرجى إدخال سعر بيع صحيح.');
      return;
    }
    const costPriceNum = editForm.cost_price.trim() !== '' ? parseFloat(editForm.cost_price) : 0;
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      Alert.alert('تنبيه', 'يرجى إدخال سعر تكلفة صحيح.');
      return;
    }
    const stockNum = parseFloat(editForm.stock);
    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert('تنبيه', 'يرجى إدخال كمية مخزون صحيحة.');
      return;
    }

    const payload: UpdateProductPayload = {
      name: editForm.name.trim(),
      category_id: editForm.category_id || undefined,
      price: priceNum,
      cost_price: costPriceNum,
      stock: stockNum,
      unit: editForm.unit,
      number_of_items_in_unit: parseInt(editForm.number_of_items_in_unit) || 1,
      max_app_order_quantity: editForm.max_app_order_quantity.trim() !== '' ? parseInt(editForm.max_app_order_quantity) : null,
      description: editForm.description.trim(),
      is_available_on_app: editForm.is_available_on_app,
    };

    setUpdatingProduct(true);
    const res = await updateProductOnServer(editingProduct.id, payload);
    setUpdatingProduct(false);

    if (res.success) {
      const selectedCategoryObj = categories.find((c) => c.id === editForm.category_id);
      const updatedProductData: Partial<Product> = {
        ...payload,
        category_name: selectedCategoryObj ? selectedCategoryObj.name : editingProduct.category_name,
        ...(res.product || {}),
      };

      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updatedProductData } : p))
      );
      setEditingProduct(null);
      Alert.alert('تم بنجاح 🌟', 'تم تعديل بيانات المنتج بنجاح!');
    } else {
      Alert.alert('خطأ', res.message || 'فشل تعديل بيانات المنتج على السيرفر.');
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
            <View style={styles.inventoryInfoRow}>
              <Text style={styles.inventoryInfoText}>
                المخزون: <Text style={styles.inventoryInfoBold}>{item.stock} {item.unit || 'وحدة'}</Text>
              </Text>
              <Text style={styles.inventoryInfoDot}>•</Text>
              <Text style={styles.inventoryInfoText}>
                التكلفة: <Text style={styles.inventoryInfoBold}>{(Number(item.cost_price) || 0).toFixed(2)} ج.م</Text>
              </Text>
            </View>
          </View>

          <View style={styles.priceTagBox}>
            <Text style={styles.priceText}>{(Number(item.price) || 0).toFixed(2)}</Text>
            <Text style={styles.currencyText}>ج.م</Text>
          </View>
        </View>

        {/* Divider Line */}
        <View style={styles.cardDivider} />

        {/* Bottom Section: Availability Switch & Edit Product Button */}
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
            onPress={() => openEditModal(item)}
          >
            <MaterialIcons name="edit" size={15} color="#2D3C1F" />
            <Text style={styles.editPriceBtnText}>تعديل المنتج</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [categories]);

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
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <FlatList
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2D3C1F"]} />
            }
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

      {/* Edit Product Modal */}
      <Modal
        visible={Boolean(editingProduct)}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingProduct(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingProduct(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditingProduct(null)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل بيانات المنتج</Text>
            </View>

            {editingProduct && (
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Product Name */}
                <Text style={styles.fieldLabel}>اسم المنتج *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="اسم المنتج..."
                  value={editForm.name}
                  onChangeText={(val) => setEditForm((prev) => ({ ...prev, name: val }))}
                  placeholderTextColor="#9A978F"
                />

                {/* Category Selection */}
                <Text style={styles.fieldLabel}>القسم / التصنيف *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRowContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.chipOption,
                        editForm.category_id === cat.id && styles.chipOptionActive,
                      ]}
                      onPress={() => setEditForm((prev) => ({ ...prev, category_id: cat.id }))}
                    >
                      <Text
                        style={[
                          styles.chipOptionText,
                          editForm.category_id === cat.id && styles.chipOptionTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Pricing: Selling Price & Cost Price */}
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>سعر التكلفة (ج.م)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0.00"
                      value={editForm.cost_price}
                      onChangeText={(val) => setEditForm((prev) => ({ ...prev, cost_price: val }))}
                      keyboardType="numeric"
                      placeholderTextColor="#9A978F"
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>سعر البيع (ج.م) *</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0.00"
                      value={editForm.price}
                      onChangeText={(val) => setEditForm((prev) => ({ ...prev, price: val }))}
                      keyboardType="numeric"
                      placeholderTextColor="#9A978F"
                    />
                  </View>
                </View>

                {/* Stock & Items in Unit */}
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>عدد القطع بالوحدة</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="1"
                      value={editForm.number_of_items_in_unit}
                      onChangeText={(val) => setEditForm((prev) => ({ ...prev, number_of_items_in_unit: val }))}
                      keyboardType="numeric"
                      placeholderTextColor="#9A978F"
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>المخزون الحالي *</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0"
                      value={editForm.stock}
                      onChangeText={(val) => setEditForm((prev) => ({ ...prev, stock: val }))}
                      keyboardType="numeric"
                      placeholderTextColor="#9A978F"
                    />
                  </View>
                </View>

                {/* Unit Picker Chips */}
                <Text style={styles.fieldLabel}>وحدة القياس *</Text>
                <View style={styles.unitChipsGrid}>
                  {PRODUCT_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.unitChip,
                        editForm.unit === u && styles.unitChipActive,
                      ]}
                      onPress={() => setEditForm((prev) => ({ ...prev, unit: u }))}
                    >
                      <Text
                        style={[
                          styles.unitChipText,
                          editForm.unit === u && styles.unitChipTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Max App Order Quantity */}
                <Text style={styles.fieldLabel}>أقصى كمية طلب للعميل في التطبيق (اختياري)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="بدون حد أقصى (اتركه فارغاً)"
                  value={editForm.max_app_order_quantity}
                  onChangeText={(val) => setEditForm((prev) => ({ ...prev, max_app_order_quantity: val }))}
                  keyboardType="numeric"
                  placeholderTextColor="#9A978F"
                />

                {/* Description */}
                <Text style={styles.fieldLabel}>وصف المنتج (اختياري)</Text>
                <TextInput
                  style={[styles.fieldInput, styles.textAreaInput]}
                  placeholder="اكتب وصفاً أو تفاصيل عن المنتج..."
                  value={editForm.description}
                  onChangeText={(val) => setEditForm((prev) => ({ ...prev, description: val }))}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#9A978F"
                />

                {/* Availability Toggle */}
                <View style={styles.switchBox}>
                  <View style={styles.switchTextBox}>
                    <Text style={styles.switchTitle}>إتاحة المنتج في تطبيق العملاء</Text>
                    <Text style={styles.switchSub}>
                      {editForm.is_available_on_app
                        ? 'المنتج متاح ويظهر للعملاء في التطبيق'
                        : 'المنتج مخفي ولن يظهر للعملاء'}
                    </Text>
                  </View>
                  <Switch
                    value={editForm.is_available_on_app}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, is_available_on_app: val }))}
                    trackColor={{ false: '#EAE1D5', true: '#D4EAB7' }}
                    thumbColor={editForm.is_available_on_app ? '#2D3C1F' : '#75786E'}
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelModalBtn}
                    onPress={() => setEditingProduct(null)}
                  >
                    <Text style={styles.cancelModalBtnText}>إلغاء</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitModalBtn}
                    onPress={handleSaveProduct}
                    disabled={updatingProduct}
                  >
                    {updatingProduct ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.submitModalText}>حفظ التعديلات</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
    flexDirection: 'row',
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
  inventoryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  inventoryInfoText: {
    fontSize: 11,
    color: '#75786E',
  },
  inventoryInfoBold: {
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  inventoryInfoDot: {
    fontSize: 10,
    color: '#D5D2C4',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F4F0',
    marginBottom: 12,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  modalScrollView: {
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F1B13',
    textAlign: 'right',
    marginTop: 10,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1B13',
    textAlign: 'right',
  },
  textAreaInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  chipsRowContainer: {
    flexGrow: 0,
    marginTop: 4,
    marginBottom: 6,
  },
  chipOption: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginRight: 8,
  },
  chipOptionActive: {
    backgroundColor: '#2D3C1F',
    borderColor: '#2D3C1F',
  },
  chipOptionText: {
    fontSize: 12,
    color: '#75786E',
    fontWeight: '600',
  },
  chipOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  unitChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  unitChipActive: {
    backgroundColor: '#D4EAB7',
    borderColor: '#2D3C1F',
  },
  unitChipText: {
    fontSize: 12,
    color: '#75786E',
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: '#2D3C1F',
    fontWeight: 'bold',
  },
  switchBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    marginBottom: 16,
  },
  switchTextBox: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  switchSub: {
    fontSize: 11,
    color: '#75786E',
    marginTop: 2,
    textAlign: 'right',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F5F4F0',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#75786E',
  },
  submitModalBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#2D3C1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
