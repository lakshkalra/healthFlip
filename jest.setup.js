/* global jest */

const mockValues = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockValues.get(key) ?? null)),
  setItem: jest.fn((key, value) => {
    mockValues.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn(key => {
    mockValues.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return { FlashList: React.forwardRef((props, ref) => React.createElement(FlatList, { ...props, ref })) };
});

jest.mock('@mindinventory/react-native-nitro-realtime-audio', () => ({
  configureAudioSession: jest.fn(),
  deactivateAudioSession: jest.fn(),
  initializePlayer: jest.fn(),
  onAudioChunk: jest.fn(),
  onVoiceActivity: jest.fn(),
  playChunk: jest.fn(),
  releasePlayer: jest.fn(),
  requestMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
  startRecording: jest.fn(),
  stopPlayback: jest.fn(),
  stopRecording: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AnimatedView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
  const Animated = { View: AnimatedView };
  return {
    __esModule: true,
    default: Animated,
    Easing: { inOut: value => value, quad: 'quad' },
    useAnimatedStyle: worklet => worklet(),
    // Like Reanimated, keep the same shared value object across renders.
    useSharedValue: value => React.useRef({ value }).current,
    withRepeat: value => value,
    withTiming: value => value,
  };
});
