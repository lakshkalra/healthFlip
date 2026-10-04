import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { styles } from './styles';
import { colors } from '../../constants/theme';

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
