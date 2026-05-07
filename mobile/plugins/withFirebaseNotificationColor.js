const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withFirebaseNotificationColor(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return androidConfig;

    const metaDataArray = application['meta-data'] ?? [];
    const entry = metaDataArray.find(
      (m) => m.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_color'
    );

    if (entry) {
      entry.$['tools:replace'] = 'android:resource';
    }

    // Ensure the tools namespace is declared on the manifest root
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return androidConfig;
  });
};
