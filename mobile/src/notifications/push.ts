import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiRequest } from '@/api/client';

const LAST_REGISTERED_TOKEN = 'fp_last_fcm_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10b981',
  });
}

async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Registers the device's FCM token with the backend.
 * Safe to call multiple times — backend upserts on token.
 * Returns the raw FCM token string, or null if registration was skipped.
 */
export async function registerForPushNotifications(jwt: string): Promise<string | null> {
  if (!Device.isDevice) return null;
  // Expo Go (Android) cannot obtain FCM tokens — skip silently in dev.
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo && Platform.OS === 'android') {
    console.warn('[push] Expo Go cannot receive FCM — build a dev client or APK to test notifications.');
    return null;
  }

  await ensureAndroidChannel();
  const granted = await requestPermissions();
  if (!granted) return null;

  const { data: fcmToken } = await Notifications.getDevicePushTokenAsync();
  if (!fcmToken || typeof fcmToken !== 'string') return null;

  try {
    await apiRequest('/api/mobile/devices', {
      method: 'POST',
      body: { fcmToken },
      token: jwt,
    });
    await SecureStore.setItemAsync(LAST_REGISTERED_TOKEN, fcmToken);
  } catch (e) {
    console.warn('[push] device registration failed', e);
    return null;
  }
  return fcmToken;
}

/**
 * Best-effort token removal on sign-out. Pulls the last-registered token from
 * SecureStore so the caller doesn't have to track it.
 */
export async function unregisterPushToken(jwt: string) {
  const fcmToken = await SecureStore.getItemAsync(LAST_REGISTERED_TOKEN);
  if (!fcmToken) return;
  try {
    await apiRequest('/api/mobile/devices', {
      method: 'DELETE',
      body: { fcmToken },
      token: jwt,
    });
  } catch {
    // token will expire naturally server-side; non-fatal.
  } finally {
    await SecureStore.deleteItemAsync(LAST_REGISTERED_TOKEN);
  }
}

export { LAST_REGISTERED_TOKEN };
