<template>
  <v-container class="pa-2">
    <!-- Frequency Response Graph with Dark Theme Support -->
    <v-card class="mb-4" elevation="2">
      <div ref="graphContainer" class="graph-container">
        <canvas ref="canvas" class="frequency-graph"></canvas>
      </div>
    </v-card>

    <!-- Band Management Section -->
    <v-card class="mb-4" elevation="2">
      <v-card-title class="d-flex align-center px-4 py-2" />

      <!-- Band Selection with Visual Indicators -->
      <v-card-text class="pa-0">
        <v-chip-group
          v-model="selectedBandIndex"
          class="mb-4 pa-2"
          mandatory
          selected-class="primary"
        >
          <v-chip
            v-for="(band, index) in peq.bands"
            :key="index"
            :value="index"
            :class="{ 'opacity-50': !band.enabled }"
            filter
            variant="elevated"
          >
            {{ $t("settings.dsp.parametric_eq.band", { index: index + 1 }) }}
          </v-chip>
          <v-chip variant="outlined" @click="addBand">
            <v-icon icon="mdi-plus" start />
            {{ $t("settings.dsp.parametric_eq.add_band") }}
          </v-chip>
        </v-chip-group>
      </v-card-text>
    </v-card>

    <!-- Band Controls Card -->
    <v-card v-if="selectedBand" elevation="2">
      <v-card-text>
        <!-- Band Header -->
        <div class="d-flex align-center mb-4">
          <v-switch
            v-model="selectedBand.enabled"
            :label="$t('settings.dsp.parametric_eq.enable_band')"
            density="comfortable"
            hide-details
            color="primary"
          />
          <v-spacer />
          <v-btn
            color="error"
            variant="tonal"
            @click="removeBand(selectedBandIndex)"
          >
            <v-icon>mdi-delete</v-icon>
            {{ $t("settings.dsp.parametric_eq.delete_band") }}
          </v-btn>
        </div>

        <!-- Filter Controls -->
        <v-row dense>
          <v-col cols="12">
            <v-select
              v-model="selectedBand.type"
              :items="filterTypes"
              :label="$t('settings.dsp.parametric_eq.filter_type')"
              variant="outlined"
              density="comfortable"
              class="mb-4"
            />
          </v-col>

          <v-col cols="12">
            <DSPSlider
              v-model="selectedBand.frequency"
              type="frequency"
              class="mb-4"
            />
          </v-col>

          <v-col v-if="showGainParameter(selectedBand.type)" cols="12">
            <DSPSlider v-model="selectedBand.gain" type="gain" class="mb-4" />
          </v-col>

          <v-col cols="12">
            <DSPSlider v-model="selectedBand.q" type="q" />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>
<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import {
  ParametricEQBand,
  ParametricEQBandType,
  ParametricEQFilter,
} from "@/plugins/api/interfaces";
import DSPSlider from "./DSPSlider.vue";
import { $t } from "@/plugins/i18n";
import { useTheme } from "vuetify";

const theme = useTheme();

const peq = defineModel<ParametricEQFilter>({ required: true });

const canvas = ref<HTMLCanvasElement | null>(null);
const graphContainer = ref<HTMLDivElement | null>(null);

const filterTypes = Object.values(ParametricEQBandType).map((value) => ({
  title: $t(`settings.dsp.parametric_eq.filter_types.${value}`),
  value: value,
}));

// Helper functions
const showGainParameter = (type: ParametricEQBandType) => {
  return ![
    ParametricEQBandType.HIGH_PASS,
    ParametricEQBandType.LOW_PASS,
    ParametricEQBandType.NOTCH,
  ].includes(type);
};

interface Viewport {
  width: number;
  height: number;
  min_gain: number;
  max_gain: number;
  min_freq: number;
  max_freq: number;
  padding_lr: number;
  padding_tb: number;
}

const viewport = ref<Viewport>({
  width: 0,
  height: 0,
  min_gain: -20,
  max_gain: 20,
  min_freq: 20,
  max_freq: 20000,
  padding_lr: 40,
  padding_tb: 20,
});

