module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-native|react-native-reanimated|react-native-worklets|react-native-safe-area-context)/)',
  ],
};
