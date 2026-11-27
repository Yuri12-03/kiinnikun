import { StyleSheet, Text, View } from 'react-native';
import { Card, colors, styles } from './ui';
import { DurationSlider } from './duration-slider';

export function DurationPicker({ value, onChange, disabled }: { value: number; onChange: (minutes: number) => void; disabled: boolean }) {
  return <View style={{ gap: 14 }}>
    <Text style={styles.heading}>03　どのくらいトレーニングする？</Text>
    <Card>
      <View style={styles.row}>
        <View style={{ gap: 5 }}><Text style={styles.label}>今日の目安</Text><Text style={styles.subtitle}>つまみを左右にスライド</Text></View>
        <Text style={local.value}>{value}<Text style={local.unit}> 分</Text></Text>
      </View>
      <DurationSlider value={value} onChange={onChange} disabled={disabled} />
      <View style={styles.row}><Text style={styles.label}>10分</Text><Text style={styles.label}>60分</Text></View>
      <Text style={styles.subtitle}>選んだ時間に合わせて、種目数やセット数を調整します。条件によっては短いメニューになります。</Text>
      <Text style={local.hint}>動作・休憩・種目間の移動を含む目安です。準備運動や着替えの時間は含みません。</Text>
    </Card>
  </View>;
}

const local = StyleSheet.create({
  value: { color: colors.green, fontSize: 42, lineHeight: 50, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 17, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 19 },
});
