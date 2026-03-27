<template>
  <div class="p-2">
    <div class="flex flex-wrap justify-end items-center gap-2 pr-2">
      <!-- Multichannel options -->
      <Button
        v-if="!showMultiChannelControls"
        variant="outline"
        @click="
          () => {
            showMultiChannelControls = true;
          }
        "
      >
        <AudioLines class="mr-2" :size="18" />
        {{ $t("settings.dsp.parametric_eq.show_multichannel_controls") }}
      </Button>
      <Select
        v-else
        v-model="editedChannel"
      >
        <SelectTrigger class="p-2" style="min-width: 250px">
          <SelectValue :placeholder="$t('settings.dsp.parametric_eq.edited_channel')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="ch in channelTypes"
            :key="ch.value"
            :value="ch.value"
          >
            {{ ch.title }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Import/Export Buttons to Load/Save Equalizer APO Settings -->
      <Button variant="outline" @click="openApoFileImport">
        <FileDown class="mr-2" :size="18" />
        {{ $t("settings.dsp.parametric_eq.import_apo") }}
      </Button>

      <Button variant="outline" @click="exportApoSettings">
        <FileUp class="mr-2" :size="18" />
        {{ $t("settings.dsp.parametric_eq.export_apo") }}
      </Button>

      <input
        ref="fileInputRef"
        type="file"
        accept=".txt"
        class="hidden"
        @change="handleApoUpload"
      />
    </div>

    <!-- Frequency Response Graph with Dark Theme Support -->
    <div>
      <div ref="graphContainer" class="graph-container">
        <canvas ref="canvas" class="frequency-graph"></canvas>
      </div>
    </div>

    <!-- Band Management Section -->
    <div class="border-t border-b">
      <!-- Band Selection with Visual Indicators -->
      <div class="p-2">
        <div class="flex flex-wrap gap-2 mb-0 p-2">
          <Badge
            :class="['cursor-pointer', selectedBandIndex === -1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground']"
            @click="selectedBandIndex = -1"
          >
            {{ $t("settings.dsp.parametric_eq.preamp", { index: 100 }) }}
          </Badge>
          <Badge
            v-for="(band, index) in peq.bands"
            :key="index"
            :class="[
              'cursor-pointer',
              selectedBandIndex === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              !band.enabled ? 'opacity-50' : '',
            ]"
            @click="selectedBandIndex = index"
          >
            {{
              band.channel === AudioChannel.ALL
                ? $t("settings.dsp.parametric_eq.band", { index: index + 1 })
                : $t("settings.dsp.parametric_eq.band_channel", {
                    index: index + 1,
                    channel: $t(
                      `settings.dsp.channels_compact.${band.channel}`,
                    ),
                  })
            }}
          </Badge>
          <Badge
            variant="outline"
            class="cursor-pointer"
            @click="addBand"
          >
            <Plus class="h-3 w-3 mr-1" />
            {{
              editedChannel === AudioChannel.ALL
                ? $t("settings.dsp.parametric_eq.add_band")
                : $t("settings.dsp.parametric_eq.add_band_channel", {
                    channel: $t(`settings.dsp.channels.${editedChannel}`),
                  })
            }}
          </Badge>
        </div>
      </div>
    </div>
    <div v-if="selectedBandIndex === -1" class="p-4">
      <!-- Filter Controls -->
      <div>
        <DSPSlider v-model="preamp" type="gain" />
        <DSPSlider
          v-if="editedChannel !== AudioChannel.ALL"
          v-model="channelPreamp"
          :type="{
            min: -15,
            max: 15,
            step: 0.1,
            label: $t('settings.dsp.parametric_eq.per_channel_preamp', {
              channel: $t(`settings.dsp.channels.${editedChannel}`),
            }),
            unit: 'dB',
            is_log: false,
          }"
        />
      </div>
    </div>

    <!-- Band Controls Card -->
    <template v-if="selectedBand">
      <div class="p-4">
        <!-- Band Header -->
        <div class="flex items-center pl-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <Switch
              :model-value="selectedBand.enabled"
              @update:model-value="(val: boolean) => { selectedBand.enabled = val; }"
            />
            <span>{{ $t('settings.dsp.parametric_eq.enable_band') }}</span>
          </label>
          <div class="flex-1" />
          <Button
            variant="destructive"
            @click="removeBand(selectedBandIndex)"
          >
            <Trash2 class="h-4 w-4 mr-2" />
            {{ $t("settings.dsp.parametric_eq.delete_band") }}
          </Button>
        </div>
      </div>

      <!-- Filter Controls -->
      <div class="p-4">
        <Select v-model="selectedBand.type">
          <SelectTrigger>
            <SelectValue :placeholder="$t('settings.dsp.parametric_eq.filter_type')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="ft in filterTypes"
              :key="ft.value"
              :value="ft.value"
            >
              {{ ft.title }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DSPSlider v-model="selectedBand.frequency" type="frequency" />

      <DSPSlider
        v-if="showGainParameter(selectedBand.type)"
        v-model="selectedBand.gain"
        type="gain"
      />

      <DSPSlider v-model="selectedBand.q" type="q" />

      <div v-if="showMultiChannelControls" class="p-4">
        <Select v-model="selectedBand.channel">
          <SelectTrigger>
            <SelectValue :placeholder="$t('settings.dsp.parametric_eq.channel')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="ch in channelTypes"
              :key="ch.value"
              :value="ch.value"
            >
              {{ ch.title }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useIsDark } from "@/composables/useIsDark";
import { FileDown, FileUp, Plus, AudioLines, Trash2 } from "lucide-vue-next";
import { ref, onMounted, watch, computed, nextTick, watchEffect } from "vue";
import {
  ParametricEQBand,
  ParametricEQBandType,
  AudioChannel,
  ParametricEQFilter,
} from "@/plugins/api/interfaces";
import DSPSlider from "./DSPSlider.vue";
import { $t } from "@/plugins/i18n";

const apoToBandType: Record<string, ParametricEQBandType> = {
  PK: ParametricEQBandType.PEAK,
  PEQ: ParametricEQBandType.PEAK,
  HP: ParametricEQBandType.HIGH_PASS,
  HPQ: ParametricEQBandType.HIGH_PASS,
  LP: ParametricEQBandType.LOW_PASS,
  LPQ: ParametricEQBandType.LOW_PASS,
  LS: ParametricEQBandType.LOW_SHELF,
  HS: ParametricEQBandType.HIGH_SHELF,
  NO: ParametricEQBandType.NOTCH,
  // Currently not supported are:
  // Modal, BP, LSC x dB, HS x dB, AP, LS with dB slope, HS with dB slope
  // and any other non Parametric EQ types
};

const bandTypeToApo: Record<ParametricEQBandType, string> = {
  [ParametricEQBandType.PEAK]: "PK",
  [ParametricEQBandType.HIGH_PASS]: "HP",
  [ParametricEQBandType.LOW_PASS]: "LP",
  [ParametricEQBandType.LOW_SHELF]: "LS",
  [ParametricEQBandType.HIGH_SHELF]: "HS",
  [ParametricEQBandType.NOTCH]: "NO",
};

const channelTypes = Object.entries(AudioChannel).map(([key, value]) => ({
  title: $t(`settings.dsp.channels.${key}`),
  value,
}));

const importApoSettings = (content: string) => {
  const filters = [];
  const lines = content.split("\n");
  const bands: ParametricEQBand[] = [];
  let usesChannelField = false;
  let importPreamp: Partial<Record<AudioChannel, number>> = {};

  // Default to all channels
  let currentChannel = AudioChannel.ALL;

  for (const line of lines) {
    if (line.startsWith("Channel:")) {
      // Parse channel selection
      const channelMatch = line.match(/Channel:\s*(.+)/);
      if (channelMatch && channelMatch[1]) {
        const channelStr = channelMatch[1].trim().toUpperCase();
        if (
          channelStr === "ALL" ||
          channelStr === "1 2" ||
          channelStr === "L R"
        ) {
          currentChannel = AudioChannel.ALL;
        } else if (
          channelStr === "L" ||
          channelStr === "1" ||
          channelStr === "FL"
        ) {
          currentChannel = AudioChannel.FL;
          usesChannelField = true;
        } else if (
          channelStr === "R" ||
          channelStr === "2" ||
          channelStr === "FR"
        ) {
          currentChannel = AudioChannel.FR;
          usesChannelField = true;
        }
      }
      if (!importPreamp[currentChannel]) {
        importPreamp[currentChannel] = 0; // So we know the config specified this channel
      }
    } else if (line.startsWith("Filter")) {
      // Parses filter settings from REW or Equalizer APO text format.
      // Syntax of APO (from https://sourceforge.net/p/equalizerapo/wiki/Configuration%20reference/):
      // Filter <n>: ON <Type> Fc <Frequency> Hz Gain <Gain value> dB Q <Q value>
      // Filter <n>: ON <Type> Fc <Frequency> Hz Gain <Gain value> dB BW Oct <Bandwidth value>
      // Matches patterns like:
      // - "Filter 1: ON PK Fc 29.15 Hz Gain -9.60 dB Q 1.007" (REW)
      // - "Filter: ON PK 29.15 Hz -9.60 dB 1.007" (EQ APO)
      const match = line.match(
        /Filter(?:\s+\d+)?:\s+(ON|OFF)\s+(\w+)\s+(?:Fc\s+)?(\d+\.?\d*)\s*(?:Hz)?\s+(?:Gain\s+)?(-?\d+\.?\d*)\s+dB\s+(?:(?:Q\s+)?(\d+\.?\d*)|(?:BW\s+Oct\s+)(\d+\.?\d*))/,
      );

      if (match) {
        const [_, enabled, type, frequency, gain, q, bw] = match;
        // Convert BW to Q if BW is present
        const finalQ = bw ? bandwidthToQ(parseFloat(bw)) : parseFloat(q);
        if (type !== "None") {
          bands.push({
            frequency: parseFloat(frequency),
            gain: parseFloat(gain),
            q: parseFloat(q),
            type: apoToBandType[type] || ParametricEQBandType.PEAK,
            enabled: enabled === "ON",
            channel: currentChannel,
          });
        }
      }
    } else if (line.startsWith("Preamp")) {
      const match = line.match(/Preamp:\s*(-?\d+\.?\d*)\s+dB/);
      if (match) {
        importPreamp[currentChannel] = parseFloat(match[1]);
      }
    }
  }

  let existingBands: ParametricEQBand[];
  if (usesChannelField) {
    // Preserve existing bands for channels not in the import
    // So users with split channel presets can import them one after the other
    // regular presets without that will still clear everything
    existingBands = peq.value.bands.filter((band) => {
      // Keep bands whose channel isn't in the imported content
      return !bands.some(
        (newBand) =>
          newBand.channel === band.channel ||
          newBand.channel === AudioChannel.ALL ||
          band.channel === AudioChannel.ALL,
      );
    });
  } else if (editedChannel.value !== AudioChannel.ALL) {
    // This is a regular EQ preset that applies to all channels, but the user
    // selected the graph of a specific channel. We'll assume that they want
    // to import it to that channel only
    existingBands = peq.value.bands.filter(
      // Remove bands that are made for the ALL, or the selected channel
      (band) =>
        band.channel !== AudioChannel.ALL &&
        band.channel !== editedChannel.value,
    );
    if (importPreamp.ALL) {
      // Move the global preamp to the selected channel only
      importPreamp[editedChannel.value] = importPreamp.ALL;
      importPreamp.ALL = 0; // Clear the global preamp
    }
    // Make all bands channel specific
    bands.forEach((band) => {
      band.channel = editedChannel.value;
    });
  } else {
    // All channels preset, applied to all channels
    // Clear all existing bands and preamps
    existingBands = [];
    peq.value.per_channel_preamp = {};
  }

  // Update the PEQ bands
  peq.value.bands = [...existingBands, ...bands];

  // update preamp if specified in import
  if (Object.keys(importPreamp).length > 0) {
    if (importPreamp.ALL) {
      peq.value.preamp = importPreamp.ALL;
    }
    // But keep preamp of unaffected channels the same (if no preamp or band for that channel in the import)
    Object.entries(importPreamp).forEach(([channel, value]) => {
      if (channel === AudioChannel.ALL) return;
      peq.value.per_channel_preamp[channel as AudioChannel] = value;
    });
  } else {
    // Clear it otherwise
    peq.value.preamp = 0;
    peq.value.per_channel_preamp = {};
  }
  nextTick(() => {
    selectedBandIndex.value = -1;
  });
};

// Helper function to convert bandwidth to Q factor
function bandwidthToQ(bw: number): number {
  // from https://sengpielaudio.com/calculator-bandwidth.htm
  return Math.sqrt(Math.pow(2, bw)) / (Math.pow(2, bw) - 1);
}

const handleApoUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      if (e.target?.result) {
        importApoSettings(e.target.result as string);
      }
    };

    reader.readAsText(file);
  }
};