// Graph drawing functions
const drawGraph = () => {
  if (!canvas.value || !graphContainer.value) return;
  const isDark = theme.global.current.value.dark;

  const ctx = canvas.value.getContext("2d");
  if (!ctx) return;

  // Set canvas size
  canvas.value.width = graphContainer.value.clientWidth * 2;
  canvas.value.height = graphContainer.value.clientHeight * 2;
  viewport.value.width = canvas.value.width / 2;
  viewport.value.height = canvas.value.height / 2;
  ctx.scale(2, 2); // For retina displays

  // Clear canvas
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);

  // Draw frequency grid
  drawGrid(ctx, viewport.value);

  const width = ctx.canvas.width / 2;
  const height = ctx.canvas.height / 2;
  const totalResponse = new Float32Array(width);

  // Draw individual filter responses
  peq.value.bands.forEach((band, index) => {
    if (band.enabled) {
      let color = `hsla(${(index * 360) / peq.value.bands.length}, 60%, ${isDark ? 70 : 50}%, 0.5)`;

      ctx.beginPath();
      if (index === selectedBandIndex.value) {
        ctx.lineWidth = 5;
        color = `hsla(${(index * 360) / peq.value.bands.length}, 70%, ${isDark ? 70 : 60}%, 1)`;
      } else {
        ctx.lineWidth = 2;
      }
      ctx.strokeStyle = color;

      const frequencies = new Float32Array(width);
      for (let x = 0; x < width; x++) {
        frequencies[x] = xToFreq(x, viewport.value);
      }

      const magResponse = new Float32Array(width);
      const phaseResponse = new Float32Array(width);
      const filter = createBiquadFilter(audioContext, band);
      filter.getFrequencyResponse(frequencies, magResponse, phaseResponse);

      for (
        let x = viewport.value.padding_lr;
        x < width - viewport.value.padding_lr;
        x++
      ) {
        const response = 20 * Math.log10(magResponse[x]);
        totalResponse[x] += response;
        const y = gainToY(response, viewport.value);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      // Draw handle for the band
      const handleX = freqToX(band.frequency, viewport.value);
      const handleY = gainToY(band.gain, viewport.value);

      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(handleX, handleY, 6, 0, 2 * Math.PI);

      ctx.fill();
    }
  });
  ctx.lineWidth = 2;
  if (isDark) {
    ctx.strokeStyle = "#fff";
  } else {
    ctx.strokeStyle = "#000";
  }

  ctx.beginPath();
  for (
    let x = viewport.value.padding_lr;
    x < width - viewport.value.padding_lr;
    x++
  ) {
    const y = gainToY(totalResponse[x], viewport.value);

    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
};

const createBiquadFilter = (
  context: AudioContext,
  band: ParametricEQBand,
): BiquadFilterNode => {
  const filter = context.createBiquadFilter();
  switch (band.type) {
    case ParametricEQBandType.HIGH_PASS:
      filter.type = "highpass";
      break;
    case ParametricEQBandType.LOW_PASS:
      filter.type = "lowpass";
      break;
    case ParametricEQBandType.HIGH_SHELF:
      filter.type = "highshelf";
      break;
    case ParametricEQBandType.LOW_SHELF:
      filter.type = "lowshelf";
      break;
    case ParametricEQBandType.NOTCH:
      filter.type = "notch";
      break;
    case ParametricEQBandType.PEAK:
      filter.type = "peaking";
      break;
  }
  filter.frequency.value = band.frequency;
  filter.Q.value = band.q;
  filter.gain.value = band.gain;
  return filter;
};

const audioContext = new AudioContext();

const biquadFilters = computed(() => {
  return peq.value.bands.map((band) => createBiquadFilter(audioContext, band));
});

const selectedBandIndex = ref(0);

// Computed property for the selected band
const selectedBand = computed(() => peq.value.bands[selectedBandIndex.value]);

const removeBand = (index: number) => {
  peq.value.bands.splice(index, 1);
  // Adjust selected index if necessary
  if (selectedBandIndex.value >= peq.value.bands.length) {
    selectedBandIndex.value = peq.value.bands.length - 1;
  }
};

const addBand = () => {
  const newIndex = peq.value.bands.length;
  peq.value.bands.push({
    frequency: 1000,
    q: 1.0,
    gain: 0,
    type: ParametricEQBandType.PEAK,
    enabled: true,
  });
  selectedBandIndex.value = newIndex;
};

// Watch for changes and redraw
watch(() => peq.value.bands, drawGraph, { deep: true });
watch(() => selectedBandIndex.value, drawGraph);
watch(() => theme.global.current.value.dark, drawGraph);

onMounted(() => {
  drawGraph();
  window.addEventListener("resize", drawGraph);
});

// Convert between screen and frequency coordinates
const freqToX = (freq: number, viewport: Viewport): number => {
  const logFreq = Math.log2(freq / viewport.min_freq);
  const logMax = Math.log2(viewport.max_freq / viewport.min_freq);
  return (
    (logFreq / logMax) * (viewport.width - viewport.padding_lr * 2) +
    viewport.padding_lr
  );
};

const xToFreq = (x: number, viewport: Viewport): number => {
  const logMax = Math.log2(viewport.max_freq / viewport.min_freq);
  const freq =
    viewport.min_freq *
    Math.pow(
      2,
      ((x - viewport.padding_lr) / (viewport.width - viewport.padding_lr * 2)) *
        logMax,
    );
  return Math.min(Math.max(freq, viewport.min_freq), viewport.max_freq);
};

const gainToY = (gain: number, viewport: Viewport): number => {
  return (
    viewport.height / 2 -
    (gain * (viewport.height - 2 * viewport.padding_tb)) /
      (2 * Math.max(Math.abs(viewport.min_gain), Math.abs(viewport.max_gain)))
  );
};

const yToGain = (y: number, viewport: Viewport): number => {
  return (
    -(
      (y - (viewport.height / 2 - viewport.padding_tb)) *
      2 *
      Math.max(Math.abs(viewport.min_gain), Math.abs(viewport.max_gain))
    ) /
    (viewport.height - 2 * viewport.padding_tb)
  );
};

// Draw frequency response grid
const drawGrid = (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
  const width = ctx.canvas.width / 2;
  const height = ctx.canvas.height / 2;
  const isDark = theme.global.current.value.dark;

  if (isDark) {
    ctx.fillStyle = "#eee";
    ctx.strokeStyle = "#eee";
  } else {
    ctx.fillStyle = "#222";
    ctx.strokeStyle = "#666";
  }
  ctx.lineWidth = 1;

  // Draw frequency lines
  const frequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  frequencies.forEach((freq) => {
    const x = freqToX(freq, viewport);
    ctx.beginPath();
    ctx.moveTo(x, viewport.padding_tb);
    ctx.lineTo(x, height - viewport.padding_tb);
    ctx.stroke();

    // Draw frequency labels
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      freq >= 1000 ? `${freq / 1000}k` : freq.toString(),
      x,
      height - 5,
    );
  });

  // Draw gain lines
  const gains = [];
  const gainRange = viewport.max_gain - viewport.min_gain;
  const gainStep = Math.ceil(gainRange / (viewport.height / 30));

  for (
    let gain = viewport.min_gain;
    gain <= viewport.max_gain;
    gain += gainStep
  ) {
    const y = gainToY(gain, viewport);
    ctx.beginPath();
    ctx.moveTo(viewport.padding_lr, y);
    ctx.lineTo(width - viewport.padding_lr, y);
    ctx.stroke();

    // Draw gain labels
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${gain}dB`, viewport.padding_lr - 3, y + 3);
  }
};

// Add resize observer
onMounted(() => {
  const resizeObserver = new ResizeObserver(() => {
    drawGraph();
  });

  if (graphContainer.value) {
    resizeObserver.observe(graphContainer.value);
  }

  return () => {
    resizeObserver.disconnect();
  };
});
</script>

<style scoped>
.graph-container {
  position: relative;
  aspect-ratio: 7/2;
  width: 100%;
  background: var(--v-surface-variant);
  border-radius: 4px;
  overflow: hidden;
}

.frequency-graph {
  width: 100%;
  height: 100%;
}
</style>
