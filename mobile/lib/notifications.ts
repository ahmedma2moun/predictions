/**
 * Push notification setup for Android (FCM).
 *
 * SETUP REQUIRED:
 *   1. Drop your google-services.json into the mobile/ root directory.
 *   2. Replace YOUR_EAS_PROJECT_ID in app.json → extra.eas.projectId.
 *   3. Run `eas build` so the native FCM integration is compiled in.
 *
 * The FCM token is retrieved via expo-notifications on Android and registered
 * with the backend at POST /api/mobile/devices so the server can send pushes.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// Foreground notification behaviour: show banner + play sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

/**
 * Request permission and register the FCM device token with the backend.
 * Call this after a successful login.
 */
export async function setupNotifications(): Promise<void> {
  if (!Device.isDevice) {
    // Push tokens are not available in the Android emulator without a real device
    console.log('[notifications] Skipping push setup: not a physical device');
    return;
  }

  if (Platform.OS !== 'android') return;

  // Request permission (Android 13+ requires explicit POST_NOTIFICATIONS grant)
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission denied');
    return;
  }

  // Create the notification channel (required for Android 8+)
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Football Predictions',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4ade80',
  });

  try {
    // getDevicePushTokenAsync returns the FCM token on Android
    const pushToken = await Notifications.getDevicePushTokenAsync();
    const fcmToken = pushToken.data as string;

    await api.post('/api/mobile/devices', { fcmToken });
    console.log('[notifications] FCM token registered');
  } catch (err) {
    console.warn('[notifications] Failed to register FCM token:', err);
  }
}

/**
 * Unregister the device token from the backend on logout.
 */
export async function unregisterNotifications(): Promise<void> {
  try {
    const pushToken = await Notifications.getDevicePushTokenAsync();
    const fcmToken = pushToken.data as string;
    await api.delete('/api/mobile/devices', { data: { fcmToken } });
  } catch {
    // Best-effort; ignore errors on logout
  }
}

/**
 * Add a listener for notification taps so the app can route to the right screen.
 * Returns the subscription (call .remove() in cleanup).
 */
export function addNotificationResponseListener(
  onMatchId: (matchId: string) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    if (typeof data?.matchId === 'string') {
      onMatchId(data.matchId);
    }
  });
}
