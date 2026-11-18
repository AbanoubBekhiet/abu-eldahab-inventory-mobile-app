import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearFcmToken } from './fcm';
import { Alert, DeviceEventEmitter } from 'react-native';
import {
  AppMode,
  getActiveAppMode,
  setActiveAppMode,
  clearActiveAppMode,
} from './app-mode';

export { AppMode, getActiveAppMode, setActiveAppMode, clearActiveAppMode };

function getApiBaseUrl(): string {
  // If you need to test locally, uncomment the code below:
  /*
  try {
    const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost || '';
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:8000/api`;
      }
    }
  } catch (e) {}
  return 'http://192.168.100.10:8000/api';
  */
  
  // Production URL
  return 'https://abu-eldahab.sbs/api';
}

export const API_BASE_URL = getApiBaseUrl();

let authToken: string | null = null;
let cachedUser: User | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    AsyncStorage.setItem('auth_token', token).catch(() => {});
  } else {
    AsyncStorage.removeItem('auth_token').catch(() => {});
    AsyncStorage.removeItem('user_profile_v1').catch(() => {});
    clearActiveAppMode().catch(() => {});
    cachedUser = null;
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function loadSavedAuthToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      authToken = token;
    }
    const rawUser = await AsyncStorage.getItem('user_profile_v1');
    if (rawUser) {
      cachedUser = JSON.parse(rawUser);
    }
    return token;
  } catch (e) {
    return null;
  }
}

export interface Product {
  id: number;
  name: string;
  price: number;
  cost_price?: number;
  description?: string;
  is_available_on_app: boolean;
  max_app_order_quantity?: number | null;
  stock: number;
  unit?: string;
  category_id?: number;
  category_name?: string;
  image_url?: string | null;
  sku?: string;
  number_of_items_in_unit?: number;
  active_offer?: {
    id: number;
    offer_price: number;
    original_price: number;
    discount_percentage: number;
    expires_at: string;
    offer_max_quantity?: number | null;
  } | null;
}

export interface Category {
  id: number;
  name: string;
  image_url?: string | null;
  products_count?: number;
}

export interface CartItem {
  id: number;
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  category_name?: string;
  max_app_order_quantity?: number | null;
  is_offer?: boolean;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus | string, string> = {
  [OrderStatus.PENDING]: 'قيد الانتظار',
  [OrderStatus.CONFIRMED]: 'تم التأكيد',
  [OrderStatus.SHIPPED]: 'تم الشحن',
  [OrderStatus.DELIVERED]: 'تم التوصيل',
  [OrderStatus.CANCELLED]: 'ملغي',
};

export interface Order {
  id: number | string;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_latitude?: number | null;
  customer_longitude?: number | null;
  created_at?: string;
  date?: string;
  total_amount?: number;
  total?: number;
  status: OrderStatus | string;
  status_label?: string;
  items?: OrderItem[];
  notes?: string;
}

export interface Region {
  id: number;
  name: string;
  min_order_total: number;
  min_products_count: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  shop_name?: string;
  address?: string;
  role?: string;
  region?: Region;
  profile?: {
    phone_number?: string;
    shop_name?: string;
    address?: string;
    latitude?: string | number | null;
    longitude?: string | number | null;
    region_id?: string | number | null;
  };
}

export interface OrderHistoryItem {
  id: string;        // e.g. #ORD-0001
  raw_id: number;
  total: number;
  net_total: number;
  status: string;
  payment_type: string;
  notes: string;
  date: string;
  items_count: number;
  items: { name: string; quantity: number; price: number }[];
}

export interface UserAccountData {
  user: User;
  balance: number;        // positive = owes money
  total_debts: number;
  total_payments: number;
  orders: OrderHistoryItem[];
}

// Cart Storage Management
// We now use Backend API for cart management.
export async function getCartItems(): Promise<CartItem[]> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return [];
    
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/cart`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.cart_items || [];
    DeviceEventEmitter.emit('cart_updated', { cartItems: items, action: 'sync' });
    return items;
  } catch (e) {
    return [];
  }
}

export async function saveCartItems(items: CartItem[]): Promise<void> {
  // Deprecated: Managed by backend
}

export async function addProductToCart(
  product: Product,
  quantity = 1,
  options?: { isOffer?: boolean; unitPrice?: number }
): Promise<CartItem[]> {
  try {
    if (!authToken) {
      alert('يرجى تسجيل الدخول أولاً لإضافة منتجات للسلة');
      return [];
    }
    
    const headers: Record<string, string> = { 
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    const isOffer = options?.isOffer ?? false;
    const unitPrice = options?.unitPrice ?? (isOffer ? product.price : undefined);

    const res = await fetch(`${API_BASE_URL}/cart`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        product_id: product.id,
        quantity,
        is_offer: isOffer,
        unit_price: unitPrice,
      })
    });
    if (!res.ok) {
      let data: any = {};
      try { data = await res.json(); } catch(err) {}
      throw new Error(data.message || 'Error adding to cart');
    }
    const data = await res.json();
    if (data.success === false) {
       throw new Error(data.message || 'Error adding to cart');
    }
    const items = data.cart_items || [];
    DeviceEventEmitter.emit('cart_updated', { cartItems: items, action: 'add' });
    return items;
  } catch (e: any) {
    const msg = e?.message || 'حدث خطأ أثناء الإضافة للسلة';
    Alert.alert('تنبيه', msg);
    const items = await getCartItems();
    DeviceEventEmitter.emit('cart_updated', { cartItems: items, action: 'sync' });
    return items;
  }
}

export async function updateCartItemQty(productId: number | string, delta: number): Promise<CartItem[]> {
  try {
    if (!authToken) return await getCartItems();
    
    const headers: Record<string, string> = { 
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    const res = await fetch(`${API_BASE_URL}/cart/${productId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ delta })
    });
    if (!res.ok) {
      let data: any = {};
      try { data = await res.json(); } catch(err) {}
      throw new Error(data.message || 'حدث خطأ أثناء تعديل السلة');
    }
    const data = await res.json();
    if (data.success === false) {
       throw new Error(data.message || 'حدث خطأ أثناء تعديل السلة');
    }
    const items = data.cart_items || [];
    DeviceEventEmitter.emit('cart_updated', { cartItems: items, action: delta > 0 ? 'increase' : 'decrease' });
    return items;
  } catch (e: any) {
    const msg = e?.message || 'حدث خطأ أثناء تحديث السلة';
    Alert.alert('تنبيه', msg);
    const items = await getCartItems();
    DeviceEventEmitter.emit('cart_updated', { cartItems: items, action: 'sync' });
    return items;
  }
}

