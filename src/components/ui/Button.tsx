import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { Spinner } from './Feedback';
import { Icon, type IconName } from './Icon';
import { styles } from './styles';
import { colors } from '../../constants/theme';

export function RoundIconButton({ name, onPress, label, bg = colors.white, size = 44, iconSize = 19, stroke = 2.4, busy = false }: { name: IconName; onPress?: () => void; label: string; bg?: string; size?: number; iconSize?: number; stroke?: number; busy?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={busy || !onPress} onPress={onPress} style={({ pressed }) => [styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: pressed ? colors.pale : bg }]}>
      {busy ? <Spinner color={colors.greenMid} /> : <Icon name={name} size={iconSize} stroke={stroke} />}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.primary, pressed: '#8cc23a', fg: colors.ink },
  dark: { bg: colors.ink, pressed: '#33372f', fg: colors.white },
  light: { bg: colors.white, pressed: colors.dangerBg, fg: colors.dangerText },
  muted: { bg: colors.chip, pressed: '#e4e8dc', fg: colors.ink },
  danger: { bg: colors.danger, pressed: '#a93a27', fg: colors.white },
};

export function PillButton({ title, onPress, variant = 'primary', icon, trailingIcon, busy = false, busyLabel, height = 56, glow = false, style }: { title: string; onPress: () => void; variant?: keyof typeof buttonVariants; icon?: IconName; trailingIcon?: IconName; busy?: boolean; busyLabel?: string; height?: number; glow?: boolean; style?: StyleProp<ViewStyle> }) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { height, backgroundColor: pressed ? v.pressed : v.bg }, glow && !busy && styles.glow, busy && styles.busy, style]}>
      {busy ? <Spinner color={v.fg} /> : icon ? <Icon name={icon} size={18} color={v.fg} stroke={2.6} /> : null}
      <Text style={[styles.pillText, height < 52 && styles.pillTextSmall, { color: v.fg }]}>{busy && busyLabel ? busyLabel : title}</Text>
      {trailingIcon && !busy ? <Icon name={trailingIcon} size={18} color={v.fg} stroke={2.6} /> : null}
    </Pressable>
  );
}

// ---------- Feedback ----------

/** Visual on/off switch; the parent row handles the press. */
export function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, on && styles.toggleOn]}>
      <View style={[styles.toggleKnob, on && styles.toggleKnobOn]} />
    </View>
  );
}
