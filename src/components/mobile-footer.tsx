import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function MobileFooterNav({ cartCount = 0, wishlistCount = 0, isAdmin = false }) {
  const router = useRouter();
  const pathname = usePathname();

  const isAdminRoute = isAdmin || pathname.startsWith('/admin');

  interface NavItem {
    key: string;
    label: string;
    icon: string;
    path: string;
    badge?: number;
  }

  const customerNavItems: NavItem[] = [
    { key: 'home', label: 'الرئيسية', icon: 'home', path: '/' },
    { key: 'shop', label: 'المتجر', icon: 'category', path: '/explore' },
    { key: 'offers', label: 'العروض', icon: 'local-offer', path: '/offers' },
    { key: 'wishlist', label: 'المفضلة', icon: 'favorite', path: '/wishlist', badge: wishlistCount },
    { key: 'cart', label: 'السلة', icon: 'shopping-cart', path: '/cart', badge: cartCount },
    { key: 'profile', label: 'حسابي', icon: 'person', path: '/profile' },
  ];

  const adminNavItems: NavItem[] = [
    { key: 'admin-orders', label: 'الطلبات', icon: 'receipt-long', path: '/admin' },
    { key: 'admin-products', label: 'المنتجات', icon: 'inventory', path: '/admin/products' },
    { key: 'admin-offers', label: 'العروض', icon: 'local-offer', path: '/admin/offers' },
    { key: 'admin-customers', label: 'الحسابات', icon: 'account-balance-wallet', path: '/admin/customers' },
    { key: 'admin-app-users', label: 'المستخدمين', icon: 'people', path: '/admin/app-users' },
  ];

  const navItems = isAdminRoute ? adminNavItems : customerNavItems;

  return (
    <View style={styles.footerContainer}>
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path === '/' && pathname === '/index');
        const iconColor = isActive ? '#2D3C1F' : '#75786E';

        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.navButton, isActive && styles.navButtonActive]}
            onPress={() => router.push(item.path as any)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <MaterialIcons name={item.icon as any} size={22} color={iconColor} />
              {item.badge && item.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFF8F1', // Stitch organic warm background
    borderTopWidth: 1,
    borderTopColor: '#EAE1D5',
    paddingVertical: 8,
    paddingHorizontal: 8,
    elevation: 8,
    shadowColor: '#1F1B13',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 60,
  },
  navButtonActive: {
    backgroundColor: '#D4EAB7', // Stitch sage green active pill
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#BA1A1A', // Stitch red badge
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#75786E',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#2D3C1F', // Stitch primary forest green
    fontWeight: 'bold',
  },
});
