import type { ReactNode } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { RoundIconButton } from './Button';
import { styles } from './styles';

/** Back arrow, centred title and a spacer, used by every sub-screen. */
export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.backHeader}>
      <RoundIconButton name="arrowLeft" label="Back" iconSize={20} stroke={2.6} onPress={onBack} />
      <Text style={styles.headline}>{title}</Text>
      <View style={styles.spacer44} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
