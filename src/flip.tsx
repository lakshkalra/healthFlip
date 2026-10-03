import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type HostInstance } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ParticleOrb } from './flipOrb';
import { colors } from './ui';

export type RevealOrigin = { x: number; y: number };

const REVEAL_MS = 550;
const START_RADIUS = 22;

/** Home entry point (spec §2): white pill with a live mini orb. Reports the orb centre for the reveal. */
export function AskFlipPill({ bottom, onPress }: { bottom: number; onPress: (origin: RevealOrigin) => void }) {
  const orbRef = useRef<HostInstance>(null);
  const { height, width } = useWindowDimensions();

  const press = () => {
    const fallback = { x: width - 16 - 24, y: height - bottom - 24 };
    const orb = orbRef.current;
    if (!orb?.measureInWindow) return onPress(fallback);
    orb.measureInWindow((x, y, w, h) => onPress(Number.isFinite(x) && w > 0 ? { x: x + w / 2, y: y + h / 2 } : fallback));
  };

  return (
    <Pressable accessibilityLabel="Ask Flip" accessibilityRole="button" onPress={press} style={({ pressed }) => [styles.pill, { bottom }, pressed && styles.pillPressed]}>
      <View ref={orbRef} style={styles.pillOrb}>
        <ParticleOrb width={34} height={34} mini />
      </View>
      <Text style={styles.pillLabel}>Ask Flip</Text>
    </Pressable>
  );
}

/**
 * Circular reveal from `origin` (spec §2: clip-path circle, 550ms, cubic-bezier(.6,0,.2,1)).
 * A growing rounded container clips a full-screen child that is counter-offset to stay still.
 */
export function FlipReveal({ children, instantClose = false, onClosed, open, origin }: { children: ReactNode; instantClose?: boolean; onClosed?: () => void; open: boolean; origin: RevealOrigin }) {
  const { height, width } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(open);
  const maxRadius = Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y)) + 8;

  useEffect(() => {
    const easing = Easing.bezier(0.6, 0, 0.2, 1);
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, { duration: REVEAL_MS, easing });
      return;
    }
    if (instantClose) {
      progress.value = 0;
      setMounted(false);
      onClosed?.();
      return;
    }
    progress.value = withTiming(0, { duration: REVEAL_MS, easing });
    const timer = setTimeout(() => {
      setMounted(false);
      onClosed?.();
    }, REVEAL_MS + 20);
    return () => clearTimeout(timer);
    // onClosed is a completion notification; re-running on its identity would restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instantClose, open, progress]);

  const clipStyle = useAnimatedStyle(() => {
    const r = START_RADIUS + (maxRadius - START_RADIUS) * progress.value;
    return { borderRadius: r, height: r * 2, left: origin.x - r, top: origin.y - r, width: r * 2 };
  });
  const contentStyle = useAnimatedStyle(() => {
    const r = START_RADIUS + (maxRadius - START_RADIUS) * progress.value;
    return { left: r - origin.x, top: r - origin.y };
  });

  if (!mounted) return null;
  return (
    <Animated.View style={[styles.clip, clipStyle]}>
      <Animated.View style={[styles.revealContent, { height, width }, contentStyle]}>{children}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 24, boxShadow: '0 8px 22px rgba(28,31,26,.14)', flexDirection: 'row', gap: 8, height: 48, paddingLeft: 7, paddingRight: 16, position: 'absolute', right: 16 },
  pillPressed: { transform: [{ scale: 0.97 }] },
  pillOrb: { alignItems: 'center', backgroundColor: colors.selected, borderRadius: 17, height: 34, justifyContent: 'center', overflow: 'hidden', width: 34 },
  pillLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  clip: { overflow: 'hidden', position: 'absolute' },
  revealContent: { position: 'absolute' },
});
