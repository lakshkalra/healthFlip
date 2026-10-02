import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Asset } from 'react-native-image-picker';

import { Icon, colors } from './ui';

type SpeechEvent = {
  message?: string;
  results?: { transcriptions?: Array<{ text?: string }> };
  value?: string;
};

type SpeechKit = {
  addEventListener: (eventName: string, handler: (event: SpeechEvent) => void) => { remove: () => void };
  destroy: () => Promise<string>;
  isRecognitionAvailable: () => Promise<boolean>;
  speechRecogntionEvents: { END: string; ERROR: string; RESULTS: string; PARTIAL_RESULTS: string; START: string };
  startListening: () => Promise<string>;
  stopListening: () => Promise<string>;
};

export type MealImage = {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  uri: string;
};

function getSpeechKit(): SpeechKit | null {
  try {
    // Keep the native module lazy so Jest and platforms without speech support can use the manual path.
    return require('react-native-speech-recognition-kit') as SpeechKit;
  } catch {
    return null;
  }
}

async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    buttonNegative: 'Not now',
    buttonPositive: 'Allow',
    message: 'healthFlip uses the microphone only to turn your meal description into text.',
    title: 'Allow microphone access',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function VoiceCaptureButton({ onText, style }: { onText: (text: string) => void; style?: StyleProp<ViewStyle> }) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const kit = getSpeechKit();
    if (!kit) return undefined;

    const events = kit.speechRecogntionEvents;
    const partial = kit.addEventListener(events.PARTIAL_RESULTS, event => {
      const text = event.value ?? event.results?.transcriptions?.[0]?.text ?? '';
      if (text.trim()) onText(text.trim());
    });
    const result = kit.addEventListener(events.RESULTS, event => {
      const text = event.value ?? event.results?.transcriptions?.[0]?.text ?? '';
      if (text.trim()) onText(text.trim());
    });
    const started = kit.addEventListener(events.START, () => setStatus('listening'));
    const ended = kit.addEventListener(events.END, () => setStatus('idle'));
    const error = kit.addEventListener(events.ERROR, event => {
      setStatus('error');
      setMessage(event.message ?? 'Voice input is unavailable right now.');
    });

    return () => {
      partial.remove();
      result.remove();
      started.remove();
      ended.remove();
      error.remove();
      kit.destroy().catch(() => undefined);
    };
  }, [onText]);

  async function toggle() {
    const kit = getSpeechKit();
    if (!kit) {
      setStatus('error');
      setMessage('Voice input is not available on this build. You can type the meal instead.');
      return;
    }
    if (status === 'listening') {
      await kit.stopListening().catch(() => setStatus('error'));
      return;
    }
    if (!(await requestMicrophonePermission())) {
      setStatus('error');
      setMessage('Microphone access was denied. You can type the meal instead.');
      return;
    }
    try {
      setMessage('');
      if (!(await kit.isRecognitionAvailable())) {
        setStatus('error');
        setMessage('Speech recognition is unavailable on this device.');
        return;
      }
      setStatus('listening');
      await kit.startListening();
    } catch {
      setStatus('error');
      setMessage('Voice input is unavailable right now.');
    }
  }

  return (
    <View style={style}>
      <Pressable accessibilityLabel={status === 'listening' ? 'Stop voice input' : 'Use voice input'} accessibilityRole="button" onPress={toggle} style={({ pressed }) => [mediaStyles.button, pressed && mediaStyles.pressed, status === 'listening' && mediaStyles.listening]}>
        <Icon name="mic" color={colors.greenDark} size={18} />
        <Text style={mediaStyles.buttonText}>{status === 'listening' ? 'Stop listening' : 'Use voice'}</Text>
      </Pressable>
      {status === 'error' && message ? <Text style={mediaStyles.error}>{message}</Text> : null}
    </View>
  );
}

export async function chooseMealImage(source: 'camera' | 'library'): Promise<MealImage | null> {
  const options = {
    assetRepresentationMode: 'compatible' as const,
    includeBase64: true,
    maxHeight: 1280,
    maxWidth: 1280,
    mediaType: 'photo' as const,
    quality: 0.6 as const,
    selectionLimit: 1,
  };
  const picker = require('react-native-image-picker') as {
    launchCamera: (input: typeof options) => Promise<{ didCancel?: boolean; assets?: Asset[] }>;
    launchImageLibrary: (input: typeof options) => Promise<{ didCancel?: boolean; assets?: Asset[] }>;
  };
  const response = source === 'camera' ? await picker.launchCamera(options) : await picker.launchImageLibrary(options);
  if (response.didCancel || !response.assets?.[0]) return null;
  return normalizeImage(response.assets[0]);
}

function normalizeImage(asset: Asset): MealImage {
  if (!asset.base64 || !asset.uri) throw new Error('The selected image could not be prepared.');
  if (asset.type !== 'image/jpeg' && asset.type !== 'image/png' && asset.type !== 'image/webp') {
    throw new Error('Please choose a JPEG, PNG, or WebP image.');
  }
  return { base64: asset.base64, mimeType: asset.type, uri: asset.uri };
}

const mediaStyles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, flexDirection: 'row', gap: 8, minHeight: 46, paddingHorizontal: 14 },
  buttonText: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
  error: { color: colors.dangerText, fontSize: 12, lineHeight: 17, marginTop: 6 },
  listening: { backgroundColor: colors.limeBright },
  pressed: { backgroundColor: colors.selected },
});
