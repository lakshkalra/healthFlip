import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  TextInput,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { formatNumber, formatTime, mealCalories, type MealType } from './meals';
import type { Meal } from './types';

// ---------- Theme ----------

export const colors = {
  ink: '#1c1f1a',
  bg: '#f5f7f1',
  white: '#ffffff',
  lime: '#d9f0a8',
  limeBright: '#b7e36a',
  primary: '#9fd34a',
  green: '#7fbf2a',
  greenDark: '#3d5a12',
  greenMid: '#5a8a17',
  greenText: '#4f7a14',
  greenSoft: '#4c6a1c',
  pale: '#e4f4c6',
  selected: '#f2fadf',
  muted: '#5c6157',
  muted2: '#7a7f73',
  faint: '#a3a79c',
  disabled: '#b4b8ad',
  chip: '#f0f2ec',
  ring: '#d5d9cd',
  handle: '#dfe2d8',
  dashed: '#cfd6c3',
  danger: '#c4452f',
  dangerText: '#b23b26',
  dangerBg: '#fde6dc',
  dangerInk: '#7a2a1a',
  over: '#ef8a3c',
  overText: '#9a4210',
  protein: '#8a63d2',
  proteinBg: '#ece4fb',
  carbs: '#e3a12f',
  carbsBg: '#fdeccc',
  fat: '#3a86d1',
  fatBg: '#dcecfb',
};

export const mealTypeStyle: Record<MealType, { bg: string; fg: string; icon: IconName }> = {
  breakfast: { bg: colors.carbsBg, fg: '#c27a12', icon: 'sun' },
  lunch: { bg: colors.pale, fg: colors.greenMid, icon: 'utensils' },
  snacks: { bg: colors.fatBg, fg: '#2f72b5', icon: 'apple' },
  dinner: { bg: colors.proteinBg, fg: '#7650c4', icon: 'moon' },
};

// ---------- Icons (Lucide paths from the design) ----------

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

const CALENDAR = 'M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z';

const ICONS = {
  alert: [circle(12, 12, 10), 'M12 8v4', 'M12 16h.01'],
  apple: ['M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z', 'M10 2c1 .5 2 2 2 5'],
  arrowLeft: ['m12 19-7-7 7-7', 'M19 12H5'],
  arrowRight: ['M5 12h14M12 5l7 7-7 7'],
  calendarCheck: [CALENDAR, 'M3 10h18', 'm9 16 2 2 4-4'],
  calendarX: [CALENDAR, 'M3 10h18', 'm14 14-4 4M10 14l4 4'],
  camera: ['M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', circle(12, 13, 3.5)],
  chart: ['M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3'],
  check: ['M20 6 9 17l-5-5'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  clock: [circle(12, 12, 10), 'M12 6v6l4 2'],
  close: ['M18 6 6 18M6 6l12 12'],
  droplet: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  equals: ['M5 9h14', 'M5 15h14'],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  gift: ['M4 8h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C9 3 11 5 12 8c1-3 3-5 4.5-5a2.5 2.5 0 0 1 0 5'],
  info: [circle(12, 12, 10), 'M12 16v-4M12 8h.01'],
  home: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  leaf: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
  lightbulb: ['M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4'],
  image: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', circle(8.5, 8.5, 1.5), 'm22 16-5-5L6 22'],
  mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3M8 22h8'],
  minus: ['M5 12h14'],
  nutrition: ['M12 6.528V3a1 1 0 0 1 1-1M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  message: ['M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8.4 8.4 0 0 1-3.3-.67L4 20l1.67-4.2A7.5 7.5 0 1 1 20 11.5Z'],
  pencil: ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'],
  plus: ['M5 12h14M12 5v14'],
  refresh: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5'],
  repeat: ['m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3'],
  search: [circle(11, 11, 8), 'm21 21-4.3-4.3'],
  target: [circle(12, 12, 10), circle(12, 12, 6), circle(12, 12, 2)],
  sun: [circle(12, 12, 4), 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'],
  trash: ['M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  trendDown: ['M22 17 13.5 8.5 8.5 13.5 2 7', 'M16 17h6v-6'],
  trendUp: ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', circle(12, 7, 4)],
  utensils: ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'],
  wifiOff: ['M12 20h.01', 'M8.5 16.429a5 5 0 0 1 7 0', 'M5 12.859a10 10 0 0 1 5.17-2.69', 'M19 12.859a10 10 0 0 0-2.007-1.523', 'M2 8.82a15 15 0 0 1 4.177-2.643', 'M22 8.82a15 15 0 0 0-11.288-3.764', 'm2 2 20 20'],
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color = colors.ink, stroke = 2.4 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map(d => <Path key={d} d={d} />)}
    </Svg>
  );
}

/** Rounded square / circle holding an icon. */
export function IconTile({ name, bg, fg, size = 44, radius = 14, iconSize = 22, stroke }: { name: IconName; bg: string; fg: string; size?: number; radius?: number; iconSize?: number; stroke?: number }) {
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: radius, backgroundColor: bg }]}>
      <Icon name={name} size={iconSize} color={fg} stroke={stroke} />
    </View>
  );
}

