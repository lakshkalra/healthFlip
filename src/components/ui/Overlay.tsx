import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './styles';

/** Animated overlay: a bottom sheet (`sheet`) or a floating card (`dialog`). Stays mounted until the close animation ends. */
export function Overlay({ visible, onClose, variant = 'sheet', children }: { visible: boolean; onClose: () => void; variant?: 'sheet' | 'dialog'; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [keyboard, setKeyboard] = useState(0);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const show = Keyboard.addListener('keyboardWillShow', event => setKeyboard(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 340, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [anim, visible]);

  if (!mounted && !visible) return null;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [variant === 'sheet' ? 700 : 500, 0] });
  // An absolutely positioned sheet ignores KeyboardAvoidingView padding, so on iOS it sits on top of
  // the keyboard explicitly and shrinks to the space that is left.
  const sheetFrame = variant === 'sheet' && Platform.OS === 'ios'
    ? { bottom: keyboard, maxHeight: window.height - keyboard - insets.top - 8 }
    : null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={variant !== 'sheet' || Platform.OS !== 'ios'}>
        <Animated.View style={[StyleSheet.absoluteFill, variant === 'sheet' ? styles.scrimSheet : styles.scrimDialog, { opacity: anim }]}>
          <Pressable accessibilityLabel="Close" style={styles.flex} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[variant === 'sheet' ? styles.sheet : styles.dialog, sheetFrame, { transform: [{ translateY }] }]}>{children}</Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ---------- Shared screen pieces ----------
