import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  loginCustomer,
  registerCustomer,
  setAuthToken,
  loadSavedAuthToken,
  fetchUserProfile,
  isAdminOrSubAdmin,
  fetchRegions,
  Region,
  getSettingsLogoUrl,
} from '../services/api';
import { getOrGenerateFcmToken } from '../services/fcm';

export default function LoginScreen() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Form fields
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState<number | null>(null);
  const [regionModalVisible, setRegionModalVisible] = useState(false);

  useEffect(() => {
    checkExistingSession();
    loadRegions();
  }, []);

  const loadRegions = async () => {
    const data = await fetchRegions();
    setRegions(data);
  };

  const { manual } = useLocalSearchParams();

  const checkExistingSession = async () => {
    if (manual === '1') {
      setCheckingSession(false);
      return;
    }
    try {
      const token = await loadSavedAuthToken();
      if (token) {
        let user = null;
        try {
          user = await fetchUserProfile();
        } catch (e) {
          // Ignore network errors, if token exists we assume logged in for now if no fetch
        }
        if (user) {
          if (isAdminOrSubAdmin(user)) {
            router.replace('/admin');
          } else {
            router.replace('/');
          }
          return;
        }
      }
    } catch (error) {
      console.log('No existing session', error);
    }
    setCheckingSession(false);
  };

  // Get current native GPS location handler
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

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);

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

  const handleSubmit = async () => {
    if (!password || (!isRegister && !email) || (isRegister && (!name || !phone))) {
      Alert.alert('تنبيه', 'يرجى إدخال جميع البيانات المطلوبة.');
      return;
    }
    if (isRegister && (!latitude || !longitude)) {
      Alert.alert('تنبيه', 'تحديد موقعك الحقيقي (GPS) إلزامي لإتمام التسجيل. يرجى الضغط على زر تحديد الموقع.');
      return;
    }

    setLoading(true);
    try {
      const fcmToken = await getOrGenerateFcmToken();
      let res;
      if (isRegister) {
        if (!regionId) {
          Alert.alert('تنبيه', 'يرجى اختيار المنطقة');
          setLoading(false);
          return;
        }
        res = await registerCustomer(name, phone, email, password, address, shopName, latitude, longitude, fcmToken, regionId);
        Alert.alert('تم بنجاح', 'تم إنشاء حسابك الجديد بنجاح!');
      } else {
        res = await loginCustomer(email, password, fcmToken);
        Alert.alert('مرحباً بك', 'تم تسجيل الدخول بنجاح!');
      }

      if (res && res.token) {
        setAuthToken(res.token);
      }

      const userObj = res?.user || res?.data?.user || (await fetchUserProfile());
      if (isAdminOrSubAdmin(userObj)) {
        router.replace('/admin' as any);
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'فشل تسجيل الدخول. يرجى مراجعة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2D3C1F" />
        <Text style={{ marginTop: 12, fontSize: 14, color: '#75786E', fontWeight: '600' }}>
          جاري التحقق من الجلسة...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* FMCG Login Card */}
        <View style={styles.loginCard}>
          {/* Logo & Welcome Header */}
          <View style={styles.headerBox}>
            <View style={styles.logoCircle}>
              <Image
                source={{ uri: getSettingsLogoUrl() }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>أبو الدهب للمواد الاستهلاكية</Text>
            <Text style={styles.welcomeSubtitle}>
              {isRegister ? 'تسجيل متجر / عميل جديد' : 'منصة التوزيع والجملة للخردوات والمنظفات والورقيات'}
            </Text>
          </View>

          {/* Input Form */}
          <View style={styles.formContainer}>
            {isRegister && (
              <>
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
                  <Text style={styles.label}>اسم العميل بالكامل</Text>
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

                {/* Location GPS Picker Field */}
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
              </>
            )}

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{isRegister ? 'البريد الإلكتروني (اختياري)' : 'رقم الهاتف أو البريد الإلكتروني'}</Text>
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

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                {!isRegister && (
                  <TouchableOpacity>
                    <Text style={styles.forgotText}>نسيت كلمة السر؟</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.label}>كلمة السر</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#75786E"
              />
            </View>

            {/* Submit CTA Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle Register / Login mode */}
          <View style={styles.toggleFooter}>
            <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
              <Text style={styles.toggleActionText}>
                {isRegister ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.toggleText}>
              {isRegister ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟'}
            </Text>
          </View>
        </View>

        {/* Brand Caption Footer */}
        <Text style={styles.brandCaption}>تطبيق أبو الدهب لتجارة الخردوات والمنظفات والورقيات بالجملة والتجزئة</Text>
      </ScrollView>

      {/* Region Picker Modal */}
      <Modal visible={regionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر منطقة التوصيل</Text>
            <FlatList
              data={regions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setRegionId(item.id);
                    setRegionModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setRegionModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    elevation: 4,
    shadowColor: '#2D3C1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D4EAB7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoImage: {
    width: 38,
    height: 38,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: '#75786E',
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  fieldGroup: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1B13',
    marginBottom: 6,
    textAlign: 'right',
  },
  forgotText: {
    fontSize: 12,
    color: '#2D3C1F',
    fontWeight: 'bold',
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
  submitBtn: {
    backgroundColor: '#2D3C1F',
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  toggleFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  toggleText: {
    fontSize: 13,
    color: '#75786E',
  },
  toggleActionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  brandCaption: {
    textAlign: 'center',
    fontSize: 10,
    color: '#9A978F',
    marginTop: 32,
    marginBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F1B13',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F3EF',
  },
  modalItemText: {
    fontSize: 16,
    color: '#2D3C1F',
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F4F3EF',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#75786E',
  },
});
