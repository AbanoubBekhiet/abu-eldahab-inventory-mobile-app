import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  AppNotification,
} from '../services/api';
import Toast from 'react-native-toast-message';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);

  const loadInitialNotifications = useCallback(async () => {
    try {
      const res = await fetchNotifications(1);
      setNotifications(res.notifications);
      setNextPage(res.nextPage);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInitialNotifications();
  }, [loadInitialNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInitialNotifications();
  };

  const loadMore = async () => {
    if (!nextPage || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await fetchNotifications(nextPage);
      if (res.notifications.length > 0) {
        setNotifications((prev) => [...prev, ...res.notifications]);
      }
      setNextPage(res.nextPage);
    } catch (e) {
      console.error('Failed to load more notifications:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleNotificationPress = async (item: AppNotification) => {
    if (!item.is_read) {
      // Optimistic mark as read
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      await markNotificationAsRead(item.id);
    }

    // Navigate if has deep-link target
    if (item.data?.type === 'new_offer') {
      router.push('/offers');
    } else if (item.data?.type === 'order_status_updated') {
      router.push('/orders-history');
    }
  };

  const handleMarkAllRead = async () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    if (unreadCount === 0) return;

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const ok = await markAllNotificationsAsRead();
    if (ok) {
      Toast.show({
        type: 'success',
        text1: 'الإشعارات',
        text2: 'تم تحديد جميع الإشعارات كمقروءة',
      });
    }
  };

  const formatTimestamp = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays === 1) return 'أمس';
      if (diffDays < 7) return `منذ ${diffDays} أيام`;

      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderItem = ({ item }: { item: AppNotification }) => {
    const isUnread = !item.is_read;

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          isUnread && styles.unreadCard,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardRight}>
            <View
              style={[
                styles.iconCircle,
                isUnread ? styles.unreadIconCircle : styles.readIconCircle,
              ]}
            >
              <MaterialIcons
                name={
                  item.type === 'offer'
                    ? 'local-offer'
                    : item.type === 'order'
                    ? 'receipt'
                    : 'notifications'
                }
                size={20}
                color={isUnread ? '#2E5A44' : '#7C7870'}
              />
            </View>
            <View style={styles.cardTitleBox}>
              <View style={styles.titleRow}>
                {isUnread && <View style={styles.unreadDot} />}
                <Text
                  style={[
                    styles.notificationTitle,
                    isUnread && styles.unreadTitle,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
              </View>
              <Text style={styles.notificationTime}>
                {formatTimestamp(item.created_at)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.notificationBody}>{item.body}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-forward-ios" size={18} color="#1A2D23" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>الإشعارات</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} جديد</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <MaterialIcons name="done-all" size={16} color="#2E5A44" />
            <Text style={styles.markAllText}>قراءة الكل</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E5A44" />
          <Text style={styles.loadingText}>جاري تحميل الإشعارات...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <MaterialIcons name="notifications-none" size={48} color="#9A978F" />
          </View>
          <Text style={styles.emptyTitle}>لا توجد إشعارات حتى الآن</Text>
          <Text style={styles.emptySubtitle}>
            ستصلك هنا كافة التنبيهات والعروض الخاصة والرسائل المهمة
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2E5A44']}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#2E5A44" />
              </View>
            ) : null
          }
        />
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE8E2',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F4F3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  unreadBadge: {
    backgroundColor: '#EEF4F1',
    borderColor: '#D0E2D8',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  markAllButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EEF4F1',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  unreadCard: {
    backgroundColor: '#F7FAF8',
    borderColor: '#C6DDD1',
    borderWidth: 1.5,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadIconCircle: {
    backgroundColor: '#EEF4F1',
    borderWidth: 1,
    borderColor: '#D0E2D8',
  },
  readIconCircle: {
    backgroundColor: '#F4F3EF',
  },
  cardTitleBox: {
    flex: 1,
    alignItems: 'flex-end',
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E5A44',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2D23',
    textAlign: 'right',
  },
  unreadTitle: {
    fontWeight: 'bold',
    color: '#1E3E2B',
  },
  notificationTime: {
    fontSize: 11,
    color: '#9A978F',
    marginTop: 2,
    textAlign: 'right',
  },
  notificationBody: {
    fontSize: 13,
    color: '#5C5950',
    lineHeight: 20,
    textAlign: 'right',
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7C7870',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A2D23',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#7C7870',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
