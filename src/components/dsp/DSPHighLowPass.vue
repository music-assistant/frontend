<template>
  <div class="hlp">
    <!-- Mode: which side of the cutoff is removed. Card grid in the same style
         as the compressor's presets. -->
    <div class="hlp-group">
      <Label class="hlp-label">
        {{ $t("settings.dsp.high_low_pass.mode_label") }}
      </Label>
      <div class="preset-grid">
        <button
          v-for="m in modes"
          :key="m"
          type="button"
          class="preset-card"
          :class="{ 'preset-card--active': filter.mode === m }"
          :aria-pressed="filter.mode === m"
          @click="setMode(m)"
        >
          <svg
            class="preset-curve"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line class="preset-curve__flat" x1="0" y1="15" x2="100" y2="15" />
            <path class="preset-curve__stroke" :d="MODE_CURVES[m]" />
          </svg>
          <span class="preset-card__name">
            {{ $t(`settings.dsp.high_low_pass.mode.${m}`) }}
          </span>
          <span class="preset-card__desc">
            {{ $t(`settings.dsp.high_low_pass.mode_desc.${m}`) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Cutoff: reuse the shared log-scale frequency control (20-20000 Hz). -->
    <DSPSlider
      v-model="filter.frequency"
      type="frequency"
      class="hlp-frequency"
    />

    <!-- Slope: only 12/24/48 dB/oct are renderable, so a discrete card group
         rather than a slider. The illustration follows the current mode. -->
    <div class="hlp-group">
      <Label class="hlp-label">
        {{ $t("settings.dsp.high_low_pass.slope") }}
      </Label>
      <div class="preset-grid">
        <button
          v-for="s in slopes"
          :key="s"
          type="button"
          class="preset-card preset-card--inline"
          :class="{ 'preset-card--active': filter.slope === s }"
          :aria-pressed="filter.slope === s"
          @click="filter.slope = s"
        >
          <svg
            class="preset-curve preset-curve--icon"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line class="preset-curve__flat" x1="0" y1="15" x2="100" y2="15" />
            <g
              :transform="
                filter.mode === HighLowPassMode.LOW_PASS
                  ? 'translate(100,0) scale(-1,1)'
                  : undefined
              "
            >
              <path class="preset-curve__stroke" :d="SLOPE_CURVES[s]" />
            </g>
          </svg>
          <span class="preset-card__text">
            <span class="preset-card__name">{{ s }} dB/oct</span>
            <span class="preset-card__desc">
              {{ $t(`settings.dsp.high_low_pass.slope_desc.${s}`) }}
            </span>
          </span>
        </button>
      </div>
    </div>

    <div class="px-4">
      <Alert variant="info" class="mb-4">
        <Info />
        <AlertDescription>
          {{ $t("settings.dsp.high_low_pass.help") }}
        </AlertDescription>
      </Alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  HighLowPassFilter,
  HighLowPassMode,
  HighLowPassSlope,
} from "@/plugins/api/interfaces";
import DSPSlider from "./DSPSlider.vue";
import { Info } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  HIGH_LOW_PASS_SLOPES,
  DEFAULT_HIGH_PASS_FREQUENCY,
  DEFAULT_LOW_PASS_FREQUENCY,
} from "./highLowPass";

const filter = defineModel<HighLowPassFilter>({ required: true });

const modes = [HighLowPassMode.HIGH_PASS, HighLowPassMode.LOW_PASS];
const slopes = HIGH_LOW_PASS_SLOPES;

// Illustrative frequency responses over the visible range: the passband sits
// flat near the top, the stopband drops to the bottom.
const MODE_CURVES: Record<HighLowPassMode, string> = {
  [HighLowPassMode.HIGH_PASS]: "M0,88 C22,88 34,18 52,15 L100,15",
  [HighLowPassMode.LOW_PASS]: "M0,15 L48,15 C66,18 78,88 100,88",
};

// High-pass rolloffs as flat-stopband / transition / flat-passband profiles.
// The transition band narrows sharply as the slope steepens, so 12 reads as a
// long gentle ramp and 48 as a near-vertical step. Mirrored for low-pass mode.
const SLOPE_CURVES: Record<HighLowPassSlope, string> = {
  12: "M0,85 L10,85 L90,15 L100,15",
  24: "M0,85 L34,85 L66,15 L100,15",
  48: "M0,85 L44,85 L56,15 L100,15",
};

const setMode = (mode: HighLowPassMode) => {
  if (filter.value.mode === mode) return;
  // Move an untouched cutoff to a sensible spot for the new mode; a value the
  // user has already set (i.e. not the other mode's default) is left alone.
  if (
    mode === HighLowPassMode.LOW_PASS &&
    filter.value.frequency === DEFAULT_HIGH_PASS_FREQUENCY
  ) {
    filter.value.frequency = DEFAULT_LOW_PASS_FREQUENCY;
  } else if (
    mode === HighLowPassMode.HIGH_PASS &&
    filter.value.frequency === DEFAULT_LOW_PASS_FREQUENCY
  ) {
    filter.value.frequency = DEFAULT_HIGH_PASS_FREQUENCY;
  }
  filter.value.mode = mode;
};
</script>

<style scoped>
.hlp-group {
  padding-top: 8px;
}

.hlp-label {
  display: block;
  padding: 0 20px 4px;
  color: var(--muted-foreground);
}

/* Tighten the gap between the cutoff slider and the slope cards below it. */
.hlp-frequency :deep(.v-card-text) {
  padding-bottom: 4px;
}

.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 4px 16px 20px;
}

.preset-card {
  flex: 1 1 148px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 14px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--foreground) 2%, transparent);
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.preset-card:hover {
  border-color: color-mix(in srgb, var(--foreground) 28%, transparent);
  background: color-mix(in srgb, var(--foreground) 5%, transparent);
}

.preset-card:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.preset-card--active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.preset-curve {
  width: 100%;
  height: 60px;
  margin-bottom: 8px;
  overflow: visible;
}

/* Slope cards: compact icon beside the label instead of a full-width curve. */
.preset-card--inline {
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 14px;
}

.preset-curve--icon {
  flex: none;
  width: 88px;
  height: 32px;
  margin-bottom: 0;
}

.preset-card__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preset-curve__flat {
  stroke: color-mix(in srgb, var(--foreground) 22%, transparent);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  vector-effect: non-scaling-stroke;
}

.preset-curve__stroke {
  fill: none;
  stroke: color-mix(in srgb, var(--foreground) 50%, transparent);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.preset-card--active .preset-curve__stroke {
  stroke: var(--primary);
}

.preset-card__name {
  font-size: 0.875rem;
  font-weight: 500;
}

.preset-card--active .preset-card__name {
  color: var(--primary);
}

.preset-card__desc {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

@media (prefers-reduced-motion: reduce) {
  .preset-card {
    transition: none;
  }
}
</style>
