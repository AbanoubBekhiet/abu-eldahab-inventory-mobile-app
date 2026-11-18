import { Alert, Linking } from 'react-native';

export function formatPhoneForWhatsApp(phone?: string): string {
  if (!phone || phone === '—') return '';
  let clean = phone.replace(/[^0-9+]/g, '');

  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  } else if (clean.startsWith('00')) {
    clean = clean.substring(2);
  }

  // Standard Egyptian mobile number (11 digits starting with 01)
  if (clean.startsWith('01') && clean.length === 11) {
    clean = '2' + clean;
  }

  return clean;
}

export function makePhoneCall(phone?: string) {
  if (!phone || phone === '—') {
    Alert.alert('تنبيه', 'رقم هاتف العميل غير متوفر');
    return;
  }
  const clean = phone.replace(/[^0-9+]/g, '');
  Linking.openURL(`tel:${clean}`);
}

export async function openWhatsApp(phone?: string, message: string = '') {
  if (!phone || phone === '—') {
    Alert.alert('تنبيه', 'رقم هاتف العميل غير متوفر');
    return;
  }

  const cleanNumber = formatPhoneForWhatsApp(phone);
  if (!cleanNumber) {
    Alert.alert('تنبيه', 'صيغة رقم الهاتف غير صالحة للواتساب');
    return;
  }

  const encodedMsg = message ? encodeURIComponent(message) : '';
  const appUrl = `whatsapp://send?phone=${cleanNumber}${encodedMsg ? `&text=${encodedMsg}` : ''}`;
  const webUrl = `https://wa.me/${cleanNumber}${encodedMsg ? `?text=${encodedMsg}` : ''}`;

  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    Linking.openURL(webUrl);
  }
}

export function promptContactCustomer(customerName: string, phone?: string) {
  if (!phone || phone === '—') {
    Alert.alert('تنبيه', 'رقم هاتف العميل غير متوفر');
    return;
  }

  Alert.alert(
    'تواصل مع العميل',
    `العميل: ${customerName}\nالهاتف: ${phone}`,
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'اتصال هاتف 📞',
        onPress: () => makePhoneCall(phone),
      },
      {
        text: 'محادثة واتساب 💬',
        onPress: () => openWhatsApp(phone),
      },
    ]
  );
}