export function MealTypeTile({ type, size = 44, radius = 14, iconSize = 22 }: { type: MealType; size?: number; radius?: number; iconSize?: number }) {
  const { bg, fg, icon } = mealTypeStyle[type];
  return <IconTile name={icon} bg={bg} fg={fg} size={size} radius={radius} iconSize={iconSize} />;
}

export function RoundIconButton({ name, onPress, label, bg = colors.white, size = 44, iconSize = 19, stroke = 2.4, busy = false }: { name: IconName; onPress?: () => void; label: string; bg?: string; size?: number; iconSize?: number; stroke?: number; busy?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={busy || !onPress} onPress={onPress} style={({ pressed }) => [styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: pressed ? colors.pale : bg }]}>
      {busy ? <Spinner color={colors.greenMid} /> : <Icon name={name} size={iconSize} stroke={stroke} />}
    </Pressable>
  );
}

export function Spinner({ color = colors.ink }: { color?: string }) {
  return <ActivityIndicator size="small" color={color} />;
}

// ---------- Buttons ----------

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

/** Soft input shell with error border, shared by goal target, food, calories, macros. */
export function InputShell({ error, style, children }: { error?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[styles.inputShell, error && styles.inputShellError, style]}>{children}</View>;
}

export function NumberInput(props: TextInputProps) {
  return <TextInput keyboardType="number-pad" placeholderTextColor={colors.faint} {...props} style={[styles.input, props.style]} />;
}

// ---------- Progress ----------

const RING_C = 314.16;

export function ProgressRing({ consumed, target }: { consumed: number; target: number }) {
  const remaining = target - consumed;
  const over = remaining < 0;
  const dash = (fraction: number) => `${Math.min(Math.max(fraction, 0), 1) * RING_C} ${RING_C}`;
  return (
    <View style={styles.ring}>
      <Svg width={112} height={112} viewBox="0 0 120 120">
        <Circle cx={60} cy={60} r={50} fill="rgba(255,255,255,.7)" stroke="rgba(255,255,255,.7)" strokeWidth={12} />
        <Circle cx={60} cy={60} r={50} fill="none" stroke={colors.green} strokeWidth={12} strokeLinecap="round" strokeDasharray={dash(consumed / target)} transform="rotate(-90 60 60)" />
        {over ? <Circle cx={60} cy={60} r={50} fill="none" stroke={colors.over} strokeWidth={12} strokeLinecap="round" strokeDasharray={dash(-remaining / target)} transform="rotate(-90 60 60)" /> : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.ringNum}>{Math.abs(remaining).toLocaleString('en-US')}</Text>
        <Text style={[styles.ringLabel, over && styles.ringLabelOver]}>{over ? 'kcal over' : 'kcal left'}</Text>
      </View>
    </View>
  );
}

