import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiRequest } from '@/api/client';

// @react-native-firebase/messaging is a native module — not available in Expo Go.
// Lazy-load it so the module-level import doesn't crash the app.
let messaging: typeof import('@react-native-firebase/messaging').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  messaging = require('@react-native-firebase/messaging').default;
} catch {
  // silently unavailable in Expo Go
}

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
  if (Platform.OS === 'ios' && messaging) {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } else if (Platform.OS === 'ios') {
    return false;
  }
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
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[push] Expo Go cannot receive FCM — build a dev client or APK to test notifications.');
    }
    return null;
  }

  await ensureAndroidChannel();
  const granted = await requestPermissions();
  if (!granted) return null;

  let fcmToken: string;
  try {
    if (Platform.OS === 'ios' && messaging) {
      fcmToken = await messaging().getToken();
    } else if (Platform.OS === 'ios') {
      return null;
    } else {
      const { data } = await Notifications.getDevicePushTokenAsync();
      fcmToken = data;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[push] failed to get FCM token', e);
    return null;
  }
  if (!fcmToken || typeof fcmToken !== 'string') return null;

  try {
    await apiRequest('/api/mobile/devices', {
      method: 'POST',
      body: { fcmToken, platform: Platform.OS },
      token: jwt,
    });
    await SecureStore.setItemAsync(LAST_REGISTERED_TOKEN, fcmToken);
  } catch (e) {
    // eslint-disable-next-line no-console
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
