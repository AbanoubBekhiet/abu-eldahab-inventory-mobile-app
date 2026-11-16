import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchUserProfile,
  fetchPendingOrdersCount,
  fetchActiveCarts,
  logoutCustomer,
  User,
} from '../../services/api';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import MobileFooterNav from '../../components/mobile-footer';

export default function AdminHubScreen() {
  useRoleGuard('admin');
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pendingOrders, setPendingOrders] = useState<number>(0);
  const [activeCartsCount, setActiveCartsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [userProfile, ordersCount, carts] = await Promise.all([
        fetchUserProfile(),
        fetchPendingOrdersCount(),
        fetchActiveCarts(),
      ]);
      if (userProfile) setUser(userProfile);
      setPendingOrders(ordersCount || 0);
      setActiveCartsCount(Array.isArray(carts) ? carts.length : 0);
    } catch (e) {
      console.warn('Admin Dashboard Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج؟', [
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

  const navLinks = [
    {
      id: 'active-carts',
      title: 'السلال النشطة',
      subtitle: 'متابعة سلال العملاء وتعديل الكميات وإتمام الطلب',
      icon: 'shopping-cart',
      route: '/admin/active-carts',
      badge: activeCartsCount > 0 ? `${activeCartsCount} سلة` : undefined,
      color: '#2E5A44',
      bgColor: '#EEF4F1',
      borderColor: '#D0E2D8',
    },
    {
      id: 'orders',
      title: 'إدارة الطلبات',
      subtitle: 'استعراض الطلبات، متابعة الحالات، وتفاصيل الفواتير',
      icon: 'receipt-long',
      route: '/admin/orders',
      badge: pendingOrders > 0 ? `${pendingOrders} قيد الانتظار` : undefined,
      color: '#B45309',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
    },
    {
      id: 'products',
      title: 'إدارة المنتجات',
      subtitle: 'تعديل أسعار المنتجات والمخزون وحالة التوفر',
      icon: 'inventory',
      route: '/admin/products',
      color: '#1D4ED8',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
    },
    {
      id: 'offers',
      title: 'العروض والخصومات',
      subtitle: 'إضافة العروض الحصرية وتحديد فترات التخفيض',
      icon: 'local-offer',
      route: '/admin/offers',
      color: '#7C3AED',
      bgColor: '#F5F3FF',
      borderColor: '#DDD6FE',
    },
    {
      id: 'customers',
      title: 'حسابات العملاء والديون',
      subtitle: 'كشوف الحسابات، تحصيل الديون، وتسجيل الدفعات',
      icon: 'account-balance-wallet',
      route: '/admin/customers',
      color: '#047857',
      bgColor: '#ECFDF5',
      borderColor: '#A7F3D0',
    },
    {
      id: 'app-users',
      title: 'مستخدمو التطبيق',
      subtitle: 'سجل العملاء المسجلين والتحكم في صلاحياتهم',
      icon: 'people',
      route: '/admin/app-users',
      color: '#4338CA',
      bgColor: '#EEF2FF',
      borderColor: '#C7D2FE',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#BA1A1A" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>لوحة التحكم الرئيسية</Text>
          <Text style={styles.headerSubtitle}>
            {user?.name ? `مرحباً، ${user.name}` : 'إدارة متجر أبو الدهب'}
          </Text>
        </View>
        <View style={styles.adminBadge}>
          <MaterialIcons name="admin-panel-settings" size={20} color="#2E5A44" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E5A44']} />
        }
      >
        {/* Quick Stats Overview */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={[styles.statBox, { borderColor: '#D0E2D8', backgroundColor: '#EEF4F1' }]}
            onPress={() => router.push('/admin/active-carts')}
            activeOpacity={0.8}
          >
            <View style={styles.statIconBox}>
              <MaterialIcons name="shopping-cart" size={22} color="#2E5A44" />
            </View>
            <Text style={styles.statNumber}>{activeCartsCount}</Text>
            <Text style={styles.statLabel}>سلال نشطة حالياً</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statBox, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}
            onPress={() => router.push('/admin/orders')}
            activeOpacity={0.8}
          >
            <View style={styles.statIconBox}>
              <MaterialIcons name="pending-actions" size={22} color="#B45309" />
            </View>
            <Text style={[styles.statNumber, { color: '#B45309' }]}>{pendingOrders}</Text>
            <Text style={styles.statLabel}>طلبات قيد الانتظار</Text>
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <MaterialIcons name="dashboard" size={18} color="#2E5A44" />
          <Text style={styles.sectionTitle}>أقسام لوحة التحكم</Text>
        </View>

        {/* Navigation Cards Grid */}
        <View style={styles.gridContainer}>
          {navLinks.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navCard,
                { backgroundColor: '#FFFFFF', borderColor: '#EAE1D5' },
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={styles.navCardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: item.bgColor, borderColor: item.borderColor }]}>
                  <MaterialIcons name={item.icon as any} size={24} color={item.color} />
                </View>
                <MaterialIcons name="arrow-back-ios" size={14} color="#9A978F" style={{ transform: [{ rotate: '180deg' }] }} />
              </View>

              <View style={styles.navCardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.navCardTitle}>{item.title}</Text>
                  {item.badge && (
                    <View style={[styles.badgePill, { backgroundColor: item.bgColor, borderColor: item.borderColor }]}>
                      <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.navCardSubtitle}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <MobileFooterNav isAdmin />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE8E2',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7C7870',
    marginTop: 2,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FDEEEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconBox: {
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  statLabel: {
    fontSize: 11,
    color: '#7C7870',
    marginTop: 2,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  gridContainer: {
    gap: 12,
  },
  navCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  navCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardContent: {
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  navCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A2D23',
    textAlign: 'right',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  navCardSubtitle: {
    fontSize: 12,
    color: '#7C7870',
    lineHeight: 18,
    textAlign: 'right',
  },
});