export function MacroBar({ label, value, target, color, track }: { label: string; value: number; target: number; color: string; track: string }) {
  const width = `${Math.min(100, Math.round((value / target) * 100))}%` as const;
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {value}
        <Text style={styles.macroUnit}> / {target} g</Text>
      </Text>
      <View style={[styles.macroTrack, { backgroundColor: track }]}>
        <View style={[styles.macroFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ---------- Overlays ----------

/** Animated overlay: a bottom sheet (`sheet`) or a floating card (`dialog`). Stays mounted until the close animation ends. */
export function Overlay({ visible, onClose, variant = 'sheet', children }: { visible: boolean; onClose: () => void; variant?: 'sheet' | 'dialog'; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

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
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[StyleSheet.absoluteFill, variant === 'sheet' ? styles.scrimSheet : styles.scrimDialog, { opacity: anim }]}>
          <Pressable accessibilityLabel="Close" style={styles.flex} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[variant === 'sheet' ? styles.sheet : styles.dialog, { transform: [{ translateY }] }]}>{children}</Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ---------- Shared screen pieces ----------

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

/** Visual on/off switch; the parent row handles the press. */
export function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, on && styles.toggleOn]}>
      <View style={[styles.toggleKnob, on && styles.toggleKnobOn]} />
    </View>
  );
}

