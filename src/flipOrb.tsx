import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

// Lightweight native orb. Keeping the orb in regular native views avoids shipping a
// large GPU drawing runtime solely for this decorative visualizer.
export type OrbPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

const COLORS = ['#8cc23a', '#6fbf3a', '#5cc8a8', '#e0b93a'];
const DOT_COUNT = 18;

type ParticleOrbProps = {
  height: number;
  width: number;
  level?: SharedValue<number>;
  mini?: boolean;
  muted?: boolean;
  phase?: OrbPhase;
  pulse?: SharedValue<number>;
};

function Dot({ index, size, level, muted, phase, pulse }: { index: number; size: number; level: SharedValue<number>; muted: boolean; phase: OrbPhase; pulse: SharedValue<number> }) {
  const angle = (index / DOT_COUNT) * Math.PI * 2;
  const distance = size * (0.24 + (index % 3) * 0.035);
  const phaseOffset = useSharedValue(0);
  useEffect(() => {
    phaseOffset.value = withRepeat(withTiming(Math.PI * 2, { duration: phase === 'thinking' ? 1100 : 2200 }), -1, false);
  }, [phase, phaseOffset]);
  const style = useAnimatedStyle(() => {
    const motion = phaseOffset.value + angle;
    const energy = Math.max(level.value, pulse.value * 0.6);
    const radius = distance * (1 + energy * (phase === 'speaking' ? 0.55 : 0.25));
    return {
      opacity: muted ? 0.28 : 0.35 + energy * 0.6,
      transform: [
        { translateX: Math.cos(motion) * radius },
        { translateY: Math.sin(motion) * radius * 0.72 },
        { scale: 0.75 + energy * 0.8 + (phase === 'speaking' ? Math.sin(motion * 2) * 0.12 : 0) },
      ],
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: muted ? '#8f948a' : COLORS[index % COLORS.length], height: size * 0.075, width: size * 0.075 }, style]} />;
}

export function ParticleOrb({ height, level, mini = false, muted = false, phase = 'idle', pulse, width }: ParticleOrbProps) {
  const ownLevel = useSharedValue(0);
  const ownPulse = useSharedValue(0);
  const levelValue = level ?? ownLevel;
  const pulseValue = pulse ?? ownPulse;
  const size = Math.min(width, height);
  const dots = useMemo(() => Array.from({ length: mini ? 10 : DOT_COUNT }, (_, index) => index), [mini]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: muted ? 0.25 : 0.45 + Math.max(levelValue.value, pulseValue.value) * 0.35,
    transform: [{ scale: 0.9 + Math.max(levelValue.value, pulseValue.value) * 0.3 }],
  }));
  return (
    <View pointerEvents="none" style={{ height, width }}>
      <Animated.View style={[styles.halo, { height: size * 0.72, width: size * 0.72 }, haloStyle]} />
      <View style={styles.center}>
        {dots.map(index => <Dot key={index} index={index} size={size} level={levelValue} muted={muted} phase={phase} pulse={pulseValue} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  dot: { borderRadius: 99, position: 'absolute' },
  halo: { alignSelf: 'center', backgroundColor: '#b7e36a', borderRadius: 999, opacity: 0.5 },
});
