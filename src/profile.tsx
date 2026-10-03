import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteMemory, getMemories, saveProfile } from './api/client';
import { ProfileForm } from './onboarding';
import type { Memory, MemoryCategory, Profile } from './types';
import { BackHeader, Banner, Card, Icon, IconTile, PillButton, Spinner, colors, type IconName } from './ui';

const CATEGORY_ICON: Record<MemoryCategory, IconName> = {
  allergy: 'alert',
  diet: 'leaf',
  goal: 'target',
  other: 'message',
  preference: 'utensils',
  routine: 'clock',
};

type Props = {
  onBack: () => void;
  onProfileSaved: (profile: Profile) => void;
  onOpenReports: () => void;
  onRecalculate: () => void;
  onReset: () => void;
  profile: Profile | null;
};

/** Your details plus everything Flip has chosen to remember, each deletable. */
export function ProfileScreen({ onBack, onOpenReports, onProfileSaved, onRecalculate, onReset, profile }: Props) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryState, setMemoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setMemoryState('loading');
    try {
      setMemories(await getMemories());
      setMemoryState('ready');
    } catch {
      setMemoryState('error');
    }
  }, []);

  useEffect(() => { loadMemories().catch(() => undefined); }, [loadMemories]);

  const forget = async (memory: Memory) => {
    setDeleting(memory.id);
    try {
      await deleteMemory(memory.id);
      setMemories(current => current.filter(item => item.id !== memory.id));
    } catch {
      setMemoryState('error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}><BackHeader title="You & Flip" onBack={onBack} /></View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Your details</Text>
        <ProfileForm
          initial={profile}
          submitLabel="Save details"
          onSubmit={async next => {
            onProfileSaved(await saveProfile(next));
            setSaved(true);
          }}
        />
        {saved ? (
          <Card style={styles.recalc}>
            <Text style={styles.body}>Details saved. Want Flip to update your calories and macros to match?</Text>
            <PillButton title="Recalculate my plan" variant="dark" height={46} onPress={onRecalculate} />
          </Card>
        ) : null}

        <Text style={styles.section}>What Flip remembers</Text>
        <Text style={styles.small}>Flip saves short facts you share in conversation, like foods you avoid or your routine. Conversations themselves are never stored.</Text>
        {memoryState === 'loading' ? <View style={styles.loading}><Spinner color={colors.greenDark} /></View> : null}
        {memoryState === 'error' ? <Banner message="Couldn’t load memories." onRetry={loadMemories} /> : null}
        {memoryState === 'ready' && !memories.length ? (
          <Card style={styles.empty}><Text style={styles.body}>Nothing yet. Tell Flip things like “I’m vegetarian” or “I go to the gym at 7am”.</Text></Card>
        ) : null}
        {memoryState === 'ready' && memories.length ? (
          <Card style={styles.list}>
            {memories.map((memory, index) => (
              <View key={memory.id} style={[styles.memory, index > 0 && styles.divider]}>
                <IconTile name={CATEGORY_ICON[memory.category]} bg={colors.pale} fg={colors.greenDark} size={36} radius={12} iconSize={17} />
                <Text style={styles.memoryText}>{memory.text}</Text>
                <Pressable accessibilityLabel={`Forget: ${memory.text}`} accessibilityRole="button" disabled={deleting === memory.id} hitSlop={8} onPress={() => forget(memory)} style={styles.forget}>
                  {deleting === memory.id ? <Spinner color={colors.muted} /> : <Icon name="trash" size={18} color={colors.muted} />}
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Text style={styles.section}>Health reports</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Open health reports" onPress={onOpenReports} style={({ pressed }) => [styles.reset, pressed && styles.linkPressed]}>
          <IconTile name="chart" bg={colors.pale} fg={colors.greenDark} size={36} radius={12} iconSize={17} />
          <View style={styles.flex}>
            <Text style={styles.linkTitle}>Your lab reports</Text>
            <Text style={styles.small}>Upload, review or delete the reports Flip uses for your meals.</Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} />
        </Pressable>

        <Text style={styles.section}>Start over</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset healthFlip data" onPress={onReset} style={({ pressed }) => [styles.reset, pressed && styles.resetPressed]}>
          <IconTile name="refresh" bg={colors.dangerBg} fg={colors.dangerText} size={36} radius={12} iconSize={17} />
          <View style={styles.flex}>
            <Text style={styles.resetTitle}>Reset healthFlip</Text>
            <Text style={styles.small}>Deletes your goal, meals, profile, memories, reports and plans, and turns off reminders.</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  header: { paddingHorizontal: 20 },
  content: { gap: 14, paddingHorizontal: 20, paddingTop: 12 },
  section: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 10 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  recalc: { gap: 12, padding: 16 },
  loading: { alignItems: 'center', paddingVertical: 16 },
  empty: { padding: 16 },
  list: { paddingHorizontal: 14, paddingVertical: 4 },
  memory: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 12 },
  divider: { borderTopColor: colors.chip, borderTopWidth: 1 },
  memoryText: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: '600' },
  flex: { flex: 1 },
  reset: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, flexDirection: 'row', gap: 12, padding: 14 },
  resetPressed: { backgroundColor: colors.dangerBg },
  linkPressed: { opacity: 0.75 },
  linkTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  resetTitle: { color: colors.dangerText, fontSize: 15, fontWeight: '800' },
  forget: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
});
