import { Image, Pressable, StyleSheet, Text, View, type PressableProps, type ViewProps } from 'react-native';

export const colors = {
  background: '#F7F6F2', ink: '#232B25', muted: '#737A70', line: '#DFE2D9',
  green: '#294B3A', pale: '#E7EEDF', orange: '#D45D35', white: '#FFFFFF',
};

export function Brand() {
  return <View style={styles.brand}><Image source={require('../../assets/kinni-icon.png')} style={styles.mark} accessible={false} />
    <Text style={styles.brandText}>きんに君</Text>
    <View style={styles.brandBadge}><Text style={styles.brandBadgeText}>YOUR TRAINING PARTNER</Text></View>
  </View>;
}

export function Button({ label, secondary, disabled, ...props }: PressableProps & { label: string; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled: Boolean(disabled) }}
    {...props} style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && !disabled && { opacity: 0.8 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.green }]}>{label}</Text>
  </Pressable>;
}

export function Card(props: ViewProps) { return <View {...props} style={[styles.card, props.style]} />; }

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, paddingBottom: 40, gap: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mark: { backgroundColor: colors.green, width: 32, height: 32, borderRadius: 10 },
  brandText: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -1 },
  brandBadge: { marginLeft: 'auto' },
  brandBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.7, color: colors.muted },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 46, letterSpacing: -0.8 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 23 },
  heading: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: colors.line },
  button: { backgroundColor: colors.green, paddingVertical: 19, paddingHorizontal: 18, borderRadius: 16, alignItems: 'center', minHeight: 58 },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: colors.pale },
  disabled: { backgroundColor: '#BEC6B9' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, color: colors.ink, fontSize: 15, backgroundColor: colors.background },
  error: { backgroundColor: '#FFF0EA', borderColor: '#EEC8BA', borderWidth: 1, padding: 16, borderRadius: 14, gap: 6 },
  errorText: { color: '#9D3F22', fontSize: 13, lineHeight: 22 },
  textLink: { color: colors.green, fontSize: 13, fontWeight: '700', paddingVertical: 8 },
});
