import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BodyPart } from '../../../supabase/functions/_shared/menu';
import { colors, styles } from './ui';

export function BodyPartCard({ part, index, selected, disabled, recommendationReason, onPress }: {
  part: { id: BodyPart; label: string; hint: string }; index: number; selected: boolean;
  disabled: boolean; recommendationReason?: string; onPress: () => void;
}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={part.label}
    accessibilityHint={recommendationReason === undefined ? undefined : `おすすめの部位です。${recommendationReason}`}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [local.part, selected && local.selectedPart, pressed && { opacity: 0.8 }]}>
    <View style={styles.row}><Text style={[local.partNumber, selected && local.lightText]}>0{index + 1}</Text>
      <Text style={[local.check, selected && local.lightText]}>{selected ? '✓' : '＋'}</Text></View>
    <Text style={[local.partName, selected && local.lightText]}>{part.label}</Text>
    <Text style={[local.partHint, selected && { color: '#BFCEBB' }]}>{part.hint}</Text>
    <View style={local.badgeSlot}>{recommendationReason !== undefined && <View style={local.badge}>
      <Text style={local.badgeText}>おすすめ</Text>
    </View>}</View>
  </Pressable>;
}

const local = StyleSheet.create({
  part: { width: '31%', flexGrow: 1, padding: 16, gap: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, minHeight: 140 },
  selectedPart: { backgroundColor: colors.green, borderColor: colors.green },
  partNumber: { color: '#9BA494', fontSize: 10, fontWeight: '700' },
  partName: { fontSize: 23, fontWeight: '700', color: colors.ink, marginTop: 5 },
  partHint: { fontSize: 8, color: colors.muted, letterSpacing: 0.7, fontWeight: '600' },
  check: { fontSize: 14, color: colors.muted },
  lightText: { color: colors.white },
  badgeSlot: { minHeight: 20 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.pale, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, maxWidth: '100%' },
  badgeText: { color: colors.green, fontSize: 9, fontWeight: '800', lineHeight: 14 },
});
