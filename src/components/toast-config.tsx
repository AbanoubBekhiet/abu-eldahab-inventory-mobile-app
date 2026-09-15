import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';

export const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={styles.successToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      renderLeadingIcon={() => (
        <View style={styles.iconContainer}>
          <MaterialIcons name="check-circle" size={24} color="#FFF" />
        </View>
      )}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={styles.errorToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      renderLeadingIcon={() => (
        <View style={styles.errorIconContainer}>
          <MaterialIcons name="error" size={24} color="#FFF" />
        </View>
      )}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={styles.infoToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      renderLeadingIcon={() => (
        <View style={styles.infoIconContainer}>
          <MaterialIcons name="info" size={24} color="#FFF" />
        </View>
      )}
    />
  ),
};

const styles = StyleSheet.create({
  successToast: {
    borderLeftWidth: 0,
    backgroundColor: '#2D3C1F',
    borderRadius: 12,
    width: '90%',
    height: 'auto',
    minHeight: 60,
    paddingVertical: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorToast: {
    borderLeftWidth: 0,
    backgroundColor: '#BA1A1A',
    borderRadius: 12,
    width: '90%',
    height: 'auto',
    minHeight: 60,
    paddingVertical: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoToast: {
    borderLeftWidth: 0,
    backgroundColor: '#455330',
    borderRadius: 12,
    width: '90%',
    height: 'auto',
    minHeight: 60,
    paddingVertical: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentContainer: {
    paddingHorizontal: 15,
    backgroundColor: 'transparent',
    alignItems: 'flex-end', // For RTL layout (Arabic)
  },
  text1: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'right', // For RTL
    width: '100%',
  },
  text2: {
    fontSize: 12,
    color: '#D4EAB7',
    textAlign: 'right', // For RTL
    width: '100%',
    marginTop: 2,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 15,
  },
  errorIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 15,
  },
  infoIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 15,
  },
});
