import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { BODY_PARTS, EXERCISES, estimateMinutes, type MenuItem } from '../../../supabase/functions/_shared/menu';
import { Brand, Button, Card, colors, styles } from '../components/ui';
import { useWorkout } from '../state/workout';
import type { Proposal } from '../state/proposal';
import { ReplacementSheet } from '../components/replacement-sheet';
import { ExerciseGuide } from '../components/exercise-guide';

function ExerciseCard({ item, index, unavailable, onReplace }: { item: MenuItem; index: number; unavailable: boolean; onReplace: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const exercise = EXERCISES.find(({ id }) => id === item.exerciseId)!;
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <View style={local.number}><Text style={local.numberText}>{String(index + 1).padStart(2, '0')}</Text></View>
      <View style={{ flex: 1, gap: 7 }}><Text style={styles.heading}>{exercise.name}</Text>
        <Text style={styles.subtitle}>{exercise.equipment}</Text>
        <Text style={local.part}>{exercise.bodyParts.map((part) => BODY_PARTS.find(({ id }) => id === part)?.label).join(' / ')}</Text>
      </View>
    </View>
    <View style={local.metrics}>
      <View style={local.metric}><Text style={styles.label}>セット</Text><Text style={local.value}>{item.sets}<Text style={local.unit}> セット</Text></Text></View>
      <View style={local.metric}><Text style={styles.label}>{exercise.unilateral ? '左右それぞれ' : '回数'}</Text><Text style={local.value}>{item.reps}<Text style={local.unit}> 回</Text></Text></View>
      <View style={local.metric}><Text style={styles.label}>セット間休憩</Text><Text style={local.value}>{item.restSeconds}<Text style={local.unit}> 秒</Text></Text></View>
    </View>
    <ExerciseGuide exerciseId={exercise.id} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}>
      <Text style={styles.textLink}>選んだ理由を見る　{expanded ? '−' : '＋'}</Text>
    </Pressable>
    {expanded && <Text style={styles.subtitle}>{item.reason}</Text>}
    {unavailable && <Text style={styles.errorText}>この器具は使えない設定です。別の種目への変更を選べます。</Text>}
    <Button secondary label="別の種目に変更" onPress={onReplace} />
  </Card>;
}

export default function MenuScreen() {
  const { proposal } = useWorkout();
  const [sheet, setSheet] = useState<{ snapshot: Proposal; targetId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!proposal) return <Redirect href="/" />;
  const { conditions, menu } = proposal;
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  return <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Brand />
      <Pressable accessibilityRole="button" accessibilityLabel="条件入力に戻る" onPress={back}><Text style={styles.textLink}>←　条件入力に戻る</Text></Pressable>
      <View style={{ gap: 12 }}><Text style={styles.eyebrow}>YOUR WORKOUT PLAN</Text><Text style={styles.title}>今日の{ '\n' }おすすめメニュー。</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Text style={local.tag}>{BODY_PARTS.filter(({ id }) => conditions.bodyParts.includes(id)).map(({ label }) => label).join('・')}</Text>
          <Text style={local.tag}>{conditions.gymAvailable ? 'ジムあり' : '器具なし'}</Text>
          {conditions.durationMinutes !== undefined && <Text style={local.tag}>目安 {conditions.durationMinutes}分</Text>}
        </View>
      </View>
      <View style={local.overview}><Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>全{menu.items.length}種目　/　約{estimateMinutes(menu)}分</Text>
        <Text style={{ color: '#D6DFD2', fontSize: 12, lineHeight: 21 }}>{menu.summary}</Text>
        <Text style={{ color: '#BFCEBB', fontSize: 10 }}>所要時間は動作・休憩・種目間の移動を含む目安です。</Text>
      </View>
      {notice && <Text accessibilityLiveRegion="polite" style={[styles.subtitle, { color: colors.green }]}>{notice}</Text>}
      {menu.items.map((item, index) => <ExerciseCard key={item.exerciseId} item={item} index={index}
        unavailable={Boolean(proposal.exclusions?.equipment.includes(EXERCISES.find(({ id }) => id === item.exerciseId)!.equipment))}
        onReplace={() => { setNotice(null); setSheet({ snapshot: proposal, targetId: item.exerciseId }); }} />)}
      <Text style={styles.subtitle}>無理のない負荷で、フォームを確認しながら行いましょう。痛みがある場合は中止してください。</Text>
      <Button secondary label="条件を変えて作り直す" onPress={back} />
      <Text style={[styles.subtitle, { fontSize: 11, textAlign: 'center' }]}>選択した部位を生成履歴に記録しました。</Text>
    </ScrollView>
    {sheet && <ReplacementSheet snapshot={sheet.snapshot} targetId={sheet.targetId} onClose={() => setSheet(null)} onApplied={(name) => setNotice(`${name}に変更しました。`)} />}
  </SafeAreaView>;
}

const local = StyleSheet.create({
  overview: { backgroundColor: colors.green, borderRadius: 20, padding: 22, gap: 12 },
  tag: { backgroundColor: colors.pale, color: colors.green, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, fontSize: 12, fontWeight: '700' },
  number: { backgroundColor: colors.pale, borderRadius: 12, width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  numberText: { fontSize: 16, fontWeight: '800', color: colors.green },
  part: { fontSize: 11, color: colors.orange, fontWeight: '600' },
  metrics: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 16, gap: 8 },
  metric: { flex: 1, gap: 8 },
  value: { color: colors.ink, fontSize: 23, fontWeight: '800' },
  unit: { color: colors.muted, fontSize: 10, fontWeight: '500' },
});