export async function removeCartItem(productId: number | string): Promise<CartItem[]> {
  try {
    if (!authToken) return await getCartItems();
    
    const headers: Record<string, string> = { 
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    const res = await fetch(`${API_BASE_URL}/cart/${productId}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) return await getCartItems();
    const data = await res.json();
    const items = data.cart_items || [];
    DeviceEventEmitter.emit('cart_updated', { cartItems: items, action: 'remove' });
    return items;
  } catch (e) {
    const items = await getCartItems();
    DeviceEventEmitter.emit('cart_updated', { cartItems: items, action: 'sync' });
    return items;
  }
}

export async function clearCart(): Promise<void> {
  try {
    if (!authToken) return;
    
    const headers: Record<string, string> = { 
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    await fetch(`${API_BASE_URL}/cart/clear`, {
      method: 'DELETE',
      headers
    });
    DeviceEventEmitter.emit('cart_updated', { cartItems: [], action: 'clear' });
  } catch (e: any) {
    console.error('clearCart error:', e);
  }
}

// Favorites Management via Backend API
export async function getFavoriteIds(): Promise<number[]> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return [];
    
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/wishlist`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.favorite_ids || [];
  } catch (e) {
    return [];
  }
}

export async function toggleFavoriteId(productId: number | string): Promise<number[]> {
  try {
    if (!authToken) {
      alert('يرجى تسجيل الدخول أولاً لإضافة منتجات للمفضلة');
      return [];
    }
    
    const headers: Record<string, string> = { 
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    const res = await fetch(`${API_BASE_URL}/wishlist/toggle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ product_id: productId })
    });
    if (!res.ok) return await getFavoriteIds();
    const data = await res.json();
    return data.favorite_ids || [];
  } catch (e: any) {
    alert(e.message || 'حدث خطأ أثناء الإضافة للمفضلة');
    return await getFavoriteIds();
  }
}

// Fetch products from real API
export async function fetchAppProducts(
  search?: string,
  categoryId?: string | number,
  page: number = 1
): Promise<{ products: Product[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    let url = `${API_BASE_URL}/products?for_app=1&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId && categoryId !== 'all') url += `&category_id=${categoryId}`;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return { products: [], nextPage: null };
    const data = await res.json();
    const items = data.products?.data || data.data || (Array.isArray(data) ? data : []);
    const nextPage = data.products?.next_page ?? null;
    const formatted = Array.isArray(items)
      ? items.map((p: any) => ({
          ...p,
          id: Number(p.id),
          price: Number(p.price) || 0,
        }))
      : [];
    return { products: formatted, nextPage };
  } catch (error) {
    console.error('Failed to fetch app products:', error);
    return { products: [], nextPage: null };
  }
}

// Fetch products by specific IDs (e.g. for Wishlist)
export async function fetchProductsByIds(ids: number[]): Promise<Product[]> {
  try {
    if (!ids || ids.length === 0) return [];
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/products?for_app=1&ids=${ids.join(',')}`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.products?.data || data.data || (Array.isArray(data) ? data : []);
    return Array.isArray(items)
      ? items.map((p: any) => ({
          ...p,
          id: Number(p.id),
          price: Number(p.price) || 0,
        }))
      : [];
  } catch (error) {
    console.error('Failed to fetch products by ids:', error);
    return [];
  }
}

export async function fetchRegions(): Promise<Region[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/regions`);
    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error('Error fetching regions:', error);
    return [];
  }
}

// Fetch categories from real API
export async function fetchCategories(): Promise<Category[]> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/categories`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.categories || data.data || data || [];
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
}

// Place real order
export async function placeCustomerOrder(items: { product_id: number; quantity: number; unit_price: number }[], notes?: string) {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items,
        payment_type: 'cash',
        notes: notes || 'طلب خردوات ومنظفات وورقيات عبر التطبيق',
      }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'حدث خطأ أثناء تنفيذ الطلب');
    }
    return data;
  } catch (error) {
    console.error('Failed to place order:', error);
    throw error;
  }
}

// Fetch customer orders with pagination for infinite scroll
export async function fetchCustomerOrdersPaginated(
  page: number = 1
): Promise<{ orders: any[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/orders?my_orders=1&page=${page}`, { headers });
    if (!res.ok) return { orders: [], nextPage: null };
    const data = await res.json();
    const items = data.orders?.data || data.data || (Array.isArray(data) ? data : []);
    const nextPage = data.orders?.next_page ?? null;
    return { orders: Array.isArray(items) ? items : [], nextPage };
  } catch (error) {
    console.error('Failed to fetch customer orders:', error);
    return { orders: [], nextPage: null };
  }
}

