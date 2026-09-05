import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import MobileFooterNav from '../components/mobile-footer';
import {
  getCartItems,
  updateCartItemQty,
  removeCartItem,
  clearCart,
  placeCustomerOrder,
  CartItem,
  fetchUserProfile,
} from '../services/api';
import { AppImage } from '../components/app-image';
import { useRoleGuard } from '../hooks/useRoleGuard';

export default function CartScreen() {
  useRoleGuard('customer');
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    loadRealCart();
  }, []);

  const loadRealCart = async () => {
    setLoading(true);
    try {
      const items = await getCartItems();
      setCartItems(items);
    } catch (e) {
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * i.quantity, 0);
  const totalItemsCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const handleUpdateQuantity = async (id: number, delta: number) => {
    const item = cartItems.find((i) => Number(i.product_id || i.id) === id);
    if (delta > 0 && item && item.max_app_order_quantity) {
      const maxLimitNum = Number(item.max_app_order_quantity);
      if (maxLimitNum > 0 && item.quantity >= maxLimitNum) {
        Alert.alert(
          'حد الكمية المسموحة',
          `عذراً، أقصى كمية مسموح بشرائها لهذا المنتج هي ${maxLimitNum} قطعة فقط.`
        );
        return;
      }
    }
    const updated = await updateCartItemQty(id, delta);
    setCartItems(updated);
  };

  const handleRemoveItem = async (id: number) => {
    const updated = await removeCartItem(id);
    setCartItems(updated);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      // Validate region limits
      try {
        const user = await fetchUserProfile();
        if (user && user.region) {
          if (user.region.min_order_total > 0 && subtotal < user.region.min_order_total) {
            Alert.alert('الحد الأدنى للطلب', `الحد الأدنى لقيمة الطلب لمنطقتك هو ${user.region.min_order_total} ج.م`);
            setSubmitting(false);
            return;
          }
          if (user.region.min_products_count > 0 && cartItems.length < user.region.min_products_count) {
            Alert.alert('الحد الأدنى للمنتجات', `الحد الأدنى لعدد المنتجات لمنطقتك هو ${user.region.min_products_count} صنف`);
            setSubmitting(false);
            return;
          }
        }
      } catch (err) {
        // Continue if profile fetch fails
      }

      const itemsPayload = cartItems.map((i) => ({
        product_id: i.product_id || i.id,
        quantity: i.quantity,
        unit_price: Number(i.price) || 0,
      }));

      await placeCustomerOrder(itemsPayload, notes || 'طلب خردوات ومنظفات وورقيات عبر التطبيق');
      await clearCart();
      setCartItems([]);
      setOrderSuccess(true);
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'حدث خطأ أثناء تنفيذ الطلب. يرجى المحاولة لاحقاً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* FMCG Top Bar */}
      <View style={styles.topAppBar}>
        <Text style={styles.brandTitle}>أبو الدهب - السلة</Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Page Title & Count Badge */}
        <View style={styles.pageHeaderRow}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{totalItemsCount} عناصر</Text>
          </View>
          <Text style={styles.pageTitle}>سلة المشتريات</Text>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
            <Text style={styles.loadingText}>جاري تحميل السلة...</Text>
          </View>
        ) : orderSuccess ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="check-circle" size={54} color="#2D3C1F" />
            <Text style={styles.successTitle}>تم إرسال طلبك بنجاح!</Text>
            <Text style={styles.successSub}>
              سيقوم فريق العمل بتجهيز طلبك والتواصل معك فوراً للتسليم.
            </Text>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.push('/')}>
              <Text style={styles.homeBtnText}>العودة للرئيسية</Text>
            </TouchableOpacity>
          </View>
        ) : cartItems.length === 0 ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="shopping-cart" size={54} color="#75786E" />
            <Text style={styles.emptyTitle}>سلة التسوق فارغة حالياً</Text>
            <Text style={styles.emptySub}>
              تصفح الخردوات والمنظفات والورقيات في المتجر وأضف مشترياتك للسلة.
            </Text>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.push('/')}>
              <Text style={styles.homeBtnText}>تصفح المنتجات الآن</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Real Cart Items List */}
            <View style={styles.cartList}>
              {cartItems.map((item) => (
                <View key={item.id} style={styles.cartCard}>
                  {/* Left Side (Trash icon & Stepper) */}
                  <View style={styles.cardLeftCol}>
                    <Text style={styles.cardPrice}>{(Number(item.price) * item.quantity).toFixed(2)} ج.م</Text>
                    <View style={styles.stepperAndTrashRow}>
                      <TouchableOpacity style={styles.trashBtn} onPress={() => handleRemoveItem(item.id)}>
                        <MaterialIcons name="delete-outline" size={20} color="#BA1A1A" />
                      </TouchableOpacity>

                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => handleUpdateQuantity(item.id, 1)}
                        >
                          <MaterialIcons name="add" size={14} color="#1F1B13" />
                        </TouchableOpacity>
                        <Text style={styles.stepperNumber}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => handleUpdateQuantity(item.id, -1)}
                        >
                          <MaterialIcons name="remove" size={14} color="#1F1B13" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Right Side (Info & Image) */}
                  <View style={styles.cardRightCol}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemVariant}>{item.category_name || 'خردوات ومنظفات وورقيات'}</Text>
                    </View>

                    <AppImage
                      uri={item.image_url}
                      style={styles.itemImage}
                      iconName="shopping-basket"
                      iconSize={28}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Order Notes */}
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>ملاحظات التوصيل أو الاستلام (اختياري)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="أضف ملاحظات للموزع أو سائق الشحن..."
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor="#75786E"
              />
            </View>

            {/* Order Summary Box */}
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>ملخص الفاتورة والطلب</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>{subtotal.toFixed(2)} ج.م</Text>
                <Text style={styles.summaryLabel}>المجموع الفرعي</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryFreeValue}>مجاني</Text>
                <Text style={styles.summaryLabel}>الشحن والتوصيل</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalValue}>{subtotal.toFixed(2)} ج.م</Text>
                <Text style={styles.totalLabel}>الإجمالي الكلي</Text>
              </View>

              {/* CTA Checkout Button */}
              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={handleCheckout}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={styles.checkoutBtnContent}>
                    <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
                    <Text style={styles.checkoutBtnText}>المتابعة لإتمام الشراء</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.securityCaption}>دفع آمن وسريع عبر أبو الدهب باي</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky Bottom Footer Navigation */}
      <MobileFooterNav cartCount={totalItemsCount} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1',
  },
  topAppBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFF8F1',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  pageHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  countBadge: {
    backgroundColor: '#F6EDE0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#45483F',
  },
  cartList: {
    gap: 12,
    marginBottom: 16,
  },
  cartCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    elevation: 2,
    shadowColor: '#2D3C1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  cardLeftCol: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    height: 90,
  },
  cardPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  stepperAndTrashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trashBtn: {
    padding: 4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6EDE0',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 10,
  },
  stepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  cardRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'flex-end',
  },
  itemInfo: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
  },
  itemVariant: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 2,
    textAlign: 'right',
  },
  itemImage: {
    width: 84,
    height: 84,
    borderRadius: 16,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginBottom: 6,
    textAlign: 'right',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 16,
    padding: 12,
    fontSize: 12,
    color: '#1F1B13',
    textAlign: 'right',
    height: 60,
  },
  summaryContainer: {
    backgroundColor: '#F6EDE0',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EAE1D5',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'right',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#45483F',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  summaryFreeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  divider: {
    height: 1,
    backgroundColor: '#EAE1D5',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  checkoutBtn: {
    backgroundColor: '#2D3C1F',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  securityCaption: {
    textAlign: 'center',
    fontSize: 11,
    color: '#75786E',
    marginTop: 12,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#75786E',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F1B13',
    marginTop: 10,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#75786E',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 260,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3C1F',
    marginTop: 10,
    marginBottom: 6,
  },
  successSub: {
    fontSize: 13,
    color: '#45483F',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  homeBtn: {
    backgroundColor: '#2D3C1F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  homeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
