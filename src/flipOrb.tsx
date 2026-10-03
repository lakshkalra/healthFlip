import { useEffect, useMemo } from 'react';
import { Canvas, Picture, Skia, TileMode, createPicture } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

// Particle orb from the Flip agent spec (§8): points on a sphere, depth-sorted and redrawn every
// frame on the UI thread. Amplitude follows mic level while listening and word pulses while speaking.

export type OrbPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

const PHASE_CODE: Record<OrbPhase, number> = { idle: 0, listening: 1, thinking: 2, speaking: 3 };
const DOT_COLORS = ['#8cc23a', '#6fbf3a', '#5cc8a8', '#e0b93a'];
const MUTED_DOT = '#8f948a';

type Particle = { c: number; k: number; ph: number; sp: number; th: number };

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    c: Math.floor(Math.random() * 4),
    k: Math.random() * Math.PI * 2,
    ph: Math.acos(2 * Math.random() - 1),
    sp: 0.6 + Math.random() * 0.8,
    th: Math.random() * Math.PI * 2,
  }));
}

type ParticleOrbProps = {
  height: number;
  width: number;
  /** Mic level 0..1, read while listening. */
  level?: SharedValue<number>;
  /** Mini renders only the idle orb (Ask Flip pill). */
  mini?: boolean;
  muted?: boolean;
  phase?: OrbPhase;
  /** Set to 1 on each spoken word; decays on the UI thread. */
  pulse?: SharedValue<number>;
};

export function ParticleOrb({ height, level, mini = false, muted = false, phase = 'idle', pulse, width }: ParticleOrbProps) {
  const particles = useMemo(() => makeParticles(mini ? 90 : 240), [mini]);
  const phaseCode = useSharedValue(PHASE_CODE[phase]);
  const mutedFlag = useSharedValue(muted ? 1 : 0);
  const ownLevel = useSharedValue(0);
  const ownPulse = useSharedValue(0);
  const levelValue = level ?? ownLevel;
  const pulseValue = pulse ?? ownPulse;
  const time = useSharedValue(0);
  const rot = useSharedValue(0);
  const amp = useSharedValue(0.07);

  useEffect(() => { phaseCode.value = PHASE_CODE[phase]; }, [phase, phaseCode]);
  useEffect(() => { mutedFlag.value = muted ? 1 : 0; }, [muted, mutedFlag]);

  const frame = useFrameCallback(info => {
    const dt = Math.min((info.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    const t = time.value + dt;
    const code = phaseCode.value;
    pulseValue.value *= Math.pow(0.03, dt);
    let target = 0.07 * (0.6 + 0.4 * Math.sin(t * 1.6));
    if (code === 1) target = Math.max(0.05, levelValue.value);
    else if (code === 2) target = 0.12;
    else if (code === 3) target = 0.28 + pulseValue.value * 0.45 + Math.sin(t * 26) * 0.05;
    amp.value += (target - amp.value) * Math.min(1, dt * 10);
    rot.value += dt * (code === 2 ? 3.4 : code === 3 ? 1.2 : 0.5);
    time.value = t;
  }, true);

  // Muted freezes the animation loop (spec §4); the derived picture still redraws in greyscale.
  useEffect(() => { frame.setActive(!muted); }, [frame, muted]);

  const picture = useDerivedValue(() => createPicture(canvas => {
    const t = time.value;
    const a = amp.value;
    const code = phaseCode.value;
    const isMuted = mutedFlag.value === 1;
    const think = code === 2;
    const cx = width / 2;
    const cy = height / 2;
    const base = mini ? Math.min(width, height) * 0.36 : 56;
    const R = base * (1 + a * 0.3);

    const halo = Skia.Paint();
    const haloAlpha = (0.4 + a * 0.3) * (isMuted ? 0.45 : 1);
    const haloRgb = isMuted ? [0.62, 0.64, 0.6] : [183 / 255, 227 / 255, 106 / 255];
    halo.setShader(Skia.Shader.MakeRadialGradient(
      Skia.Point(cx, cy),
      R * 1.3,
      [Skia.Color(`rgba(${Math.round(haloRgb[0] * 255)},${Math.round(haloRgb[1] * 255)},${Math.round(haloRgb[2] * 255)},${haloAlpha})`), Skia.Color('rgba(183,227,106,0)')],
      null,
      TileMode.Clamp,
    ));
    canvas.drawCircle(cx, cy, R * 1.3, halo);

    const n = particles.length;
    const xs = new Array<number>(n);
    const ys = new Array<number>(n);
    const zs = new Array<number>(n);
    const order = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      const th = p.th + rot.value * p.sp * (think ? 1.6 : 1);
      const jig = Math.sin(t * 4 + p.k) * a * 0.35 + (code === 1 ? Math.sin(t * 9 + p.k * 3) * a * 0.2 : 0);
      const r = R * (think ? 0.72 : 0.95) * (1 + a * 0.45 + jig);
      zs[i] = Math.sin(p.ph) * Math.sin(th);
      xs[i] = cx + r * Math.sin(p.ph) * Math.cos(th);
      ys[i] = cy + r * Math.cos(p.ph) * 0.92;
      order[i] = i;
    }
    order.sort((x, y) => zs[x] - zs[y]);

    const dot = Skia.Paint();
    dot.setAntiAlias(true);
    const palette = (isMuted ? [MUTED_DOT, MUTED_DOT, MUTED_DOT, MUTED_DOT] : DOT_COLORS).map(hex => Skia.Color(hex));
    const scale = Math.min(1, Math.max(0.35, R / 56));
    for (let j = 0; j < n; j++) {
      const i = order[j];
      const z = zs[i];
      dot.setColor(palette[particles[i].c]);
      dot.setAlphaf((0.3 + 0.7 * (z + 1) / 2) * (isMuted ? 0.45 : 1));
      canvas.drawCircle(xs[i], ys[i], (1 + (z + 1) * 1.1) * scale, dot);
    }
  }, { height, width }));

  return (
    <Canvas style={{ height, width }} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