// Fetch admin orders from real API (paginated)
export async function fetchAdminOrdersPaginated(
  page: number = 1,
  status: string = 'all'
): Promise<{ orders: Order[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    let url = `${API_BASE_URL}/orders?page=${page}`;
    if (status && status !== 'all') {
      url += `&status=${status}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return { orders: [], nextPage: null };
    const data = await res.json();
    const items = data.orders?.data || data.data || (Array.isArray(data) ? data : []);
    const nextPage = data.orders?.next_page ?? null;
    return { orders: Array.isArray(items) ? items : [], nextPage };
  } catch (error) {
    console.error('Failed to fetch admin orders:', error);
    return { orders: [], nextPage: null };
  }
}

export async function fetchAdminOrders(): Promise<Order[]> {
  const res = await fetchAdminOrdersPaginated(1);
  return res.orders;
}

export async function fetchPendingOrdersCount(): Promise<number> {
  try {
    const res = await fetchAdminOrdersPaginated(1);
    return res.orders.filter(o => o.status === OrderStatus.PENDING).length;
  } catch (error) {
    return 0;
  }
}

// Fetch products for admin (shows all products including inactive ones, paginated)
export async function fetchAdminProducts(
  search?: string,
  categoryId?: string | number,
  page: number = 1
): Promise<{ products: Product[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    let url = `${API_BASE_URL}/products?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId && categoryId !== 'all' && categoryId !== 'الكل') url += `&category_id=${categoryId}`;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return { products: [], nextPage: null };
    const data = await res.json();

    const items = data.products?.data || data.data || (Array.isArray(data) ? data : []);
    const nextPage = data.products?.next_page ?? null;
    return { products: Array.isArray(items) ? items : [], nextPage };
  } catch (error) {
    console.error('Failed to fetch admin products:', error);
    return { products: [], nextPage: null };
  }
}

// Fetch admin order details
export async function fetchOrderDetails(orderId: string | number): Promise<Order | null> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.order || data.data || data || null;
  } catch (error) {
    console.error('Failed to fetch order details:', error);
    return null;
  }
}

// Update order status
export async function updateOrderStatus(orderId: string | number, status: string) {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const cleanId = String(orderId).replace(/[^0-9]/g, '') || orderId;

    const res = await fetch(`${API_BASE_URL}/orders/${cleanId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'تعذر تحديث حالة الطلب على السيرفر');
    }
    return data;
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}

// Login
export async function loginCustomer(email: string, password: string, fcmToken?: string | null) {
  // Sanitize: reject fake/generated tokens
  const cleanToken = (fcmToken && !fcmToken.startsWith('fcm_') && !fcmToken.startsWith('fake_')) ? fcmToken : null;
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      fcm_token: cleanToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'بيانات الدخول غير صحيحة');
  }
  if (data.token) {
    setAuthToken(data.token);
  }
  if (data.user) {
    cachedUser = data.user;
    AsyncStorage.setItem('user_profile_v1', JSON.stringify(data.user)).catch(() => {});
  }
  DeviceEventEmitter.emit('auth_updated');
  return data;
}

// Register
export async function registerCustomer(
  name: string,
  phone: string,
  email: string,
  password: string,
  address: string,
  shopName?: string,
  latitude?: number | null,
  longitude?: number | null,
  fcmToken?: string | null,
  regionId?: number | null
) {
  // Sanitize: reject fake/generated tokens
  const cleanToken = (fcmToken && !fcmToken.startsWith('fcm_') && !fcmToken.startsWith('fake_')) ? fcmToken : null;
  const res = await fetch(`${API_BASE_URL}/auth/customer-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      name,
      phone,
      email,
      password,
      address,
      shop_name: shopName,
      latitude,
      longitude,
      fcm_token: cleanToken,
      region_id: regionId,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'فشل تسجيل الحساب الجديد');
  }
  if (data.token) {
    setAuthToken(data.token);
  }
  if (data.user) {
    cachedUser = data.user;
    AsyncStorage.setItem('user_profile_v1', JSON.stringify(data.user)).catch(() => {});
  }
  DeviceEventEmitter.emit('auth_updated');
  return data;
}

