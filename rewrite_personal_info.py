with open('src/app/personal-info.tsx', 'w') as f:
    f.write("""import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MobileFooterNav from '../components/mobile-footer';
import { fetchUserProfile, updateProfileOnServer, fetchRegions, User } from '../services/api';
import { useRoleGuard } from '../hooks/useRoleGuard';

export default function PersonalInfoScreen() {
  useRoleGuard('customer');
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Form Fields State
  const [shopName, setShopName] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [regionId, setRegionId] = useState<number | null>(null);
  
  const [regions, setRegions] = useState<any[]>([]);
  const [regionModalVisible, setRegionModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const regs = await fetchRegions();
      setRegions(regs);
      const user = await fetchUserProfile();
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
        if (user.profile) {
          setShopName(user.profile.shop_name || '');
          setPhone(user.profile.phone_number || '');
          setAddress(user.profile.address || '');
          setLatitude(user.profile.latitude || null);
          setLongitude(user.profile.longitude || null);
          setRegionId(user.profile.region_id || null);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تم رفض الإذن', 'يرجى السماح للتطبيق بإذن الوصول لموقع الـ GPS لربط عنوانك تلقائياً.');
        setGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      Alert.alert('تم التحديد بنجاح 📍', 'تم التقاط إحداثيات موقعك عبر GPS بنجاح!');
    } catch (error: any) {
      Alert.alert(
        'خدمة الموقع معطلة',
        'يرجى تفعيل خدمة الـ GPS في الهاتف، ثم اضغط على "حاول مرة أخرى".',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'حاول مرة أخرى', onPress: handleGetLocation }
        ]
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!name || !phone) {
      Alert.alert('تنبيه', 'يرجى إدخال جميع البيانات المطلوبة.');
      return;
    }
    if (!latitude || !longitude) {
      Alert.alert('تنبيه', 'تحديد موقعك الحقيقي (GPS) إلزامي. يرجى الضغط على زر تحديد الموقع.');
      return;
    }
    if (!regionId) {
      Alert.alert('تنبيه', 'يرجى اختيار المنطقة');
      return;
    }

    setSaving(true);
    try {
      await updateProfileOnServer({
        name,
        phone,
        email,
        address,
        shop_name: shopName,
        latitude,
        longitude,
        region_id: regionId
      });
      Alert.alert('نجاح 🌟', 'تم حفظ المعلومات الشخصية بنجاح!');
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={22} color="#1F1B13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تحديث البيانات</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <>
            <View style={styles.formCard}>
              <View style={styles.formContainer}>
                {/* Shop Name Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>اسم المحل / المتجر</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="مثال: سوبر ماركت الأمل"
                    value={shopName}
                    onChangeText={setShopName}
                    placeholderTextColor="#75786E"
                  />
                </View>

                {/* Customer Full Name Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>اسم العميل بالكامل *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="مثال: أبانوب بخيت"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor="#75786E"
                  />
                </View>

                {/* Address Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>العنوان التفصيلي</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                    placeholder="اكتب عنوانك بالتفصيل..."
                    value={address}
                    onChangeText={setAddress}
                    multiline
                    placeholderTextColor="#75786E"
                  />
                </View>

                {/* Region Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>منطقة التوصيل *</Text>
                  <TouchableOpacity
                    style={[styles.input, { justifyContent: 'center' }]}
                    onPress={() => setRegionModalVisible(true)}
                  >
                    <Text style={{ color: regionId ? '#2D3C1F' : '#75786E', textAlign: 'right' }}>
                      {regionId ? regions.find(r => r.id === regionId)?.name : 'اختر المنطقة...'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Big Location Button */}
                <TouchableOpacity
                  style={[styles.bigGpsBtn, latitude && longitude ? styles.bigGpsBtnSuccess : null]}
                  onPress={handleGetLocation}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="my-location" size={24} color="#FFFFFF" />
                      <Text style={styles.bigGpsBtnText}>
                        {latitude && longitude ? 'تم تحديد الموقع بنجاح ✓' : 'تحديد موقعي الحقيقي (GPS) *'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Phone Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>رقم الهاتف *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholderTextColor="#75786E"
                  />
                </View>

                {/* Email Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>البريد الإلكتروني (اختياري)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="example@domain.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#75786E"
                  />
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Links Section */}
            <View style={styles.quickLinksCard}>
              <TouchableOpacity style={styles.quickLinkItem} onPress={() => router.push('/cart')}>
                <MaterialIcons name="chevron-left" size={20} color="#75786E" />
                <View style={styles.quickLinkRight}>
                  <Text style={styles.quickLinkText}>سجل الطلبات وسلة التسوق</Text>
                  <MaterialIcons name="history" size={20} color="#2D3C1F" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.quickLinkItem, { borderBottomWidth: 0 }]} onPress={() => router.push('/wishlist')}>
                <MaterialIcons name="chevron-left" size={20} color="#75786E" />
                <View style={styles.quickLinkRight}>
                  <Text style={styles.quickLinkText}>المنتجات المفضلة</Text>
                  <MaterialIcons name="favorite" size={20} color="#BA1A1A" />
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Region Modal */}
      <Modal
        visible={regionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRegionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setRegionModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#1F1B13" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>اختر المنطقة</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={regions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.regionItem}
                  onPress={() => {
                    setRegionId(item.id);
                    setRegionModalVisible(false);
                  }}
                >
                  <Text style={styles.regionItemText}>{item.name}</Text>
                  {regionId === item.id && (
                    <MaterialIcons name="check" size={20} color="#4E6A34" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <MobileFooterNav />
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  iconBtn: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  centerContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 16,
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  fieldGroup: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1B13',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#FBF2E5',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F1B13',
    textAlign: 'right',
  },
  bigGpsBtn: {
    backgroundColor: '#2D3C1F',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  bigGpsBtnSuccess: {
    backgroundColor: '#4E6A34',
  },
  bigGpsBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#2D3C1F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickLinksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    overflow: 'hidden',
    marginBottom: 24,
  },
  quickLinkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  quickLinkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1B13',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF8F1',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  regionItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D5',
  },
  regionItemText: {
    fontSize: 16,
    color: '#1F1B13',
    textAlign: 'right',
  },
});
""")
