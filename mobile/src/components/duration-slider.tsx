import Slider from '@react-native-community/slider';
import { WORKOUT_DURATION } from '../../../supabase/functions/_shared/menu';
import { colors } from './ui';

export type DurationSliderProps = { value: number; onChange: (minutes: number) => void; disabled: boolean };

export function DurationSlider({ value, onChange, disabled }: DurationSliderProps) {
  return <Slider style={{ width: '100%', height: 44 }} minimumValue={WORKOUT_DURATION.min} maximumValue={WORKOUT_DURATION.max} step={WORKOUT_DURATION.step}
    value={value} onValueChange={onChange} disabled={disabled} tapToSeek minimumTrackTintColor={colors.green} maximumTrackTintColor={colors.line} thumbTintColor={colors.orange}
    accessibilityLabel="目安のトレーニング時間" accessibilityHint="10分から60分まで、5分刻みで選べます"
    accessibilityValue={{ min: WORKOUT_DURATION.min, max: WORKOUT_DURATION.max, now: value, text: `${value}分` }} />;
}