// Logout Customer (deletes FCM token on server & locally)
export async function logoutCustomer() {
  try {
    if (authToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });
    }
  } catch (e) {
  } finally {
    setAuthToken(null);
    cachedUser = null;
    await AsyncStorage.removeItem('user_profile_v1').catch(() => {});
    await clearActiveAppMode().catch(() => {});
    await clearFcmToken();
    DeviceEventEmitter.emit('auth_updated');
  }
}

// Update FCM token on server
export async function updateFcmTokenOnServer(fcmToken: string) {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return null;

    const res = await fetch(`${API_BASE_URL}/auth/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fcm_token: fcmToken }),
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Fetch user profile with balance & orders (/api/auth/me)
export async function fetchUserProfile(): Promise<User | null> {
  try {
    if (!authToken || !cachedUser) {
      await loadSavedAuthToken();
    }
    if (!authToken) {
      return cachedUser;
    }
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      const userObj = data.user || data.data || data || null;
      if (userObj) {
        cachedUser = userObj;
        AsyncStorage.setItem('user_profile_v1', JSON.stringify(userObj)).catch(() => {});
      }
      return userObj || cachedUser;
    } else if (res.status === 401) {
      // Don't auto-clear token — let the caller decide to log out
      return null;
    }
    return cachedUser;
  } catch (error) {
    return cachedUser;
  }
}

// Fetch full account data (user + balance + orders)
export async function fetchUserAccount(): Promise<UserAccountData | null> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return null;
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      const userObj = data.user || null;
      if (userObj) {
        cachedUser = userObj;
        AsyncStorage.setItem('user_profile_v1', JSON.stringify(userObj)).catch(() => {});
      }
      return {
        user: userObj,
        balance: data.balance ?? 0,
        total_debts: data.total_debts ?? 0,
        total_payments: data.total_payments ?? 0,
        orders: data.orders ?? [],
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export function isAdminOrSubAdmin(user?: User | null | any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase().trim();
  return ['admin', 'sub_admin', 'subadmin', 'sub-admin'].includes(role);
}

export interface UpdateProductPayload {
  name?: string;
  price?: number;
  cost_price?: number;
  stock?: number;
  unit?: string;
  number_of_items_in_unit?: number;
  category_id?: number;
  description?: string;
  is_available_on_app?: boolean;
  max_app_order_quantity?: number | null;
}

// Update product on server (supports all fields: name, price, stock, category, unit, etc.)
export async function updateProductOnServer(
  productId: number | string,
  data: UpdateProductPayload & Record<string, any>
): Promise<{ success: boolean; product?: Product; message?: string }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    const resData = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, product: resData.product, message: resData.message };
    }
    return { success: false, message: resData.message || 'فشل التحديث' };
  } catch (error) {
    console.error('Failed to update product:', error);
    return { success: false, message: 'حدث خطأ في الاتصال بالسيرفر' };
  }
}

export async function updateProfileOnServer(data: {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  shop_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  region_id?: number | null;
}) {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'فشل تحديث البيانات');
    }

    const json = await res.json();
    return json;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
}

// Customers Accounts Management
export interface CustomerAccount {
  id: number;
  name: string;
  phone?: string;
  shop_name?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  balance: number;
}

export interface CustomerAccountStats {
  total_customers: number;
  total_debts_on_customers: number;
  total_debts_for_customers: number;
  customers_with_debt: number;
}

export interface CustomerTransactionItem {
  id: number;
  amount: number;
  previous_balance?: number;
  new_balance?: number;
  description: string;
  date: string;
  is_payment: boolean;
  abs_amount: number;
  order_id?: number | null;
}

export async function fetchCustomersAccounts(
  search?: string,
  page: number = 1
): Promise<{ customers: CustomerAccount[]; stats?: CustomerAccountStats; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    let url = `${API_BASE_URL}/customers-accounts?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return { customers: [], nextPage: null };
    const data = await res.json();

    const items = data.customers?.data || data.data || [];
    const nextPage = data.customers?.next_page ?? null;
    return {
      customers: Array.isArray(items) ? items : [],
      stats: data.stats || undefined,
      nextPage,
    };
  } catch (error) {
    console.error('Failed to fetch customers accounts:', error);
    return { customers: [], nextPage: null };
  }
}

