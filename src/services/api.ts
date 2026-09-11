import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearFcmToken } from './fcm';

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
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus | string, string> = {
  [OrderStatus.PENDING]: 'قيد الانتظار',
  [OrderStatus.CONFIRMED]: 'تم التأكيد',
  [OrderStatus.SHIPPED]: 'تم الشحن',
  [OrderStatus.DELIVERED]: 'تم التوصيل',
  [OrderStatus.COMPLETED]: 'مكتمل',
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
const CART_STORAGE_KEY = 'user_shopping_cart_v1';

export async function getCartItems(): Promise<CartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items)
      ? items.map((i) => ({
          ...i,
          id: Number(i.id || i.product_id),
          product_id: Number(i.product_id || i.id),
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
        }))
      : [];
  } catch (e) {
    return [];
  }
}

export async function saveCartItems(items: CartItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {}
}

export async function addProductToCart(product: Product, quantity = 1): Promise<CartItem[]> {
  const current = await getCartItems();
  const pId = Number(product.id);
  const existingIndex = current.findIndex((item) => Number(item.product_id || item.id) === pId);

  if (existingIndex > -1) {
    const existing = current[existingIndex];
    let newQty = existing.quantity + quantity;
    const maxLimit = existing.max_app_order_quantity;
    const maxLimitNum = Number(maxLimit);
    if (maxLimit !== null && maxLimit !== undefined && !isNaN(maxLimitNum) && maxLimitNum > 0) {
      if (newQty > maxLimitNum) {
        newQty = maxLimitNum;
      }
    }
    current[existingIndex] = { ...existing, quantity: newQty };
  } else {
    current.push({
      id: pId,
      product_id: pId,
      name: product.name,
      price: Number(product.price) || 0,
      quantity,
      image_url: product.image_url,
      category_name: product.category_name,
      max_app_order_quantity: product.max_app_order_quantity,
    });
  }

  await saveCartItems(current);
  return current;
}

export async function updateCartItemQty(productId: number | string, delta: number): Promise<CartItem[]> {
  const current = await getCartItems();
  const pId = Number(productId);
  const updated = current
    .map((item) => {
      if (Number(item.product_id || item.id) === pId) {
        let newQty = item.quantity + delta;
        const maxLimit = item.max_app_order_quantity;
        const maxLimitNum = Number(maxLimit);
        if (delta > 0 && maxLimit !== null && maxLimit !== undefined && !isNaN(maxLimitNum) && maxLimitNum > 0) {
          if (newQty > maxLimitNum) {
            newQty = maxLimitNum;
          }
        }
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    })
    .filter(Boolean) as CartItem[];

  await saveCartItems(updated);
  return updated;
}

export async function removeCartItem(productId: number | string): Promise<CartItem[]> {
  const current = await getCartItems();
  const pId = Number(productId);
  const updated = current.filter((item) => Number(item.product_id || item.id) !== pId);
  await saveCartItems(updated);
  return updated;
}

export async function clearCart(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CART_STORAGE_KEY);
  } catch (e) {}
}

// Favorites Management via AsyncStorage
const FAVORITES_STORAGE_KEY = 'user_favorite_products_v1';

export async function getFavoriteIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.map((id) => Number(id)).filter((id) => !isNaN(id)) : [];
  } catch (e) {
    return [];
  }
}

export async function toggleFavoriteId(productId: number | string): Promise<number[]> {
  try {
    const pId = Number(productId);
    if (isNaN(pId)) return await getFavoriteIds();

    const current = await getFavoriteIds();
    let updated: number[];
    if (current.includes(pId)) {
      updated = current.filter((id) => id !== pId);
    } else {
      updated = [...current, pId];
    }
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return [];
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
    return await res.json();
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
export async function fetchAdminOrdersPaginated(page: number = 1): Promise<{ orders: Order[]; nextPage: number | null }> {
  try {
    if (!authToken) await loadSavedAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}/orders?page=${page}`, { headers });
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
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      fcm_token: fcmToken || null,
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
      fcm_token: fcmToken,
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
    await clearFcmToken();
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
  const role = String(user.role || '').toLowerCase();
  return ['admin', 'sub_admin'].includes(role);
}

// Update product price or availability on server
export async function updateProductOnServer(
  productId: number | string,
  data: { price?: number; is_available_on_app?: boolean }
): Promise<boolean> {
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
    return res.ok;
  } catch (error) {
    console.error('Failed to update product:', error);
    return false;
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