const fileInputRef = ref<HTMLInputElement | null>(null);

const openApoFileImport = () => {
  fileInputRef.value?.click();
};

const exportApoSettings = () => {
  let content = "";

  // Add global preamp
  content += `Preamp: ${preamp.value.toFixed(2)} dB\n`;

  if (isMultiChannel.value) {
    // Export bands by channel
    const channels = Object.values(AudioChannel);

    for (const channel of channels) {
      // Skip ALL channel as we handle it separately
      if (channel === AudioChannel.ALL) continue;

      // Get channel name for comment
      const channelName =
        channelTypes.find((c) => c.value === channel)?.title || channel;
      content += `\n# ${channelName}\n`;
      content += `Channel: ${channel === AudioChannel.FL ? "L" : "R"}\n`;

      // Add per-channel preamp if it exists
      if (peq.value.per_channel_preamp[channel] !== undefined) {
        content += `Preamp: ${peq.value.per_channel_preamp[channel].toFixed(2)} dB\n`;
      }

      // Add channel-specific bands and ALL bands
      let filterIndex = 1;
      peq.value.bands.forEach((band) => {
        if (band.channel === channel || band.channel === AudioChannel.ALL) {
          const apoType = bandTypeToApo[band.type];
          content += `Filter ${filterIndex++}: ${band.enabled ? "ON" : "OFF"} ${apoType} Fc ${band.frequency.toFixed(1)} Hz Gain ${band.gain.toFixed(2)} dB Q ${band.q.toFixed(3)}\n`;
        }
      });
    }
  } else {
    // Simple export (only ALL channel bands)
    peq.value.bands.forEach((band, index) => {
      const apoType = bandTypeToApo[band.type];
      content += `Filter ${index + 1}: ${band.enabled ? "ON" : "OFF"} ${apoType} Fc ${band.frequency.toFixed(1)} Hz Gain ${band.gain.toFixed(2)} dB Q ${band.q.toFixed(3)}\n`;
    });
  }

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `music_assistant_eq_settings_${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const isDark = useIsDark();

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

  // Function to draw a single band's response curve
  const drawBandResponse = (
    band: ParametricEQBand,
    index: number,
    ctx: CanvasRenderingContext2D,
  ) => {
    let color = `hsla(${(index * 360) / peq.value.bands.length}, 60%, ${isDark.value ? 70 : 50}%, 0.5)`;

    ctx.beginPath();
    if (index === selectedBandIndex.value) {
      ctx.lineWidth = 5;
      color = `hsla(${(index * 360) / peq.value.bands.length}, 70%, ${isDark.value ? 70 : 60}%, 1)`;
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
      const y = gainToY(response, viewport.value);

      if (x === viewport.value.padding_lr) {
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

    return { frequencies, magResponse };
  };

  // Function to draw the response curve for a channel
  const drawChannelResponse = (
    response: Float32Array,
    ctx: CanvasRenderingContext2D,
  ) => {
    ctx.lineWidth = 3;
    if (isDark.value) {
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
      const y = gainToY(response[x], viewport.value);

      if (x === viewport.value.padding_lr) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  };

  // Skip drawing the multi channel version if this a simple PEQ with only ALL channel filters

  if (editedChannel.value === AudioChannel.ALL && isMultiChannel.value) {
    // Get all channels (excluding ALL)
    const channels = Object.values(AudioChannel).filter(
      (ch) => ch !== AudioChannel.ALL,
    );

    // Create a response array for each channel
    const channelResponses: Record<AudioChannel, Float32Array> = {} as Record<
      AudioChannel,
      Float32Array
    >;
    channels.forEach((channel) => {
      channelResponses[channel] = new Float32Array(width).fill(
        (peq.value.preamp ?? 0) + (peq.value.per_channel_preamp[channel] ?? 0),
      );
    });

    // Draw individual filter responses
    peq.value.bands.forEach((band, index) => {
      if (band.enabled) {
        const { frequencies, magResponse } = drawBandResponse(band, index, ctx);

        // Add band response to appropriate channel(s)
        if (band.channel === AudioChannel.ALL) {
          // Add to all channels
          channels.forEach((ch) => {
            for (let x = 0; x < width; x++) {
              channelResponses[ch][x] += 20 * Math.log10(magResponse[x]);
            }
          });
        } else {
          // Add to specific channel
          for (let x = 0; x < width; x++) {
            channelResponses[band.channel][x] +=
              20 * Math.log10(magResponse[x]);
          }
        }
      }
    });

    // Draw a separate total response curve for each channel
    // We don't color code these since each bands curve is already colored
    // The user can select a channel to know what is what
    channels.forEach((channel) => {
      drawChannelResponse(channelResponses[channel], ctx);
    });
  } else {
    // Single channel view
    const totalResponse = new Float32Array(width).fill(
      (peq.value.preamp ?? 0) +
        (peq.value.per_channel_preamp[editedChannel.value] ?? 0),
    );

    // Draw individual filter responses
    peq.value.bands.forEach((band, index) => {
      if (
        (band.enabled && band.channel === editedChannel.value) ||
        band.channel === AudioChannel.ALL
      ) {
        const { magResponse } = drawBandResponse(band, index, ctx);

        // Add to total response
        for (let x = 0; x < width; x++) {
          totalResponse[x] += 20 * Math.log10(magResponse[x]);
        }
      }
    });

    // Draw total response curve with all bands applied
    drawChannelResponse(totalResponse, ctx);
  }
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

const isMultiChannel = computed(() => {
  return (
    peq.value.bands.some((band) => band.channel !== AudioChannel.ALL) ||
    (Object.keys(peq.value.per_channel_preamp).length > 0 &&
      Object.values(peq.value.per_channel_preamp).some((gain) => gain !== 0))
  );
});

const showMultiChannelControls = ref(false);

const selectedBandIndex = ref(-1);

const editedChannel = ref(AudioChannel.ALL);

// Computed property for the selected band
const selectedBand = computed(() => peq.value.bands[selectedBandIndex.value]);

// Since preamp could be undefined if the EQ was made with an older version
const preamp = computed({
  get: () => peq.value.preamp ?? 0,
  set: (value) => {
    peq.value.preamp = value;
  },
});

const channelPreamp = computed({
  get: () => peq.value.per_channel_preamp[editedChannel.value] ?? 0,
  set: (value) => {
    if (editedChannel.value !== AudioChannel.ALL) {
      peq.value.per_channel_preamp[editedChannel.value] = value;
    }
  },
});

const removeBand = (index: number) => {
  peq.value.bands.splice(index, 1);
  // Adjust selected index if necessary
  if (selectedBandIndex.value >= peq.value.bands.length) {
    nextTick(() => {
      selectedBandIndex.value = peq.value.bands.length - 1;
    });
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
    channel: editedChannel.value,
  });
  nextTick(() => {
    selectedBandIndex.value = newIndex;
  });
};

// Watch for changes and redraw
watch(() => peq.value.preamp, drawGraph);
watch(() => peq.value.per_channel_preamp, drawGraph, { deep: true });
watch(
  () => (selectedBandIndex.value, peq.value.bands),
  () => {
    if (selectedBandIndex.value >= peq.value.bands.length) {
      selectedBandIndex.value = peq.value.bands.length - 1;
    }
    drawGraph();
  },
  { deep: true },
);
watch(() => editedChannel.value, drawGraph);
watch(isDark, drawGraph);

// Auto enable if the user selects a multichannel EQ
watchEffect(() => {
  if (isMultiChannel.value) showMultiChannelControls.value = true;
});

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

  if (isDark.value) {
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
  background: var(--muted);
  border-radius: 4px;
  overflow: hidden;
}

.frequency-graph {
  width: 100%;
  height: 100%;
}
</style>