export async function fetchCustomerAccountDetails(
  customerId: string | number,
  page: number = 1
): Promise<{
  customer: CustomerAccount | null;
  balance: number;
  total_debts: number;
  total_payments: number;
  transactions: CustomerTransactionItem[];
  nextPage: number | null;
} | null> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/customers/${customerId}/account?page=${page}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();

    let rawTx: any[] = [];
    if (Array.isArray(data.transactions)) {
      rawTx = data.transactions;
    } else if (Array.isArray(data.transactions?.data)) {
      rawTx = data.transactions.data;
    } else if (Array.isArray(data.data)) {
      rawTx = data.data;
    }

    let nextPage = data.transactions?.next_page ?? null;

    // Fallback: If no transactions are returned from account API, fetch customer orders
    if (rawTx.length === 0) {
      try {
        const ordersRes = await fetch(`${API_BASE_URL}/customers/${customerId}/orders?page=${page}`, { headers });
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const ordList = ordersData.orders?.data || ordersData.data || (Array.isArray(ordersData.orders) ? ordersData.orders : []);
          if (Array.isArray(ordList) && ordList.length > 0) {
            rawTx = ordList.map((ord: any) => ({
              id: ord.id,
              amount: Number(ord.total_price || 0),
              description: `طلب ${ord.order_number || ('#ORD-' + String(ord.id).padStart(4, '0'))}`,
              date: ord.created_at || '—',
              is_payment: false,
              abs_amount: Number(ord.total_price || 0),
              order_id: ord.id,
            }));
            nextPage = ordersData.orders?.next_page ?? null;
          }
        }
      } catch (e) {
        // ignore fallback errors
      }
    }

    return {
      customer: data.customer || null,
      balance: data.balance ?? 0,
      total_debts: data.total_debts ?? 0,
      total_payments: data.total_payments ?? 0,
      transactions: Array.isArray(rawTx) ? rawTx : [],
      nextPage,
    };
  } catch (error) {
    console.error('Failed to fetch customer account details:', error);
    return null;
  }
}

export async function addCustomerTransaction(
  customerId: string | number,
  amount: number,
  description?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/customers/${customerId}/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount, description: description || null }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'حدث خطأ أثناء تسجيل المعاملة' };
    }
    return { success: true, message: data.message || 'تم تسجيل المعاملة بنجاح' };
  } catch (error: any) {
    console.error('Failed to add customer transaction:', error);
    return { success: false, message: error.message || 'تعذر الاتصال بالسيرفر' };
  }
}

export interface AppSettingsData {
  receipt_name: string;
  receipt_logo_url?: string;
  receipt_size?: string;
  phone1?: string;
  phone2?: string;
}

export async function fetchAppSettings(): Promise<AppSettingsData | null> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/settings`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.settings || null;
  } catch (error) {
    console.error('Failed to fetch app settings:', error);
    return null;
  }
}

// ── Settings Logo URL ──

const logoCacheBuster = Date.now();
export function getSettingsLogoUrl(): string {
  return `${API_BASE_URL}/settings-logo?t=${logoCacheBuster}`;
}

// ── Offers System ──

export interface ActiveOffer {
  id: number;
  product_id: number;
  offer_price: number;
  original_price: number;
  discount_percentage: number;
  expires_at: string;
  offer_max_quantity?: number | null;
  product?: Product | null;
}

export interface OfferItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image_url?: string | null;
  category_name: string;
  offer_price: number;
  original_price: number;
  discount_percentage: number;
  offer_max_quantity?: number | null;
  original_max_quantity?: number | null;
  expires_at: string;
  is_active: boolean;
  is_expired: boolean;
  is_currently_active: boolean;
  created_by_name: string;
  created_at: string;
  product?: Product | null;
}

export async function fetchActiveOffers(): Promise<OfferItem[]> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/offers/active`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.offers) ? data.offers : [];
  } catch (error) {
    console.error('Failed to fetch active offers:', error);
    return [];
  }
}

export async function fetchAllOffers(page: number = 1): Promise<{ offers: OfferItem[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/offers?page=${page}`, { headers });
    if (!res.ok) return { offers: [], nextPage: null };
    const data = await res.json();
    const items = data.offers?.data || [];
    const nextPage = data.offers?.next_page ?? null;
    return { offers: Array.isArray(items) ? items : [], nextPage };
  } catch (error) {
    console.error('Failed to fetch all offers:', error);
    return { offers: [], nextPage: null };
  }
}

export async function createOffer(payload: {
  product_id: number;
  offer_price: number;
  offer_max_quantity?: number | null;
  expires_at: string;
}): Promise<{ success: boolean; message: string; offer?: OfferItem }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/offers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'حدث خطأ أثناء إنشاء العرض' };
    }
    return { success: true, message: data.message || 'تم إضافة العرض بنجاح!', offer: data.offer };
  } catch (error: any) {
    console.error('Failed to create offer:', error);
    return { success: false, message: error.message || 'تعذر الاتصال بالسيرفر' };
  }
}

export async function deleteOffer(offerId: number): Promise<{ success: boolean; message: string }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/offers/${offerId}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'حدث خطأ' };
    }
    return { success: true, message: data.message || 'تم إلغاء العرض بنجاح!' };
  } catch (error: any) {
    console.error('Failed to delete offer:', error);
    return { success: false, message: error.message || 'تعذر الاتصال بالسيرفر' };
  }
}

// --- App Users (Admin View) ---

export interface AppUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  shop_name: string;
  address: string;
  region: string;
  latitude?: string;
  longitude?: string;
  created_at: string;
}

export interface AppUserProductItem {
  id: number;
  name: string;
  price: number;
  image_url: string;
  unit: string;
  quantity?: number; // Only present in Cart
}

export async function fetchAppUsers(
  page: number = 1,
  search?: string
): Promise<{ data: AppUser[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    let url = `${API_BASE_URL}/app-users?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return { data: [], nextPage: null };
    const resData = await res.json();

    const items = resData.users?.data || [];
    const nextPage = resData.users?.next_page ?? null;
    return { data: items, nextPage };
  } catch (error) {
    console.error('fetchAppUsers error:', error);
    return { data: [], nextPage: null };
  }
}

