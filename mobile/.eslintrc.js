module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['react-native'],
  rules: {
    // Hooks correctness
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // React Native quality
    'react-native/no-raw-text': 'warn',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-unused-styles': 'warn',
    // Production logging
    'no-console': 'warn',
  },
};