/** Meals of one type. Pass onOpenMeal / onAdd for the interactive dashboard, omit them for read-only history. */
export function MealGroupCard({ type, label, meals, onOpenMeal, onAdd, emptyLabel }: { type: MealType; label: string; meals: Meal[]; onOpenMeal?: (meal: Meal) => void; onAdd?: () => void; emptyLabel?: string }) {
  if (!meals.length) {
    return onAdd ? (
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.emptyGroup, pressed && styles.whiteBg]}>
        <MealTypeTile type={type} />
        <View style={styles.grow}>
          <Text style={styles.groupTitle}>{label}</Text>
          <Text style={styles.small}>{emptyLabel}</Text>
        </View>
        <IconTile name="plus" bg={colors.limeBright} fg={colors.ink} size={36} radius={18} iconSize={18} stroke={2.6} />
      </Pressable>
    ) : (
      <View style={styles.emptyGroup}>
        <Text style={[styles.groupTitle, styles.grow, { color: colors.muted }]}>{label}</Text>
        <Text style={styles.mealTime}>Not logged</Text>
      </View>
    );
  }
  return (
    <Card style={onOpenMeal ? styles.gap8 : styles.gap6}>
      <View style={styles.rowCenter12}>
        <MealTypeTile type={type} />
        <View style={styles.grow}>
          <Text style={styles.groupTitle}>{label}</Text>
          <Text style={styles.small}>
            {formatNumber(mealCalories(meals))} kcal · {meals.length} {meals.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        {onAdd ? <RoundIconButton name="plus" label={`Add to ${label}`} bg={colors.bg} size={36} iconSize={18} stroke={2.6} onPress={onAdd} /> : null}
      </View>
      <View style={styles.mealList}>
        {meals.map(meal => (
          <Pressable key={meal.id} disabled={!onOpenMeal} onPress={() => onOpenMeal?.(meal)} style={({ pressed }) => [styles.mealRow, !onOpenMeal && styles.mealRowStatic, pressed && { backgroundColor: colors.bg }]}>
            <View style={styles.grow}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealTime}>{formatTime(meal.loggedAt)}</Text>
            </View>
            <Text style={styles.mealCal}>{formatNumber(meal.caloriesKcal ?? 0)} kcal</Text>
            {onOpenMeal ? <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} /> : null}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

// ---------- Small layout helpers ----------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  // shared screen pieces
  grow: { flex: 1, gap: 2, minWidth: 0 },
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  rowCenter12: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  whiteBg: { backgroundColor: colors.white },
  centerText: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  spacer44: { width: 44 },
  small: { color: colors.muted, fontSize: 13 },
  body14: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  headline: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  screenTitle: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 31 },
  /** Scroll content for a tab screen that sits above the bottom nav. */
  tabContent: { gap: 14, paddingBottom: 124, paddingHorizontal: 18 },
  backHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  emptyCard: { backgroundColor: colors.white, borderRadius: 28, gap: 14, paddingHorizontal: 20, paddingVertical: 24 },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  noteLime: { backgroundColor: colors.pale, borderRadius: 18, flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  notePlain: { flexDirection: 'row', gap: 8, paddingHorizontal: 6, paddingVertical: 4 },
  noteText: { color: colors.muted2, flex: 1, fontSize: 12, lineHeight: 17 },
  noteTextLime: { color: colors.greenDark, fontSize: 13, lineHeight: 18 },
  toggle: { backgroundColor: colors.ring, borderRadius: 99, height: 26, padding: 3, width: 42 },
  toggleOn: { backgroundColor: colors.green },
  toggleKnob: { backgroundColor: colors.white, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.2)', height: 20, width: 20 },
  toggleKnobOn: { transform: [{ translateX: 16 }] },
  groupTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  emptyGroup: { alignItems: 'center', borderColor: colors.dashed, borderRadius: 24, borderStyle: 'dashed', borderWidth: 1.5, flexDirection: 'row', gap: 12, padding: 16 },
  mealList: { gap: 2, paddingLeft: 46 },
  mealRow: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  mealRowStatic: { paddingVertical: 7 },
  mealName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  mealTime: { color: colors.muted2, fontSize: 12 },
  mealCal: { color: '#3f443a', fontSize: 14, fontWeight: '600' },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  selfStretch: { alignSelf: 'stretch', marginTop: 6 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 10 },
  pill: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  pillText: { fontSize: 16, fontWeight: '700' },
  pillTextSmall: { fontSize: 15 },
  glow: { boxShadow: '0 8px 18px rgba(127,191,42,.35)' },
  busy: { opacity: 0.6 },
  banner: { backgroundColor: colors.dangerBg, borderRadius: 18, flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  bannerAction: { alignItems: 'center', paddingVertical: 10, paddingRight: 10 },
  bannerText: { color: colors.dangerInk, flex: 1, fontSize: 13, lineHeight: 18 },
  bannerRetry: { backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 },
  bannerRetryText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  fieldError: { color: colors.dangerText, fontSize: 13, fontWeight: '600' },
  fieldErrorSmall: { fontSize: 12 },
  errorCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 28, gap: 12, padding: 24 },
  errorTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  errorBody: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  toast: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.ink, borderRadius: 99, flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, position: 'absolute', zIndex: 80 },
  toastText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  inputShell: { alignItems: 'center', backgroundColor: colors.bg, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', flexDirection: 'row', height: 52, paddingHorizontal: 16 },
  inputShellError: { borderColor: colors.danger },
  input: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '700', minWidth: 0, padding: 0 },
  ring: { height: 112, width: 112 },
  ringNum: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  ringLabel: { color: colors.greenDark, fontSize: 11, fontWeight: '600' },
  ringLabelOver: { color: colors.overText, fontWeight: '700' },
  scrimSheet: { backgroundColor: 'rgba(28,31,26,.38)' },
  scrimDialog: { backgroundColor: 'rgba(28,31,26,.42)' },
  macro: { backgroundColor: 'rgba(255,255,255,.75)', borderRadius: 16, flex: 1, gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  macroLabel: { color: colors.muted, fontSize: 12 },
  macroValue: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  macroUnit: { color: colors.muted, fontSize: 11, fontWeight: '500' },
  macroTrack: { borderRadius: 9, height: 5, overflow: 'hidden' },
  macroFill: { borderRadius: 9, height: '100%' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, bottom: 0, left: 0, maxHeight: '91%', position: 'absolute', right: 0 },
  dialog: { backgroundColor: colors.white, borderRadius: 32, bottom: 30, gap: 12, left: 14, paddingBottom: 20, paddingHorizontal: 22, paddingTop: 24, position: 'absolute', right: 14 },
});