export async function fetchAppUserCart(
  userId: number,
  page: number = 1
): Promise<{ data: AppUserProductItem[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/app-users/${userId}/cart?page=${page}`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return { data: [], nextPage: null };
    const resData = await res.json();

    const items = resData.cart?.data || [];
    const nextPage = resData.cart?.next_page ?? null;
    return { data: items, nextPage };
  } catch (error) {
    console.error('fetchAppUserCart error:', error);
    return { data: [], nextPage: null };
  }
}

export async function fetchAppUserWishlist(
  userId: number,
  page: number = 1
): Promise<{ data: AppUserProductItem[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/app-users/${userId}/wishlist?page=${page}`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return { data: [], nextPage: null };
    const resData = await res.json();

    const items = resData.wishlist?.data || [];
    const nextPage = resData.wishlist?.next_page ?? null;
    return { data: items, nextPage };
  } catch (error) {
    console.error('fetchAppUserWishlist error:', error);
    return { data: [], nextPage: null };
  }
}

export async function deleteAppUserCartItem(userId: number, productId: number): Promise<{ success: boolean; message: string }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/app-users/${userId}/cart/${productId}`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { method: 'DELETE', headers });
    const data = await res.json();
    return { success: res.ok && data.success, message: data.message || 'Error deleting item' };
  } catch (error: any) {
    console.error('deleteAppUserCartItem error:', error);
    return { success: false, message: error.message || 'Connection error' };
  }
}

// Active Carts Types & API Functions
export interface ActiveCartUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  shop_name: string;
  address: string;
  region: string;
  region_id: number | null;
  category_of_place: string;
  registered_from_app: boolean;
}

export interface ActiveCartItem {
  id: number;
  name: string;
  price: number;
  original_price: number;
  has_offer: boolean;
  image_url: string | null;
  quantity: string | number;
  unit: string;
  subtotal: number;
}

export interface ActiveCartRegionLimits {
  region_name: string;
  min_order_total: number;
  min_products_count: number;
  remaining_total: number;
  remaining_products_count: number;
  is_limit_met: boolean;
  has_limits: boolean;
}

export interface ActiveCartEntry {
  user: ActiveCartUser;
  region_limits?: ActiveCartRegionLimits;
  last_added_date: string;
  items_count: number;
  total_quantity: number;
  total_price: number;
  items: ActiveCartItem[];
}

export async function fetchActiveCartsPaginated(
  page: number = 1,
  search?: string,
  regionId?: string | number,
  readyStatus?: string
): Promise<{
  carts: ActiveCartEntry[];
  nextPage: number | null;
  counts?: { all: number; ready: number; not_ready: number };
}> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const query = new URLSearchParams();
    query.append('page', String(page));
    if (search && search.trim()) query.append('search', search.trim());
    if (regionId && regionId !== 'all') query.append('region_id', String(regionId));
    if (readyStatus && readyStatus !== 'all') query.append('ready_status', readyStatus);

    const url = `${API_BASE_URL}/active-carts?${query.toString()}`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return { carts: [], nextPage: null, counts: { all: 0, ready: 0, not_ready: 0 } };
    const data = await res.json();
    const carts: ActiveCartEntry[] = data.active_carts?.data || [];
    const nextPage: number | null = data.active_carts?.next_page ?? null;
    const counts = data.counts || { all: carts.length, ready: 0, not_ready: 0 };

    // Check if any cart user is missing region or details
    const needsEnrichment = carts.some(
      (c) => !c.user?.region || c.user.region === '—' || c.user.region === 'غير محددة' || !c.user?.region_id
    );

    if (needsEnrichment && carts.length > 0) {
      try {
        const [appUsersRes, customersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/app-users?per_page=100`, { headers }).catch(() => null),
          fetch(`${API_BASE_URL}/customers?per_page=100&source=all`, { headers }).catch(() => null),
        ]);

        const userMetaMap = new Map<number, { region?: string; region_id?: number; address?: string; shop_name?: string }>();

        if (appUsersRes && appUsersRes.ok) {
          const auData = await appUsersRes.json();
          const auList = auData.users?.data || [];
          auList.forEach((u: any) => {
            if (u.id) {
              userMetaMap.set(Number(u.id), {
                region: u.region && u.region !== '—' ? u.region : undefined,
                address: u.address && u.address !== '—' ? u.address : undefined,
                shop_name: u.shop_name && u.shop_name !== '—' ? u.shop_name : undefined,
              });
            }
          });
        }

        if (customersRes && customersRes.ok) {
          const cData = await customersRes.json();
          const cList = cData.customers?.data || [];
          cList.forEach((u: any) => {
            if (u.id) {
              const existing = userMetaMap.get(Number(u.id)) || {};
              userMetaMap.set(Number(u.id), {
                region: u.region && u.region !== '—' ? u.region : existing.region,
                region_id: u.region_id || existing.region_id,
                address: u.address && u.address !== '—' ? u.address : existing.address,
                shop_name: u.shop_name && u.shop_name !== '—' ? u.shop_name : existing.shop_name,
              });
            }
          });
        }

        // Apply metadata to carts
        carts.forEach((c) => {
          const meta = userMetaMap.get(Number(c.user.id));
          if (meta) {
            if (!c.user.region || c.user.region === '—' || c.user.region === 'غير محددة') {
              c.user.region = meta.region || c.user.region;
            }
            if (!c.user.region_id && meta.region_id) {
              c.user.region_id = meta.region_id;
            }
            if (!c.user.address || c.user.address === '—') {
              c.user.address = meta.address || c.user.address;
            }
            if (!c.user.shop_name || c.user.shop_name === '—') {
              c.user.shop_name = meta.shop_name || c.user.shop_name;
            }
          }
        });

        // Second pass: for any cart that STILL has no region, do a targeted search by customer phone or name
        const unresolvedCarts = carts.filter(
          (c) => !c.user.region || c.user.region === '—' || c.user.region === 'غير محددة'
        );

        if (unresolvedCarts.length > 0) {
          await Promise.all(
            unresolvedCarts.map(async (c) => {
              try {
                const queryStr = (c.user.phone && c.user.phone !== '—') ? c.user.phone : c.user.name;
                if (!queryStr) return;
                const custSearchRes = await fetch(`${API_BASE_URL}/customers?search=${encodeURIComponent(queryStr.trim())}`, { headers });
                if (custSearchRes.ok) {
                  const searchData = await custSearchRes.json();
                  const found = (searchData.customers?.data || []).find((u: any) => Number(u.id) === Number(c.user.id)) || searchData.customers?.data?.[0];
                  if (found) {
                    if (found.region && found.region !== '—') c.user.region = found.region;
                    if (found.region_id) c.user.region_id = found.region_id;
                    if (found.address && found.address !== '—') c.user.address = found.address;
                    if (found.shop_name && found.shop_name !== '—') c.user.shop_name = found.shop_name;
                  }
                }
              } catch (e) {}
            })
          );
        }

        // Third pass: if customer address or shop_name mentions a known region (e.g. البيطاش, الهانوفيل)
        const regionsRes = await fetch(`${API_BASE_URL}/regions`, { headers }).catch(() => null);
        if (regionsRes && regionsRes.ok) {
          const regJson = await regionsRes.json();
          const regionList: Region[] = Array.isArray(regJson.data) ? regJson.data : [];
          carts.forEach((c) => {
            if (!c.user.region || c.user.region === '—' || c.user.region === 'غير محددة') {
              const fullText = `${c.user.address || ''} ${c.user.shop_name || ''} ${c.user.name || ''}`;
              const matched = regionList.find((r) => r.name && fullText.includes(r.name));
              if (matched) {
                c.user.region = matched.name;
                c.user.region_id = matched.id;
              }
            }
          });
        }
      } catch (e) {
        console.warn('Enrichment error in fetchActiveCartsPaginated:', e);
      }
    }

    return { carts, nextPage, counts };
  } catch (error) {
    console.error('fetchActiveCartsPaginated error:', error);
    return { carts: [], nextPage: null, counts: { all: 0, ready: 0, not_ready: 0 } };
  }
}

