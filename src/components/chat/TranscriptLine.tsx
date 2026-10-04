import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';

export type ChatRole = 'flip' | 'user';

/**
 * One chat line in Flip's style: Flip speaks without a bubble, the user in a dark bubble. The newest
 * line types in character by character with a caret; older lines render in full. Shared by the
 * voice agent and onboarding chat.
 */
export function TranscriptLine({ animate, role, text }: { animate: boolean; role: ChatRole; text: string }) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate || shown >= text.length) {
      if (!animate && shown !== text.length) setShown(text.length);
      return;
    }
    // Catch up faster when a long fragment lands so streaming text never lags far behind.
    const timer = setTimeout(() => setShown(count => Math.min(text.length, count + Math.max(1, Math.ceil((text.length - count) / 14)))), 28);
    return () => clearTimeout(timer);
  }, [animate, shown, text.length]);

  const user = role === 'user';
  const typing = animate && shown < text.length;
  return (
    <View style={user ? styles.userBubble : styles.flipLine} accessible accessibilityLabel={text}>
      <Text style={user ? styles.userText : styles.flipText}>
        {text.slice(0, shown)}
        {typing ? <View style={[styles.caret, user ? styles.userCaret : styles.flipCaret]} /> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flipLine: { alignSelf: 'flex-start', maxWidth: '92%' },
  flipText: { color: colors.ink, fontSize: 20, fontWeight: '600', lineHeight: 27.6 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.ink, borderBottomLeftRadius: 22, borderBottomRightRadius: 6, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxWidth: '82%', paddingHorizontal: 16, paddingVertical: 11 },
  userText: { color: colors.white, fontSize: 16, fontWeight: '500', lineHeight: 22 },
  caret: { marginLeft: 2, width: 2 },
  flipCaret: { backgroundColor: colors.green, height: 20 },
  userCaret: { backgroundColor: colors.limeBright, height: 16 },
});
