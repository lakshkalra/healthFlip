import { NativeModules, Platform } from 'react-native';

// A bundled Debug build has a file:// script URL, so it cannot discover Metro's
// host at runtime. Keep the local iPhone fallback on the Mac's current Wi-Fi IP.
const metroHost = NativeModules.SourceCode?.getConstants?.().scriptURL?.match(/^https?:\/\/([^/:]+)/)?.[1];

const developmentHost = Platform.OS === 'android' ? '10.0.2.2' : metroHost ?? '192.168.0.5';

export const API_BASE_URL = __DEV__ ? `http://${developmentHost}:3000` : 'https://healthflip-api.vercel.app';