export async function fetchActiveCarts(
  search?: string,
  regionId?: string | number,
  readyStatus?: string
): Promise<ActiveCartEntry[]> {
  const res = await fetchActiveCartsPaginated(1, search, regionId, readyStatus);
  return res.carts;
}

export async function updateActiveCartItemQty(
  userId: number,
  productId: number,
  payload: { quantity?: number; delta?: number }
): Promise<{ success: boolean; message: string; quantity?: number }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/app-users/${userId}/cart/${productId}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
      success: res.ok && data.success,
      message: data.message || (res.ok ? 'تم التحديث بنجاح' : 'فشل التحديث'),
      quantity: data.quantity,
    };
  } catch (error: any) {
    console.error('updateActiveCartItemQty error:', error);
    return { success: false, message: error.message || 'خطأ في الاتصال' };
  }
}

export async function clearActiveCart(userId: number): Promise<{ success: boolean; message: string }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/app-users/${userId}/cart`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { method: 'DELETE', headers });
    const data = await res.json();
    return { success: res.ok && data.success, message: data.message || 'تم تفريغ السلة بنجاح' };
  } catch (error: any) {
    console.error('clearActiveCart error:', error);
    return { success: false, message: error.message || 'خطأ في الاتصال' };
  }
}

export async function checkoutActiveCart(userId: number): Promise<{ success: boolean; message: string; order_id?: number }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/app-users/${userId}/cart/checkout`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { method: 'POST', headers });
    const data = await res.json();
    return {
      success: res.ok && data.success,
      message: data.message || (res.ok ? 'تم إتمام الطلب بنجاح' : 'فشل إتمام الطلب'),
      order_id: data.order_id,
    };
  } catch (error: any) {
    console.error('checkoutActiveCart error:', error);
    return { success: false, message: error.message || 'خطأ في الاتصال' };
  }
}

