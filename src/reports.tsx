import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteReport, extractReport, getReport, listReports, saveReport, setWaterTarget } from './api/client';
import { ParticleOrb } from './flipOrb';
import { chooseReportPages } from './media';
import { formatLitres } from './reminders';
import type { HealthReport, ReportDraft, ReportFlag, ReportSummary, ReportValue } from './types';
import { BackHeader, Banner, Card, Icon, IconTile, PillButton, Spinner, colors, type IconName } from './ui';

type View_ =
  | { screen: 'list' }
  | { screen: 'reading' }
  | { draft: ReportDraft; screen: 'review' }
  | { report: HealthReport; screen: 'detail' };

type Props = {
  /** Opens this report straight away (from the Home "Health" row). */
  initialReportId?: string | null;
  onAskFlip: () => void;
  onClose: () => void;
  onMakePlan: () => void;
  /** After saving: the new report and the water target the user accepted (ml), if any. */
  onSaved: (report: HealthReport, waterTargetMl: number | null) => void;
  onDeleted: () => void;
};

export const NOT_A_DIAGNOSIS = 'Flip explains your results in plain words and compares them with your lab’s own ranges. It isn’t a diagnosis, so please discuss your results with your doctor.';

/** Upload a lab report, review what Flip read, save it, and use it to personalise meals. */
export function ReportsScreen({ initialReportId, onAskFlip, onClose, onDeleted, onMakePlan, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>({ screen: 'list' });
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setListState('loading');
    try {
      setReports(await listReports());
      setListState('ready');
    } catch {
      setListState('error');
    }
  }, []);

  const open = useCallback(async (id: string) => {
    try {
      setView({ report: await getReport(id), screen: 'detail' });
    } catch {
      setError('That report couldn’t be opened. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
    if (initialReportId) open(initialReportId).catch(() => undefined);
  }, [initialReportId, load, open]);

  async function upload(source: 'camera' | 'library' | 'pdf') {
    setError('');
    try {
      const pages = await chooseReportPages(source);
      if (!pages.length) return;
      setView({ screen: 'reading' });
      const draft = await extractReport(pages.map(page => ({ base64: page.base64, mimeType: page.mimeType })));
      setView({ draft, screen: 'review' });
    } catch (failure) {
      setView({ screen: 'list' });
      setError(failure instanceof Error && failure.message ? failure.message : 'Flip couldn’t read that report. Try clearer photos or the original PDF.');
    }
  }

  const backToList = () => {
    setView({ screen: 'list' });
    load().catch(() => undefined);
  };

  if (view.screen === 'reading') {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.orb}><ParticleOrb width={150} height={150} /></View>
        <Text style={styles.title}>Reading your report…</Text>
        <Text style={styles.body}>Flip is finding each value and its lab range. This can take up to a minute.</Text>
      </View>
    );
  }

  if (view.screen === 'review') {
    return (
      <ReviewReport
        draft={view.draft}
        onDiscard={backToList}
        onSaved={(report, water) => {
          onSaved(report, water);
          setView({ report, screen: 'detail' });
          load().catch(() => undefined);
        }}
      />
    );
  }

  if (view.screen === 'detail') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}><BackHeader title={view.report.title} onBack={backToList} /></View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
          <ReportBody report={view.report} />
          <PillButton title="Make a meal plan from this" icon="utensils" height={50} onPress={onMakePlan} />
          <PillButton title="Ask Flip about this" icon="mic" variant="dark" height={50} onPress={onAskFlip} />
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('Delete this report?', 'Flip will stop using it to personalise your meals.', [
              { style: 'cancel', text: 'Cancel' },
              {
                onPress: () => {
                  deleteReport(view.report.id).then(() => { onDeleted(); backToList(); }).catch(() => Alert.alert('Delete failed', 'Check your connection and try again.'));
                },
                style: 'destructive',
                text: 'Delete',
              },
            ])}
            style={styles.delete}
          >
            <Icon name="trash" size={16} color={colors.dangerText} />
            <Text style={styles.deleteText}>Delete report</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}><BackHeader title="Health reports" onBack={onClose} /></View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        <Card style={styles.upload}>
          <View style={styles.row10}>
            <IconTile name="target" bg={colors.limeBright} fg={colors.greenDark} size={44} radius={15} iconSize={21} />
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>Upload a test report</Text>
              <Text style={styles.small}>Flip reads your values and tailors meals and plans around them.</Text>
            </View>
          </View>
          <View style={styles.row8}>
            <UploadButton icon="camera" label="Camera" onPress={() => { upload('camera').catch(() => undefined); }} />
            <UploadButton icon="image" label="Photos" onPress={() => { upload('library').catch(() => undefined); }} />
            <UploadButton icon="calendarCheck" label="PDF" onPress={() => { upload('pdf').catch(() => undefined); }} />
          </View>
          <Text style={styles.fine}>Only the values you confirm are saved. The file itself is never stored.</Text>
        </Card>
        {error ? <Banner icon message={error} /> : null}

        <Text style={styles.section}>Your reports</Text>
        {listState === 'loading' ? <View style={styles.loading}><Spinner color={colors.greenDark} /></View> : null}
        {listState === 'error' ? <Banner message="Couldn’t load your reports." onRetry={load} /> : null}
        {listState === 'ready' && !reports.length ? <Text style={styles.small}>No reports yet. Upload a blood test or checkup report to get started.</Text> : null}
        {reports.map(report => (
          <Pressable key={report.id} accessibilityRole="button" accessibilityLabel={`Open ${report.title}`} onPress={() => { open(report.id).catch(() => undefined); }} style={({ pressed }) => [styles.reportRow, pressed && styles.pressed]}>
            <IconTile name={report.urgent ? 'alert' : 'chart'} bg={report.urgent ? colors.dangerBg : colors.pale} fg={report.urgent ? colors.dangerText : colors.greenDark} size={40} radius={13} iconSize={19} />
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>{report.title}</Text>
              <Text style={styles.small}>{formatDate(report.reportDate ?? report.createdAt)} · {report.valueCount} values{report.flaggedCount ? ` · ${report.flaggedCount} to watch` : ' · all in range'}</Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} />
          </Pressable>
        ))}
        <Text style={styles.fine}>{NOT_A_DIAGNOSIS}</Text>
      </ScrollView>
    </View>
  );
}

function UploadButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Upload report: ${label}`} onPress={onPress} style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}>
      <Icon name={icon} size={18} color={colors.greenDark} />
      <Text style={styles.uploadText}>{label}</Text>
    </Pressable>
  );
}

/** Review before saving: untick misread values and choose whether to accept Flip's water target. */
function ReviewReport({ draft, onDiscard, onSaved }: { draft: ReportDraft; onDiscard: () => void; onSaved: (report: HealthReport, waterTargetMl: number | null) => void }) {
  const insets = useSafeAreaInsets();
  const [kept, setKept] = useState<boolean[]>(() => draft.values.map(() => true));
  const suggestedMl = draft.hydration.suggestedLitres ? Math.round(draft.hydration.suggestedLitres * 1000) : null;
  const [useWater, setUseWater] = useState(!!suggestedMl);
  const [status, setStatus] = useState<'idle' | 'saving' | 'fail'>('idle');
  const values = draft.values.filter((_, index) => kept[index]);

  async function save() {
    if (status === 'saving' || !values.length) return;
    setStatus('saving');
    try {
      const report = await saveReport({ ...draft, values });
      const waterMl = useWater && suggestedMl ? suggestedMl : null;
      if (waterMl) await setWaterTarget(waterMl, 'report').catch(() => undefined);
      onSaved(report, waterMl);
    } catch {
      setStatus('fail');
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}><BackHeader title="Check what Flip read" onBack={onDiscard} /></View>
      <ScrollView contentContainerStyle={[styles.content, styles.reviewContent]}>
        <ReportBody
          report={{ ...draft, values: draft.values }}
          checked={kept}
          onToggle={index => setKept(current => current.map((value, i) => (i === index ? !value : value)))}
        />
        {suggestedMl ? (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: useWater }} accessibilityLabel={`Set a daily water goal of ${formatLitres(suggestedMl)} litres`} onPress={() => setUseWater(on => !on)} style={[styles.water, useWater && styles.waterOn]}>
            <View style={[styles.box, useWater && styles.boxOn]}>{useWater ? <Icon name="check" size={13} color={colors.white} stroke={3.2} /> : null}</View>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>Daily water goal: {formatLitres(suggestedMl)} L</Text>
              <Text style={styles.small}>{draft.hydration.reason} Flip will remind you through the day.</Text>
            </View>
          </Pressable>
        ) : draft.hydration.reason ? (
          <InfoRow icon="info" text={draft.hydration.reason} />
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
        {status === 'fail' ? <Banner message="Couldn’t save the report. Try again." /> : null}
        <PillButton title={values.length ? `Save ${values.length} values` : 'Tick at least one value'} glow busy={status === 'saving'} busyLabel="Saving…" onPress={() => { save().catch(() => undefined); }} />
      </View>
    </View>
  );
}

const FLAG_STYLE: Record<ReportFlag, { bg: string; fg: string; label: string }> = {
  critical: { bg: colors.dangerBg, fg: colors.dangerText, label: 'Critical' },
  high: { bg: '#fdecd2', fg: '#a35a00', label: 'High' },
  low: { bg: '#fdecd2', fg: '#a35a00', label: 'Low' },
  normal: { bg: colors.pale, fg: colors.greenDark, label: 'In range' },
  unknown: { bg: colors.chip, fg: colors.muted, label: 'No range' },
};

/** Summary, values grouped by category with their flags and lab ranges, and Flip's food notes. */
function ReportBody({ checked, onToggle, report }: { checked?: boolean[]; onToggle?: (index: number) => void; report: Pick<HealthReport, 'nutritionNotes' | 'reportDate' | 'summary' | 'urgent' | 'values'> }) {
  const groups = new Map<string, { index: number; value: ReportValue }[]>();
  report.values.forEach((value, index) => groups.set(value.category, [...(groups.get(value.category) ?? []), { index, value }]));
  return (
    <>
      {report.urgent ? (
        <View style={styles.urgent}>
          <Icon name="alert" size={18} color={colors.dangerText} />
          <Text style={styles.urgentText}>Some results may need prompt attention. Please contact your doctor soon.</Text>
        </View>
      ) : null}
      <Card style={styles.summary}>
        <Text style={styles.label}>{report.reportDate ? `Report date · ${formatDate(report.reportDate)}` : 'Flip’s summary'}</Text>
        <Text style={styles.body}>{report.summary}</Text>
      </Card>
      {onToggle ? <Text style={styles.small}>Untick anything Flip misread. Only ticked values are saved.</Text> : null}
      {[...groups.entries()].map(([category, entries]) => (
        <Card key={category} style={styles.group}>
          <Text style={styles.label}>{category.toUpperCase()}</Text>
          {entries.map(({ index, value }) => {
            const flag = FLAG_STYLE[value.flag];
            const on = checked ? checked[index] : true;
            const row = (
              <>
                {checked ? <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={13} color={colors.white} stroke={3.2} /> : null}</View> : null}
                <View style={styles.grow}>
                  <Text style={[styles.valueName, !on && styles.off]}>{value.name}</Text>
                  {value.referenceRange ? <Text style={styles.small}>Lab range {value.referenceRange}</Text> : null}
                </View>
                <Text style={[styles.value, !on && styles.off]}>{value.value}{value.unit ? ` ${value.unit}` : ''}</Text>
                <Text style={[styles.flag, { backgroundColor: flag.bg, color: flag.fg }]}>{flag.label}</Text>
              </>
            );
            return onToggle ? (
              <Pressable key={index} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={value.name} onPress={() => onToggle(index)} style={styles.valueRow}>{row}</Pressable>
            ) : (
              <View key={index} style={styles.valueRow}>{row}</View>
            );
          })}
        </Card>
      ))}
      {report.nutritionNotes.length ? (
        <Card style={styles.group}>
          <Text style={styles.label}>FLIP’S FOOD SUGGESTIONS</Text>
          {report.nutritionNotes.map((note, index) => <InfoRow key={index} icon="leaf" text={note} />)}
        </Card>
      ) : null}
      <Text style={styles.fine}>{NOT_A_DIAGNOSIS}</Text>
    </>
  );
}

function InfoRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={15} color={colors.greenDark} />
      <Text style={[styles.body, styles.grow]}>{text}</Text>
    </View>
  );
}

function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  center: { alignItems: 'center', gap: 12, justifyContent: 'center', paddingHorizontal: 32 },
  orb: { height: 150, marginBottom: 12, width: 150 },
  header: { paddingHorizontal: 20 },
  content: { gap: 14, paddingHorizontal: 20, paddingTop: 12 },
  reviewContent: { paddingBottom: 24 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  section: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 6 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  fine: { color: colors.muted2, fontSize: 12, lineHeight: 17 },
  label: { color: colors.greenText, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  grow: { flex: 1, gap: 2, minWidth: 0 },
  row8: { flexDirection: 'row', gap: 8 },
  row10: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  upload: { gap: 14, padding: 16 },
  uploadButton: { alignItems: 'center', backgroundColor: colors.pale, borderRadius: 14, flex: 1, gap: 4, paddingVertical: 12 },
  uploadText: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  loading: { alignItems: 'center', paddingVertical: 16 },
  reportRow: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, flexDirection: 'row', gap: 12, padding: 14 },
  summary: { gap: 8, padding: 16 },
  group: { gap: 4, paddingHorizontal: 14, paddingVertical: 12 },
  valueRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 46, paddingVertical: 4 },
  valueName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  value: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  flag: { borderRadius: 9, fontSize: 11, fontWeight: '800', minWidth: 62, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, textAlign: 'center' },
  off: { color: colors.faint, textDecorationLine: 'line-through' },
  box: { alignItems: 'center', borderColor: colors.ring, borderRadius: 7, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  infoRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, paddingVertical: 4 },
  urgent: { alignItems: 'center', backgroundColor: colors.dangerBg, borderRadius: 16, flexDirection: 'row', gap: 10, padding: 14 },
  urgentText: { color: colors.dangerText, flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  water: { alignItems: 'center', backgroundColor: colors.white, borderColor: 'transparent', borderRadius: 20, borderWidth: 2, flexDirection: 'row', gap: 12, padding: 14 },
  waterOn: { backgroundColor: colors.selected, borderColor: colors.green },
  footer: { backgroundColor: colors.white, borderTopColor: colors.chip, borderTopWidth: 1, gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  delete: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 6, padding: 12 },
  deleteText: { color: colors.dangerText, fontSize: 14, fontWeight: '800' },
});
