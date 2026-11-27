import { createElement, type ChangeEvent } from 'react';
import { WORKOUT_DURATION } from '../../../supabase/functions/_shared/menu';
import type { DurationSliderProps } from './duration-slider';
import { colors } from './ui';

// The native package's web shim does not expose value semantics or arrow-key controls.
export function DurationSlider({ value, onChange, disabled }: DurationSliderProps) {
  return createElement('input', {
    type: 'range', min: WORKOUT_DURATION.min, max: WORKOUT_DURATION.max, step: WORKOUT_DURATION.step,
    value, disabled, 'aria-label': '目安のトレーニング時間', 'aria-valuetext': `${value}分`,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.currentTarget.value)),
    style: { width: '100%', height: 44, margin: 0, accentColor: colors.orange, cursor: disabled ? 'default' : 'pointer' },
  });
}