export async function searchProductsForCart(search: string): Promise<Product[]> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const url = `${API_BASE_URL}/products?search=${encodeURIComponent(search)}`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products?.data || [];
  } catch (error) {
    console.error('searchProductsForCart error:', error);
    return [];
  }
}

// ── Notifications System ──

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(
  page: number = 1
): Promise<{ notifications: AppNotification[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return { notifications: [], nextPage: null };

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/notifications?page=${page}`, { headers });
    if (!res.ok) return { notifications: [], nextPage: null };
    const data = await res.json();

    const items = data.notifications?.data || [];
    const nextPage = data.notifications?.next_page ?? null;
    return { notifications: items, nextPage };
  } catch (error) {
    console.error('fetchNotifications error:', error);
    return { notifications: [], nextPage: null };
  }
}

export async function fetchUnreadNotificationsCount(): Promise<number> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return 0;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, { headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.unread_count) || 0;
  } catch (error) {
    return 0;
  }
}

export async function markNotificationAsRead(id: number | string): Promise<boolean> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return false;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'POST',
      headers,
    });
    DeviceEventEmitter.emit('notification_read', { id });
    return res.ok;
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    return false;
  }
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return false;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers,
    });
    DeviceEventEmitter.emit('all_notifications_read');
    return res.ok;
  } catch (error) {
    console.error('markAllNotificationsAsRead error:', error);
    return false;
  }
}

export async function sendAdminNotification(payload: {
  title: string;
  body: string;
  user_id?: number | null;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return { success: false, message: 'غير مسجل دخول' };

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    };

    const res = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return {
      success: res.ok && data.success,
      message: data.message || (res.ok ? 'تم إرسال الإشعار بنجاح' : 'فشل إرسال الإشعار'),
    };
  } catch (error: any) {
    console.error('sendAdminNotification error:', error);
    return { success: false, message: error.message || 'خطأ في الاتصال' };
  }
}

export async function searchUsersForNotification(search: string = ''): Promise<{
  id: number;
  name: string;
  email: string;
  phone?: string;
  shop_name?: string;
}[]> {
  try {
    if (!authToken) await loadSavedAuthToken();
    if (!authToken) return [];

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    };

    const cleanSearch = (search || '').trim();
    const queryParam = cleanSearch ? `?search=${encodeURIComponent(cleanSearch)}` : '';

    // 1. Primary: Exact system notification search endpoint (/notifications/search-users)
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/search-users${queryParam}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const users = data.users || [];
        if (Array.isArray(users) && users.length > 0) {
          return users.map((u: any) => ({
            id: Number(u.id),
            name: u.name || '',
            email: u.email && u.email !== '—' ? u.email : '',
            phone: (u.phone && u.phone !== '—') ? u.phone : ((u.phone_number && u.phone_number !== '—') ? u.phone_number : ''),
            shop_name: u.shop_name && u.shop_name !== '—' ? u.shop_name : '',
          }));
        }
      }
    } catch (e) {
      console.warn('notifications/search-users fetch error, trying fallbacks', e);
    }

    // 2. Secondary: Fallback to app-users and customers-accounts
    const userMap = new Map<number, { id: number; name: string; email: string; phone?: string; shop_name?: string }>();

    try {
      const [appUsersRes, custAccountsRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/app-users?page=1${cleanSearch ? `&search=${encodeURIComponent(cleanSearch)}` : ''}`, { headers }),
        fetch(`${API_BASE_URL}/customers-accounts?page=1${cleanSearch ? `&search=${encodeURIComponent(cleanSearch)}` : ''}`, { headers }),
      ]);

      if (appUsersRes.status === 'fulfilled' && appUsersRes.value.ok) {
        const data = await appUsersRes.value.json();
        const list = data.users?.data || data.users || [];
        if (Array.isArray(list)) {
          list.forEach((u: any) => {
            if (u.id) {
              userMap.set(Number(u.id), {
                id: Number(u.id),
                name: u.name || '',
                email: u.email && u.email !== '—' ? u.email : '',
                phone: (u.phone && u.phone !== '—') ? u.phone : '',
                shop_name: u.shop_name && u.shop_name !== '—' ? u.shop_name : '',
              });
            }
          });
        }
      }

      if (custAccountsRes.status === 'fulfilled' && custAccountsRes.value.ok) {
        const data = await custAccountsRes.value.json();
        const list = data.customers?.data || data.customers || [];
        if (Array.isArray(list)) {
          list.forEach((u: any) => {
            if (u.id && !userMap.has(Number(u.id))) {
              userMap.set(Number(u.id), {
                id: Number(u.id),
                name: u.name || '',
                email: u.email && u.email !== '—' ? u.email : '',
                phone: (u.phone && u.phone !== '—') ? u.phone : '',
                shop_name: u.shop_name && u.shop_name !== '—' ? u.shop_name : '',
              });
            }
          });
        }
      }
    } catch (fallbackErr) {
      console.warn('Fallback search error:', fallbackErr);
    }

    return Array.from(userMap.values());
  } catch (error) {
    console.error('searchUsersForNotification error:', error);
    return [];
  }
}

