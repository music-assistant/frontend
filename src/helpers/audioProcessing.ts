import { $t } from "@/plugins/i18n";
import { toRaw, type Component } from "vue";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpDown,
  AudioWaveform,
  Blend,
  ChevronsDownUp,
  Expand,
  Gauge,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Waves,
} from "@lucide/vue";
import {
  DSPFilterType,
  type BalanceFilter,
  type DSPConfig,
  type DSPFilter,
  type GainFilter,
  type ParametricEQBand,
  type ParametricEQFilter,
  type ToneControlFilter,
  type TransposeFilter,
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

// Keyed by the filter type's string value rather than the enum so the filters
// still waiting on their own branches are covered here too, and land with an
// icon the moment their type exists.
const filterIcons: Record<string, Component> = {
  [DSPFilterType.PARAMETRIC_EQ]: SlidersHorizontal,
  [DSPFilterType.TONE_CONTROL]: AudioWaveform,
  [DSPFilterType.GAIN]: Gauge,
  [DSPFilterType.BALANCE]: ArrowLeftRight,
  safety_limiter: ArrowDownToLine,
  compressor: ChevronsDownUp,
  convolution: Waves,
  transpose: ArrowUpDown,
  stereo_width: Expand,
  crossfeed: Blend,
};

export function dspFilterIcon(filter: DSPFilter): Component {
  // A high/low-pass is one filter type with two directions, so the icon comes
  // from its mode: the response curve either rises or falls.
  if ((filter.type as string) === "high_low_pass") {
    return (filter as { mode?: string }).mode === "low_pass"
      ? TrendingDown
      : TrendingUp;
  }
  return filterIcons[filter.type] ?? SlidersHorizontal;
}

export function dspFilterText(filter: DSPFilter): string {
  let text = $t(`settings.dsp.types.${filter.type}`);
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
    left.type === DSPFilterType.TRANSPOSE &&
    right.type === DSPFilterType.TRANSPOSE
  ) {
    return areTransposeFiltersEqual(left, right);
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

function areTransposeFiltersEqual(
  left: TransposeFilter,
  right: TransposeFilter,
): boolean {
  return left.semitones === right.semitones;
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
