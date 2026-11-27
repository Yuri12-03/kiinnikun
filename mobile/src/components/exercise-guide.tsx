import { StyleSheet, Text, View } from 'react-native';
import { EXERCISE_GUIDES } from '../lib/exercise-guides';
import { colors, styles } from './ui';

export function ExerciseGuide({ exerciseId }: { exerciseId: string }) {
  const guide = EXERCISE_GUIDES[exerciseId];
  if (!guide) return null;
  return <View style={local.container}>
    <Text style={local.heading}>やり方</Text>
    {guide.steps.map((step, index) => <View key={step} style={local.step}>
      <Text style={local.number}>{index + 1}</Text><Text style={[styles.subtitle, { flex: 1, color: colors.ink }]}>{step}</Text>
    </View>)}
    <Text style={local.tip}>コツ：{guide.tip}</Text>
  </View>;
}

const local = StyleSheet.create({
  container: { backgroundColor: colors.background, borderRadius: 14, padding: 14, gap: 8 },
  heading: { fontSize: 12, fontWeight: '700', color: colors.green, marginBottom: 2 },
  step: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  number: { color: colors.orange, fontSize: 12, fontWeight: '800', lineHeight: 23 },
  tip: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 3 },
});
