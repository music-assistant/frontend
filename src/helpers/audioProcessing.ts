import { $t } from "@/plugins/i18n";
import { toRaw } from "vue";
import {
  DSPFilterType,
  type BalanceFilter,
  type CompressorFilter,
  type DSPConfig,
  type DSPFilter,
  type GainFilter,
  type HighLowPassFilter,
  type SafetyLimiterFilter,
  type ParametricEQBand,
  type ParametricEQFilter,
  type ToneControlFilter,
} from "@/plugins/api/interfaces";

export function sanitizeDSPPresetConfig(config: DSPConfig): DSPConfig {
  return {
    ...structuredClone(toRaw(config)),
    preset_id: null,
  };
}

export function areDSPConfigsEqual(left: DSPConfig, right: DSPConfig): boolean {
  return (
    left.enabled === right.enabled &&
    left.input_gain === right.input_gain &&
    left.output_gain === right.output_gain &&
    (left.preset_id ?? null) === (right.preset_id ?? null) &&
    areDspFiltersEqual(left.filters, right.filters)
  );
}

// Display label for a filter type. A high/low-pass edits as itself, so it
// reads its stored mode ("High-pass" / "Low-pass") rather than the generic
// type name used in the add-filter menu.
export function dspFilterTypeLabel(filter: DSPFilter): string {
  if (filter.type === DSPFilterType.HIGH_LOW_PASS) {
    return $t(`settings.dsp.high_low_pass.mode.${filter.mode}`);
  }
  return $t(`settings.dsp.types.${filter.type}`);
}

export function dspFilterText(filter: DSPFilter): string {
  let text = dspFilterTypeLabel(filter);
  if (filter.type !== DSPFilterType.PARAMETRIC_EQ) return text;

  const enabledBandsCount = filter.bands.filter((band) => band.enabled).length;
  text +=
    enabledBandsCount === 1
      ? ` (${$t("streamdetails.eq_band_count_singular")})`
      : ` (${$t("streamdetails.eq_band_count", [enabledBandsCount])})`;
  return text;
}

function areDspFiltersEqual(left: DSPFilter[], right: DSPFilter[]): boolean {
  return (
    left.length === right.length &&
    left.every((filter, index) => areDspFilterEqual(filter, right[index]))
  );
}

function areDspFilterEqual(left: DSPFilter, right: DSPFilter): boolean {
  if (left.type !== right.type || left.enabled !== right.enabled) {
    return false;
  }

  if (
    left.type === DSPFilterType.TONE_CONTROL &&
    right.type === DSPFilterType.TONE_CONTROL
  ) {
    return areToneControlFiltersEqual(left, right);
  }
  if (
    left.type === DSPFilterType.PARAMETRIC_EQ &&
    right.type === DSPFilterType.PARAMETRIC_EQ
  ) {
    return areParametricEqFiltersEqual(left, right);
  }
  if (left.type === DSPFilterType.GAIN && right.type === DSPFilterType.GAIN) {
    return areGainFiltersEqual(left, right);
  }
  if (
    left.type === DSPFilterType.BALANCE &&
    right.type === DSPFilterType.BALANCE
  ) {
    return areBalanceFiltersEqual(left, right);
  }
  if (
    left.type === DSPFilterType.SAFETY_LIMITER &&
    right.type === DSPFilterType.SAFETY_LIMITER
  ) {
    return areSafetyLimiterFiltersEqual(left, right);
  }
  if (
    left.type === DSPFilterType.COMPRESSOR &&
    right.type === DSPFilterType.COMPRESSOR
  ) {
    return areCompressorFiltersEqual(left, right);
  }
  if (
    left.type === DSPFilterType.HIGH_LOW_PASS &&
    right.type === DSPFilterType.HIGH_LOW_PASS
  ) {
    return areHighLowPassFiltersEqual(left, right);
  }
  return false;
}

function areToneControlFiltersEqual(
  left: ToneControlFilter,
  right: ToneControlFilter,
): boolean {
  return (
    left.bass_level === right.bass_level &&
    left.mid_level === right.mid_level &&
    left.treble_level === right.treble_level
  );
}

function areParametricEqFiltersEqual(
  left: ParametricEQFilter,
  right: ParametricEQFilter,
): boolean {
  return (
    left.preamp === right.preamp &&
    areNumberRecordsEqual(left.per_channel_preamp, right.per_channel_preamp) &&
    left.bands.length === right.bands.length &&
    left.bands.every((band, index) =>
      areParametricEqBandsEqual(band, right.bands[index]),
    )
  );
}

function areGainFiltersEqual(left: GainFilter, right: GainFilter): boolean {
  return left.gain === right.gain;
}

function areBalanceFiltersEqual(
  left: BalanceFilter,
  right: BalanceFilter,
): boolean {
  return left.balance === right.balance;
}

function areSafetyLimiterFiltersEqual(
  left: SafetyLimiterFilter,
  right: SafetyLimiterFilter,
): boolean {
  return left.ceiling === right.ceiling;
}

function areCompressorFiltersEqual(
  left: CompressorFilter,
  right: CompressorFilter,
): boolean {
  return (
    left.threshold === right.threshold &&
    left.ratio === right.ratio &&
    left.attack === right.attack &&
    left.release === right.release &&
    left.knee === right.knee &&
    left.makeup === right.makeup
  );
}

function areHighLowPassFiltersEqual(
  left: HighLowPassFilter,
  right: HighLowPassFilter,
): boolean {
  return (
    left.mode === right.mode &&
    left.frequency === right.frequency &&
    left.slope === right.slope
  );
}

function areParametricEqBandsEqual(
  left: ParametricEQBand,
  right: ParametricEQBand,
): boolean {
  return (
    left.frequency === right.frequency &&
    left.q === right.q &&
    left.gain === right.gain &&
    left.type === right.type &&
    left.enabled === right.enabled &&
    left.channel === right.channel
  );
}

function areNumberRecordsEqual(
  left: Record<string, number | undefined>,
  right: Record<string, number | undefined>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key] === right[key]);
}
