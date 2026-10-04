import { StyleSheet, Text, View } from 'react-native';
import { ErrorCard, IconTile, Spinner } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { BootState } from '../../app/types';

export function BootScreen({ state, onRetry }: { state: BootState; onRetry: () => void }) {
  const status = (text: string) => (
    <View style={screen.bootStatus}>
      <Spinner color={colors.greenDark} />
      <Text style={screen.bootStatusText}>{text}</Text>
    </View>
  );
  return (
    <View style={screen.boot}>
      <View style={screen.bootBrand}>
        <IconTile name="leaf" bg={colors.ink} fg={colors.limeBright} size={88} radius={30} iconSize={42} />
        <Text style={screen.wordmark}>
          health<Text style={{ color: colors.greenText }}>Flip</Text>
        </Text>
      </View>
      {state === 'loading' ? status('Getting things ready…') : null}
      {state === 'first' || state === 'returning' ? (
        <View style={screen.bootGreeting}>
          <Text style={screen.bootTitle}>{state === 'first' ? "Welcome! Glad you're here." : 'Welcome back'}</Text>
          {status(state === 'first' ? "Let's set your daily goal" : 'Loading your day…')}
        </View>
      ) : null}
      {state === 'error' ? (
        <ErrorCard title="We can't reach healthFlip" body="Your data is safe on this device. Check your connection and try again." onRetry={onRetry} retryIcon style={screen.fullWidth} />
      ) : null}
    </View>
  );
}

// ---------- Page 1 · Goal setup ----------

const screen = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  boot: { alignItems: 'center', flex: 1, gap: 26, justifyContent: 'center', paddingHorizontal: 36 },
  bootBrand: { alignItems: 'center', gap: 16 },
  wordmark: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -0.6 },
  bootGreeting: { alignItems: 'center', gap: 10 },
  bootTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  bootStatus: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  bootStatusText: { color: colors.greenDark, fontSize: 15, fontWeight: '600' },
});
