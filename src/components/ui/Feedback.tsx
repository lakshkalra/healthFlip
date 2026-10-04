import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { PillButton } from './Button';
import { Icon, type IconName, IconTile } from './Icon';
import { styles } from './styles';
import { colors } from '../../constants/theme';

export function Spinner({ color = colors.ink }: { color?: string }) {
  return <ActivityIndicator size="small" color={color} />;
}

// ---------- Buttons ----------

/** Inline red notice, optionally with a Retry pill (refresh failure). */
export function Banner({ message, onRetry, icon = false }: { message: string; onRetry?: () => void; icon?: boolean }) {
  return (
    <View accessibilityRole="alert" style={[styles.banner, onRetry && styles.bannerAction]}>
      {icon ? <Icon name="alert" size={18} color={colors.dangerInk} /> : null}
      <Text style={styles.bannerText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.bannerRetry, pressed && { backgroundColor: '#fff4ef' }]}>
          <Text style={styles.bannerRetryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FieldError({ message, small = false }: { message?: string; small?: boolean }) {
  return message ? <Text style={[styles.fieldError, small && styles.fieldErrorSmall]}>{message}</Text> : null;
}

/** Full card for unrecoverable load failures (bootstrap / dashboard without content). */
export function ErrorCard({ title, body, onRetry, retryIcon = false, style }: { title: string; body: string; onRetry: () => void; retryIcon?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.errorCard, style]}>
      <IconTile name="wifiOff" bg={colors.dangerBg} fg={colors.danger} size={52} radius={26} iconSize={24} />
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{body}</Text>
      <PillButton title="Retry" variant="dark" icon={retryIcon ? 'refresh' : undefined} height={52} onPress={onRetry} style={styles.selfStretch} />
    </View>
  );
}

export function Toast({ message }: { message: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [text, setText] = useState(message);
  useEffect(() => {
    if (message) setText(message);
    Animated.timing(anim, { toValue: message ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [anim, message]);
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
      <IconTile name="check" bg={colors.limeBright} fg={colors.ink} size={20} radius={10} iconSize={12} stroke={3.6} />
      <Text style={styles.toastText}>{text}</Text>
    </Animated.View>
  );
}

// ---------- Inputs ----------

/** White card with a round icon, title, body and an optional action (empty / blocked states). */
export function EmptyCard({ icon, tone = 'lime', title, body, centered = false, children }: { icon: IconName; tone?: 'lime' | 'muted'; title: string; body: string; centered?: boolean; children?: ReactNode }) {
  const lime = tone === 'lime';
  return (
    <View style={[styles.emptyCard, centered && styles.centerText]}>
      <IconTile name={icon} bg={lime ? colors.pale : colors.chip} fg={lime ? colors.greenText : colors.muted} size={48} radius={24} stroke={2.6} />
      <View style={[styles.gap4, centered && styles.centerText]}>
        <Text style={[styles.emptyTitle, centered && styles.textCenter]}>{title}</Text>
        <Text style={[styles.body14, centered && styles.textCenter]}>{body}</Text>
      </View>
      {children}
    </View>
  );
}

/** Small "i" note: a lime callout or a muted footnote. */
export function InfoNote({ text, tone = 'plain' }: { text: string; tone?: 'lime' | 'plain' }) {
  const lime = tone === 'lime';
  return (
    <View style={lime ? styles.noteLime : styles.notePlain}>
      <Icon name="info" size={lime ? 16 : 14} color={lime ? colors.greenDark : colors.muted2} />
      <Text style={[styles.noteText, lime && styles.noteTextLime]}>{text}</Text>
    </View>
  );
}
