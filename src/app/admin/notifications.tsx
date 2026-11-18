import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  sendAdminNotification,
  searchUsersForNotification,
} from '../../services/api';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Toast from 'react-native-toast-message';

interface UserSearchResult {
  id: number;
  name: string;
  email: string;
  phone?: string;
  shop_name?: string;
}

export default function AdminNotificationsScreen() {
  useRoleGuard('admin');
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const searchTimeoutRef = React.useRef<any>(null);

  // Normalization helper
  const normalizeArabic = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '')
      .toLowerCase()
      .trim();
  };

  const fetchUsers = useCallback(async (query: string = '', isInitial: boolean = false) => {
    if (isInitial) {
      setInitialLoading(true);
    } else {
      setIsSearching(true);
    }
    try {
      const results = await searchUsersForNotification(query.trim());
      if (isInitial || !query.trim()) {
        setAllUsers(results);
      }
      setSearchResults(results);
    } catch (e) {
      console.error('Search users error:', e);
    } finally {
      setInitialLoading(false);
      setIsSearching(false);
    }
  }, []);

  // Pre-load users on screen mount
  useEffect(() => {
    fetchUsers('', true);
  }, [fetchUsers]);

  const handleSearchUsers = (query: string) => {
    setSearchQuery(query);

    // 1. Instant local client-side filter
    if (!query.trim()) {
      setSearchResults(allUsers);
    } else {
      const qNorm = normalizeArabic(query);
      const cleanDigits = query.replace(/[^0-9]/g, '');
      const filtered = allUsers.filter((u) => {
        const nameNorm = normalizeArabic(u.name || '');
        const shopNorm = normalizeArabic(u.shop_name || '');
        const phoneDigits = (u.phone || '').replace(/[^0-9]/g, '');
        const emailNorm = (u.email || '').toLowerCase();

        return (
          nameNorm.includes(qNorm) ||
          shopNorm.includes(qNorm) ||
          (cleanDigits.length > 0 && phoneDigits.includes(cleanDigits)) ||
          emailNorm.includes(query.toLowerCase().trim())
        );
      });
      setSearchResults(filtered);
    }

    // 2. Debounced server query (same as web system)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(async () => {
      if (query.trim().length > 0) {
        setIsSearching(true);
        try {
          const serverResults = await searchUsersForNotification(query.trim());
          if (serverResults.length > 0) {
            // Merge with local results
            const map = new Map<number, UserSearchResult>();
            searchResults.forEach((u) => map.set(u.id, u));
            serverResults.forEach((u) => map.set(u.id, u));
            setSearchResults(Array.from(map.values()));
          }
        } catch (e) {
          console.error('Server search error:', e);
        } finally {
          setIsSearching(false);
        }
      }
    }, 250);
  };

  const handleSelectSpecificTarget = () => {
    setTargetType('specific');
    if (allUsers.length === 0) {
      fetchUsers('', true);
    } else {
      setSearchResults(allUsers);
    }
  };

  const handleClearSelectedUser = () => {
    setSelectedUser(null);
    setSearchQuery('');
    setSearchResults(allUsers);
  };

  useEffect(() => {
    if (targetType === 'specific' && allUsers.length === 0) {
      fetchUsers('', true);
    }
  }, [targetType, allUsers.length, fetchUsers]);

  const handleSend = () => {
    if (!title.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان الإشعار');
      return;
    }
    if (!body.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال نص الرسالة');
      return;
    }
    if (targetType === 'specific' && !selectedUser) {
      Alert.alert('تنبيه', 'يرجى اختيار العميل المستهدف');
      return;
    }

    const targetDesc =
      targetType === 'all'
        ? 'جميع عملاء التطبيق'
        : `العميل: ${selectedUser?.name}`;

    Alert.alert(
      'تأكيد إرسال الإشعار',
      `هل أنت متأكد من إرسال هذا الإشعار إلى ${targetDesc}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إرسال الآن 🚀',
          style: 'default',
          onPress: async () => {
            setSending(true);
            try {
              const res = await sendAdminNotification({
                title: title.trim(),
                body: body.trim(),
                user_id: targetType === 'specific' ? selectedUser?.id : null,
              });

              if (res.success) {
                Toast.show({
                  type: 'success',
                  text1: 'تم الإرسال',
                  text2: res.message,
                });
                setTitle('');
                setBody('');
                setSelectedUser(null);
                setSearchQuery('');
                setSearchResults([]);
                setTargetType('all');
              } else {
                Alert.alert('خطأ', res.message || 'فشل إرسال الإشعار');
              }
            } catch (e: any) {
              Alert.alert('خطأ', e.message || 'حدث خطأ أثناء الإرسال');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-forward-ios" size={18} color="#1A2D23" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>إرسال إشعار فوري</Text>
          <Text style={styles.headerSubtitle}>تنبيه العملاء برسائل وعروض فورية</Text>
        </View>
        <View style={styles.bellBadge}>
          <MaterialIcons name="send" size={20} color="#2E5A44" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Target Audience Selector */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>الفئة المستهدفة للإشعار</Text>
            <View style={styles.targetTabs}>
              <TouchableOpacity
                style={[
                  styles.targetTab,
                  targetType === 'all' && styles.targetTabActive,
                ]}
                onPress={() => {
                  setTargetType('all');
                  setSelectedUser(null);
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="groups"
                  size={20}
                  color={targetType === 'all' ? '#2E5A44' : '#7C7870'}
                />
                <Text
                  style={[
                    styles.targetTabText,
                    targetType === 'all' && styles.targetTabTextActive,
                  ]}
                >
                  جميع العملاء
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.targetTab,
                  targetType === 'specific' && styles.targetTabActive,
                ]}
                onPress={handleSelectSpecificTarget}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="person"
                  size={20}
                  color={targetType === 'specific' ? '#2E5A44' : '#7C7870'}
                />
                <Text
                  style={[
                    styles.targetTabText,
                    targetType === 'specific' && styles.targetTabTextActive,
                  ]}
                >
                  عميل محدد
                </Text>
              </TouchableOpacity>
            </View>

            {/* If specific user, show user search & select */}
            {targetType === 'specific' && (
              <View style={styles.userSelectBox}>
                {selectedUser ? (
                  <View style={styles.selectedUserCard}>
                    <View style={styles.selectedUserInfo}>
                      <Text style={styles.selectedUserName}>{selectedUser.name}</Text>
                      <Text style={styles.selectedUserSub}>
                        {selectedUser.phone || selectedUser.email || 'بدون هاتف'}
                        {selectedUser.shop_name ? ` • ${selectedUser.shop_name}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleClearSelectedUser}
                      style={styles.changeUserBtn}
                    >
                      <Text style={styles.changeUserBtnText}>تغيير</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <View style={styles.searchBox}>
                      <MaterialIcons name="search" size={20} color="#2E5A44" />
                      <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={handleSearchUsers}
                        placeholder="البحث بالاسم أو رقم الهاتف أو المحل..."
                        placeholderTextColor="#9A978F"
                      />
                      {isSearching ? (
                        <ActivityIndicator size="small" color="#2E5A44" />
                      ) : searchQuery.length > 0 ? (
                        <TouchableOpacity
                          onPress={() => {
                            setSearchQuery('');
                            setSearchResults(allUsers);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialIcons name="cancel" size={18} color="#9A978F" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Results / Status */}
                    {initialLoading ? (
                      <View style={styles.searchStatusBox}>
                        <ActivityIndicator size="small" color="#2E5A44" />
                        <Text style={styles.searchStatusText}>جاري تحميل قائمة العملاء...</Text>
                      </View>
                    ) : isSearching && searchResults.length === 0 ? (
                      <View style={styles.searchStatusBox}>
                        <ActivityIndicator size="small" color="#2E5A44" />
                        <Text style={styles.searchStatusText}>جاري البحث عن العملاء...</Text>
                      </View>
                    ) : searchResults.length > 0 ? (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.resultsHeaderRow}>
                          <Text style={styles.resultsCountText}>
                            {searchQuery.trim()
                              ? `نتائج البحث (${searchResults.length} عميل):`
                              : `العملاء المتاحين (${searchResults.length}):`}
                          </Text>
                          {isSearching && (
                            <ActivityIndicator size="small" color="#2E5A44" style={{ marginRight: 6 }} />
                          )}
                        </View>
                        <ScrollView
                          style={styles.searchResultsList}
                          nestedScrollEnabled={true}
                          keyboardShouldPersistTaps="handled"
                        >
                          {searchResults.map((u) => (
                            <TouchableOpacity
                              key={u.id}
                              style={styles.searchResultItem}
                              onPress={() => {
                                setSelectedUser(u);
                                setSearchResults(allUsers);
                                setSearchQuery('');
                              }}
                            >
                              <View style={styles.searchResultInfo}>
                                <Text style={styles.searchResultName}>{u.name}</Text>
                                <View style={styles.customerSubRow}>
                                  {u.phone ? (
                                    <View style={styles.subItem}>
                                      <MaterialIcons name="phone" size={12} color="#7C7870" />
                                      <Text style={styles.searchResultSub}>{u.phone}</Text>
                                    </View>
                                  ) : null}
                                  {u.shop_name ? (
                                    <View style={styles.subItem}>
                                      <MaterialIcons name="store" size={12} color="#7C7870" />
                                      <Text style={styles.searchResultSub}>{u.shop_name}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                              <View style={styles.selectPill}>
                                <MaterialIcons name="check" size={14} color="#2E5A44" />
                                <Text style={styles.searchResultSelect}>اختيار</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    ) : (
                      <View style={styles.searchStatusBox}>
                        <MaterialIcons
                          name={searchQuery.trim() ? "search-off" : "person-off"}
                          size={24}
                          color="#9A978F"
                        />
                        <Text style={styles.searchStatusText}>
                          {searchQuery.trim()
                            ? `لم يتم العثور على أي عميل يطابق "${searchQuery}"`
                            : 'لا يوجد عملاء مسجلين حالياً'}
                        </Text>
                        {!searchQuery.trim() && (
                          <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={() => fetchUsers('', true)}
                          >
                            <MaterialIcons name="refresh" size={16} color="#2E5A44" />
                            <Text style={styles.retryBtnText}>تحديث القائمة</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Message Form */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>تفاصيل الإشعار</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>عنوان الإشعار *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: 🔥 عروض مميزة اليوم أو تنبيه بخصوص طلبك"
                placeholderTextColor="#9A978F"
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>نص الرسالة *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={body}
                onChangeText={setBody}
                placeholder="اكتب الرسالة التي ستصل للعميل كإشعار فوري..."
                placeholderTextColor="#9A978F"
                multiline
                numberOfLines={5}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            {/* Preview Banner */}
            {title.trim().length > 0 && (
              <View style={styles.previewBox}>
                <View style={styles.previewHeader}>
                  <MaterialIcons name="notifications-active" size={16} color="#2E5A44" />
                  <Text style={styles.previewTitle}>معاينة الإشعار على جهاز العميل</Text>
                </View>
                <View style={styles.previewCard}>
                  <Text style={styles.previewCardTitle}>{title}</Text>
                  {body.trim().length > 0 && (
                    <Text style={styles.previewCardBody}>{body}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>جاري إرسال الإشعار...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>إرسال الإشعار الآن</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE8E2',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F4F3EF',
    alignItems: 'center',
    justifyContent: 'center',
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
  bellBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A2D23',
    marginBottom: 12,
    textAlign: 'right',
  },
  targetTabs: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  targetTab: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FAF9F6',
    borderWidth: 1.5,
    borderColor: '#EAE8E2',
  },
  targetTabActive: {
    backgroundColor: '#EEF4F1',
    borderColor: '#2E5A44',
  },
  targetTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C5950',
  },
  targetTabTextActive: {
    color: '#2E5A44',
    fontWeight: 'bold',
  },
  userSelectBox: {
    marginTop: 12,
  },
  selectedUserCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#EEF4F1',
    borderWidth: 1,
    borderColor: '#D0E2D8',
  },
  selectedUserInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  selectedUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  selectedUserSub: {
    fontSize: 11,
    color: '#7C7870',
    marginTop: 2,
  },
  changeUserBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  changeUserBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#BA1A1A',
  },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D0E2D8',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A2D23',
    textAlign: 'right',
    padding: 0,
  },
  searchStatusBox: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF9F6',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EAE8E2',
  },
  searchStatusText: {
    fontSize: 12,
    color: '#7C7870',
    textAlign: 'center',
  },
  resultsHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  resultsCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E5A44',
    textAlign: 'right',
  },
  retryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF4F1',
    marginTop: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  searchResultsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0E2D8',
    maxHeight: 250,
  },
  searchResultItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F3EF',
  },
  searchResultInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A2D23',
  },
  customerSubRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginTop: 3,
  },
  subItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  searchResultSub: {
    fontSize: 11,
    color: '#7C7870',
  },
  selectPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EEF4F1',
    borderWidth: 1,
    borderColor: '#D0E2D8',
  },
  searchResultSelect: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#5C5950',
    marginBottom: 6,
    textAlign: 'right',
  },
  textInput: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#EAE8E2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A2D23',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  previewBox: {
    backgroundColor: '#FAF9F6',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E5A44',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D0E2D8',
  },
  previewCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A2D23',
    textAlign: 'right',
  },
  previewCardBody: {
    fontSize: 12,
    color: '#5C5950',
    marginTop: 4,
    textAlign: 'right',
    lineHeight: 18,
  },
  sendButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E5A44',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#2E5A44',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
