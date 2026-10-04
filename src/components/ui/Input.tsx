import type { ReactNode } from 'react';
import { type StyleProp, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import { styles } from './styles';
import { colors } from '../../constants/theme';

/** Soft input shell with error border, shared by goal target, food, calories, macros. */
export function InputShell({ error, style, children }: { error?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[styles.inputShell, error && styles.inputShellError, style]}>{children}</View>;
}

export function NumberInput(props: TextInputProps) {
  return <TextInput keyboardType="number-pad" placeholderTextColor={colors.faint} {...props} style={[styles.input, props.style]} />;
}

// ---------- Progress ----------
