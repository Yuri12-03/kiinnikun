import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BodyPart } from '../../../supabase/functions/_shared/menu';
import { historyReason } from '../lib/training-history';
import type { useTrainingRecommendations } from '../state/use-training-recommendations';
import { Button, Card, colors, styles } from './ui';

export function RecommendedParts({ history, selected, onSelect, disabled }: {
  history: ReturnType<typeof useTrainingRecommendations>; selected: BodyPart[]; onSelect: (part: BodyPart) => void; disabled: boolean;
}) {
  return <Card>
    <View style={styles.row}><Text style={styles.heading}>今日のおすすめ</Text><Text style={[styles.label, { flexShrink: 1, textAlign: 'right' }]}>部位をタップして選択</Text></View>
    {history.status === 'signed_out' ? <Text style={styles.subtitle}>ログインすると、生成履歴からおすすめの部位を表示します。</Text> :
      history.status === 'loading' ? <View style={local.loading}><ActivityIndicator color={colors.green} /><Text style={styles.subtitle}>生成履歴を確認しています…</Text></View> :
      history.status === 'error' ? <><Text style={styles.subtitle}>生成履歴を読み込めませんでした。</Text><Button secondary label="履歴をもう一度読み込む" disabled={disabled} onPress={history.refresh} /></> :
      history.recommendations.length === 0 ? <Text style={styles.subtitle}>おすすめの部位はありません</Text> :
        <View style={local.row}>{history.recommendations.map((part) => {
          const checked = selected.includes(part.id);
          return <Pressable key={part.id} accessibilityRole="checkbox" accessibilityLabel={`おすすめ：${part.label}`}
            accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onSelect(part.id)}
            style={({ pressed }) => [local.part, checked && local.selected, pressed && { opacity: 0.8 }]}>
            <Text style={local.name}>{part.label}<Text style={local.check}>{checked ? '　✓' : '　＋'}</Text></Text>
            <Text style={local.reason}>{historyReason(part, history.now)}</Text>
          </Pressable>;
        })}</View>}
    {history.status === 'ready' && <Text style={local.note}>生成した部位を記録しています。48時間経っていない部位はおすすめから外しています。</Text>}
  </Card>;
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  part: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, padding: 14, gap: 7, minHeight: 88 },
  selected: { borderColor: colors.green, backgroundColor: colors.pale },
  name: { color: colors.green, fontSize: 24, fontWeight: '800' },
  check: { fontSize: 16 },
  reason: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  note: { color: colors.muted, fontSize: 10, lineHeight: 18 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
