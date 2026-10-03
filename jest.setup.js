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

jest.mock('react-native-blob-util', () => {
  const fetch = jest.fn(() => Promise.resolve({ info: () => ({ status: 200 }), path: () => '/docs/plan.pdf' }));
  return {
    __esModule: true,
    default: {
      android: { actionViewIntent: jest.fn(() => Promise.resolve(true)) },
      config: jest.fn(() => ({ fetch })),
      fs: { dirs: { DocumentDir: '/docs' }, unlink: jest.fn(() => Promise.resolve()) },
      ios: { openDocument: jest.fn(() => Promise.resolve()) },
    },
  };
});

// Apple Health is unavailable by default; tests opt in per case.
jest.mock('@kingstinct/react-native-healthkit', () => ({
  AuthorizationRequestStatus: { shouldRequest: 1, unknown: 0, unnecessary: 2 },
  getRequestStatusForAuthorization: jest.fn(() => Promise.resolve(1)),
  isHealthDataAvailable: jest.fn(() => false),
  queryStatisticsForQuantity: jest.fn(() => Promise.resolve({ sources: [], sumQuantity: { quantity: 0, unit: 'count' } })),
  requestAuthorization: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Leaf = () => null;
  return {
    Canvas: props => React.createElement(View, { style: props.style, testID: 'skia-canvas' }),
    LinearGradient: Leaf,
    Picture: Leaf,
    Rect: Leaf,
    Skia: {},
    TileMode: { Clamp: 0 },
    createPicture: () => null,
    vec: (x, y) => ({ x, y }),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AnimatedView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
  const Animated = { View: AnimatedView };
  return {
    __esModule: true,
    default: Animated,
    Easing: { bezier: () => value => value, inOut: value => value, quad: 'quad' },
    useAnimatedStyle: worklet => worklet(),
    // Drawing worklets need a real Skia canvas, so derived values and frame loops stay inert in tests.
    useDerivedValue: () => React.useRef({ value: null }).current,
    useFrameCallback: () => React.useRef({ isActive: false, setActive: () => undefined }).current,
    // Like Reanimated, keep the same shared value object across renders.
    useSharedValue: value => React.useRef({ value }).current,
    withRepeat: value => value,
    withTiming: value => value,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(() => Promise.resolve({ didCancel: true })),
  launchImageLibrary: jest.fn(() => Promise.resolve({ didCancel: true })),
}));

jest.mock('@react-native-documents/picker', () => ({
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: error => !!error && typeof error === 'object' && 'code' in error,
  keepLocalCopy: jest.fn(() => Promise.resolve([{ localUri: 'file:///cache/report.pdf', sourceUri: 'file:///picked/report.pdf', status: 'success' }])),
  pick: jest.fn(() => Promise.reject({ code: 'OPERATION_CANCELED' })),
  types: { pdf: 'com.adobe.pdf' },
}));

