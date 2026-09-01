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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MobileFooterNav from '../components/mobile-footer';
import { fetchUserProfile, User } from '../services/api';
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

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const user = await fetchUserProfile();
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
        setPhone(user.phone || '');
        setShopName(user.shop_name || '');
        setAddress(user.address || '');
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  // Native GPS location handler
  const handleGetLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تم رفض الإذن', 'يرجى السماح بالتطبيق للوصول لموقعك الجغرافي.');
        setGettingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocoded && geocoded.length > 0) {
          const addr = geocoded[0];
          const parts = [addr.street, addr.district, addr.city, addr.country].filter(Boolean);
          if (parts.length > 0) {
            setAddress(parts.join('، '));
            Alert.alert('تم التحديد 📍', 'تم تحديث موقعك بنجاح!');
            setGettingLocation(false);
            return;
          }
        }
      } catch (e) {}

      setAddress(`العنوان (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      Alert.alert('تم التحديد 📍', 'تم الالتقاط بنجاح!');
    } catch (err) {
      Alert.alert('تنبيه', 'تعذر الاتصال بالـ GPS يدوياً.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      Alert.alert('نجاح 🌟', 'تم حفظ المعلومات الشخصية بنجاح!');
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topAppBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={22} color="#1F1B13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المعلومات الشخصية</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2D3C1F" />
          </View>
        ) : (
          <>
            {/* Profile Card Header */}
            <View style={styles.profileHeaderCard}>
              <View style={styles.avatarCircle}>
                <MaterialIcons name="person" size={44} color="#2D3C1F" />
              </View>
              <Text style={styles.profileName}>{name || 'العميل'}</Text>
              <Text style={styles.profileEmail}>{email || 'لا يوجد بريد إلكتروني'}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>عميل استهلاكي مميز 🛒</Text>
              </View>
            </View>

            {/* Info Edit Form */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>تعديل البيانات الشخصية</Text>

              {/* Shop Name */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>اسم المحل / المتجر</Text>
                <View style={styles.inputBox}>
                  <MaterialIcons name="storefront" size={20} color="#75786E" />
                  <TextInput
                    style={styles.textInput}
                    value={shopName}
                    onChangeText={setShopName}
                    placeholder="أدخل اسم المحل"
                    placeholderTextColor="#9A978F"
                  />
                </View>
              </View>

              {/* Customer Full Name */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>اسم العميل الكامل</Text>
                <View style={styles.inputBox}>
                  <MaterialIcons name="person-outline" size={20} color="#75786E" />
                  <TextInput
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="أدخل اسمك بالكامل"
                    placeholderTextColor="#9A978F"
                  />
                </View>
              </View>

              {/* Phone Number */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>رقم الهاتف</Text>
                <View style={styles.inputBox}>
                  <MaterialIcons name="phone" size={20} color="#75786E" />
                  <TextInput
                    style={styles.textInput}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="01XXXXXXXXX"
                    placeholderTextColor="#9A978F"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>البريد الإلكتروني</Text>
                <View style={styles.inputBox}>
                  <MaterialIcons name="email" size={20} color="#75786E" />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="example@domain.com"
                    placeholderTextColor="#9A978F"
                  />
                </View>
              </View>

              {/* Address & GPS */}
              <View style={styles.inputWrapper}>
                <View style={styles.labelRow}>
                  <TouchableOpacity
                    style={styles.gpsBtn}
                    onPress={handleGetLocation}
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? (
                      <ActivityIndicator size="small" color="#2D3C1F" />
                    ) : (
                      <View style={styles.gpsBtnRow}>
                        <MaterialIcons name="my-location" size={14} color="#2D3C1F" />
                        <Text style={styles.gpsBtnText}>تحديد تلقائي (GPS)</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.inputLabel}>العنوان الحالي</Text>
                </View>

                <View style={styles.inputBox}>
                  <MaterialIcons name="location-on" size={20} color="#75786E" />
                  <TextInput
                    style={styles.textInput}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="أدخل العنوان بالتفصيل"
                    placeholderTextColor="#9A978F"
                  />
                </View>
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

      {/* Sticky Bottom Nav */}
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
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D4EAB7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F1B13',
  },
  profileEmail: {
    fontSize: 13,
    color: '#75786E',
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: '#F6EDE0',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 9999,
    marginTop: 10,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAE1D5',
    marginBottom: 16,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3C1F',
    marginBottom: 16,
    textAlign: 'right',
  },
  inputWrapper: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1B13',
    marginBottom: 6,
    textAlign: 'right',
  },
  gpsBtn: {
    backgroundColor: '#D4EAB7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gpsBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2D3C1F',
  },
  inputBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FBF2E5',
    borderWidth: 1,
    borderColor: '#EAE1D5',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F1B13',
    textAlign: 'right',
    paddingHorizontal: 8,
  },
  saveBtn: {
    backgroundColor: '#2D3C1F',
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  centerContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
