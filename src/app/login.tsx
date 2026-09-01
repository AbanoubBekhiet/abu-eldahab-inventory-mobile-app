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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  loginCustomer,
  registerCustomer,
  setAuthToken,
  loadSavedAuthToken,
  fetchUserProfile,
  isAdminOrSubAdmin,
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

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await loadSavedAuthToken();
      if (token) {
        // Try to get user profile — fallback to cached profile if server fails
        let user = null;
        try {
          user = await fetchUserProfile();
        } catch (_e) {
          // network error — use cached user from AsyncStorage
        }
        if (user) {
          if (isAdminOrSubAdmin(user)) {
            router.replace('/admin' as any);
          } else {
            router.replace('/');
          }
          return;
        }
        // Even if fetchUserProfile returned null (e.g. 401), check AsyncStorage
        // for a cached user to allow offline/token-still-valid-locally flow
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const rawUser = await AsyncStorage.getItem('user_profile_v1');
          if (rawUser) {
            const cachedUser = JSON.parse(rawUser);
            if (cachedUser) {
              if (isAdminOrSubAdmin(cachedUser)) {
                router.replace('/admin' as any);
              } else {
                router.replace('/');
              }
              return;
            }
          }
        } catch (_e) {}
      }
    } catch (e) {
    } finally {
      setCheckingSession(false);
    }
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

      try {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        if (geocoded && geocoded.length > 0) {
          const addr = geocoded[0];
          const parts = [
            addr.street,
            addr.district,
            addr.city,
            addr.region,
            addr.country,
          ].filter(Boolean);

          if (parts.length > 0) {
            setAddress(parts.join('، '));
            Alert.alert('تم التحديد بنجاح 📍', 'تم تحديد موقعك بدقة واستخراج العنوان بنجاح!');
            setGettingLocation(false);
            return;
          }
        }
      } catch (geoErr) {}

      setAddress(`العنوان (إحداثيات: ${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      Alert.alert('تم التحديد بنجاح 📍', 'تم التقاط إحداثيات موقعك عبر GPS بنجاح!');
    } catch (error: any) {
      Alert.alert('تنبيه', 'تعذر الاتصال بخدمة الـ GPS على الهاتف. يمكنك كتابة العنوان يدوياً.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password || (isRegister && (!name || !phone))) {
      Alert.alert('تنبيه', 'يرجى إدخال جميع البيانات المطلوبة.');
      return;
    }

    setLoading(true);
    try {
      const fcmToken = await getOrGenerateFcmToken();
      let res;
      if (isRegister) {
        res = await registerCustomer(name, phone, email, password, address, shopName, latitude, longitude, fcmToken);
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
                source={require('../../assets/images/react-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>أبو الدهب للمواد الاستهلاكية</Text>
            <Text style={styles.welcomeSubtitle}>
              {isRegister ? 'تسجيل متجر / عميل جديد' : 'منصة التوزيع والجملة للمواد الغذائية والاستهلاكية'}
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

                {/* Phone Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>رقم الهاتف</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholderTextColor="#75786E"
                  />
                </View>

                {/* Location GPS Picker Field */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <TouchableOpacity
                      style={styles.gpsBtn}
                      onPress={handleGetLocation}
                      disabled={gettingLocation}
                    >
                      {gettingLocation ? (
                        <ActivityIndicator size="small" color="#2D3C1F" />
                      ) : (
                        <Text style={styles.gpsBtnText}>تحديد موقعي الحقيقي (GPS) 📍</Text>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.label}>عنوان التوصيل</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="العنوان التفصيلي"
                    value={address}
                    onChangeText={setAddress}
                    placeholderTextColor="#75786E"
                  />
                </View>
              </>
            )}

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>البريد الإلكتروني</Text>
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
        <Text style={styles.brandCaption}>تطبيق أبو الدهب لتجارة المواد الاستهلاكية والغذائية بالجملة والتجزئة</Text>
      </ScrollView>
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
  gpsBtn: {
    backgroundColor: '#D4EAB7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2D3C1F',
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
    fontSize: 11,
    color: '#75786E',
    marginTop: 20,
    textAlign: 'center',
  },
});
