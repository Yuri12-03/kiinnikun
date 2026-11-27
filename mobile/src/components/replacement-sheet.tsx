import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXERCISES, MenuError, type MenuItem } from '../../../supabase/functions/_shared/menu';
import { EXERCISE_PROFILES, parseReplacementRequest, REPLACEMENT_REASONS, type ReplacementReason, type ReplacementRequest } from '../../../supabase/functions/_shared/replacements';
import { suggestReplacements } from '../lib/menu-api';
import { useWorkout } from '../state/workout';
import type { Proposal } from '../state/proposal';
import { Button, Card, colors, styles } from './ui';
import { ExerciseGuide } from './exercise-guide';

export function ReplacementSheet({ snapshot, targetId, onClose, onApplied }: {
  snapshot: Proposal; targetId: string; onClose: () => void; onApplied: (name: string) => void;
}) {
  const target = EXERCISES.find(({ id }) => id === targetId)!;
  const { replaceExercise } = useWorkout();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReplacementReason | 'pain' | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ request: ReplacementRequest; candidates: MenuItem[] } | null>(null);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);
  const active = useRef(true), requestRef = useRef<AbortController | null>(null);
  const applied = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; requestRef.current?.abort(); };
  }, []);

  function close() { active.current = false; requestRef.current?.abort(); onClose(); }
  async function suggest() {
    if (!reason || reason === 'pain' || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller; setBusy(true); setError(null); setResult(null);
    const timeout = setTimeout(() => controller.abort(), 70_000);
    try {
      const request = parseReplacementRequest({ ...snapshot, targetExerciseId: targetId, reason });
      const response = await suggestReplacements(request, controller.signal);
      if (active.current) setResult({ request, candidates: response.candidates });
    } catch (cause) {
      if (active.current) setError({ message: cause instanceof Error ? cause.message : '候補を取得できませんでした。',
        retry: !(cause instanceof MenuError && ['UNAUTHORIZED', 'FORBIDDEN', 'SERVER_CONFIG', 'DAILY_LIMIT', 'INVALID_INPUT'].includes(cause.code)) });
    } finally {
      clearTimeout(timeout); requestRef.current = null;
      if (active.current) setBusy(false);
    }
  }
  function apply(candidate: MenuItem) {
    if (!result || applied.current || busy) return;
    applied.current = true;
    try {
      replaceExercise(snapshot, result.request, candidate);
      onApplied(EXERCISES.find(({ id }) => id === candidate.exerciseId)!.name);
      close();
    } catch (cause) {
      applied.current = false;
      setError({ message: cause instanceof Error ? cause.message : '変更できませんでした。', retry: false });
    }
  }

  return <Modal visible transparent animationType="slide" onRequestClose={close}>
    <View style={local.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="変更をキャンセルして閉じる" style={local.backdrop} onPress={close} />
      <View style={[local.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
        <View style={local.handle} />
        <View style={[styles.row, { paddingHorizontal: 24 }]}><Text style={styles.heading}>別の種目に変更</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="代替候補を閉じる" onPress={close} hitSlop={12}><Text style={local.close}>×</Text></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={local.content}>
          <View style={local.target}><Text style={styles.label}>変更する種目</Text><Text style={styles.heading}>{target.name}</Text>
            <Text style={styles.subtitle}>{target.equipment} ／ {EXERCISE_PROFILES[target.id]?.focus}</Text></View>
          <Text style={styles.heading}>実行できない理由は？</Text>
          <View style={{ gap: 8 }}>{[...REPLACEMENT_REASONS.filter((option) => target.gymOnly || option.id === 'too_difficult'), { id: 'pain' as const, label: '痛み・違和感がある' }].map((option) =>
            <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected: reason === option.id, disabled: busy }} disabled={busy}
              onPress={() => { setReason(option.id); setResult(null); setError(null); }} style={[local.reason, reason === option.id && local.selectedReason]}>
              <Text style={local.reasonText}>{reason === option.id ? '●' : '○'}　{option.label}</Text>
            </Pressable>)}</View>
          {reason === 'pain' ? <Card><Text style={styles.heading}>この種目はいったん中止しましょう</Text>
            <Text style={styles.subtitle}>痛みや違和感を避けるための代替種目は、ここでは自動提案しません。無理に続けず、必要に応じて専門家に相談してください。</Text>
            <Button secondary label="メニューに戻る" onPress={close} /></Card> : <>
            {!result && <Button label={busy ? '代替候補を考えています…' : 'AIに代替候補を聞く'} disabled={!reason || busy} onPress={() => void suggest()} />}
            {busy && <View accessibilityLiveRegion="polite" style={local.loading}><ActivityIndicator color={colors.green} /><Text style={styles.subtitle}>元のメニューは変更せずに探しています。</Text></View>}
            {error && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}><Text style={styles.errorText}>{error.message}</Text>
              {error.retry && <Button secondary label="もう一度試す" disabled={busy} onPress={() => void suggest()} />}</View>}
            {result && result.candidates.length === 0 && <Card><Text style={styles.heading}>条件に合う代替候補がありません</Text>
              <Text style={styles.subtitle}>同じ部位を鍛えられ、今のメニューと重複しない候補が見つかりませんでした。元のメニューは変更していません。</Text></Card>}
            {result && result.candidates.length > 0 && <><Text style={styles.heading}>近い部位を鍛える候補</Text>
              <Text style={styles.subtitle}>動作や負荷が変わるため、効果が完全に同じになるものではありません。</Text>
              {result.candidates.map((candidate) => {
                const exercise = EXERCISES.find(({ id }) => id === candidate.exerciseId)!;
                return <Card key={exercise.id}><Text style={styles.heading}>{exercise.name}</Text><Text style={styles.subtitle}>{exercise.equipment} ／ {EXERCISE_PROFILES[exercise.id].focus}</Text>
                  <Text style={local.metrics}>{candidate.sets}セット × {candidate.reps}回{exercise.unilateral ? '（左右それぞれ）' : ''}　休憩{candidate.restSeconds}秒</Text>
                  <Text style={styles.subtitle}>{candidate.reason}</Text>
                  <ExerciseGuide exerciseId={exercise.id} />
                  <Button label={`この種目に変更：${exercise.name}`} onPress={() => apply(candidate)} />
                </Card>;
              })}</>}
          </>}
          <Button secondary label="変更せずに閉じる" onPress={close} />
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const local = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: { maxHeight: '92%', width: '100%', maxWidth: 600, alignSelf: 'center', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, gap: 16 },
  handle: { width: 40, height: 4, backgroundColor: colors.line, borderRadius: 3, alignSelf: 'center' },
  close: { fontSize: 28, color: colors.muted },
  content: { paddingHorizontal: 24, paddingBottom: 12, gap: 16 },
  target: { borderLeftWidth: 3, borderColor: colors.orange, paddingLeft: 14, gap: 5 },
  reason: { padding: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  selectedReason: { borderColor: colors.green, backgroundColor: colors.pale },
  reasonText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  loading: { alignItems: 'center', gap: 10 },
  metrics: { fontSize: 13, color: colors.green, fontWeight: '700', lineHeight: 22 },
});
