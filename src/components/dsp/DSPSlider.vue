<template>
  <v-card flat color="transparent">
    <!-- Below @sm the value entry wraps below so the slider keeps a usable width. -->
    <v-card-text class="@container">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span style="min-width: 100px" class="v-label pl-2">{{
          config.label
        }}</span>
        <v-slider
          v-model="sliderModel"
          :min="sliderMin"
          :max="sliderMax"
          :step="sliderStep"
          hide-details
          class="min-w-0 flex-1 pr-4"
          density="compact"
          color="primary"
        />
        <div
          class="order-last flex w-full items-center justify-end gap-2 @sm:order-none @sm:w-auto @sm:justify-start"
        >
          <v-text-field
            v-model="displayValue"
            type="number"
            hide-details
            density="compact"
            style="max-width: 100px"
            :aria-label="config.label"
            @focus="isEditing = true"
            @blur="isEditing = false"
          />
          <span style="min-width: 40px">{{ config.unit }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { ref, computed } from "vue";

type ParameterConfig = {
  // Minimum value for the slider
  min: number;
  // Maximum value for the slider
  max: number;
  // Step increment for the slider
  step: number;
  label: string;
  unit: string;
  // Whether the slider should behave logarithmically
  is_log: boolean;
  // Fixed decimal places for the readout; falls back to magnitude-based
  // formatting when unset.
  decimals?: number;
};

const props = defineProps<{
  type: "gain" | "q" | "frequency" | ParameterConfig;
}>();

const model = defineModel<number>({ required: true });
const isEditing = ref(false);

const config = computed((): ParameterConfig => {
  if (props.type === "gain") {
    return {
      min: -15,
      max: 15,
      step: 0.1,
      label: $t("settings.dsp.parameter.gain"),
      unit: "dB",
      is_log: false,
    };
  } else if (props.type === "q") {
    return {
      min: 0.1,
      max: 20,
      step: 0.1,
      label: $t("settings.dsp.parameter.q_factor"),
      unit: "",
      is_log: false,
    };
  } else if (props.type === "frequency") {
    return {
      min: 20,
      max: 20000,
      step: 1,
      label: $t("settings.dsp.parameter.frequency"),
      unit: "Hz",
      is_log: true,
    };
  } else {
    return props.type;
  }
});

// Computed property for compact display of the value
const displayValue = computed({
  get: () => {
    if (isEditing.value) {
      return model.value.toString();
    }
    if (config.value.decimals !== undefined) {
      return model.value.toFixed(config.value.decimals);
    }
    if (model.value > 1000) return model.value.toFixed(0);
    if (model.value > 100) return model.value.toFixed(1);
    return model.value.toFixed(2);
  },
  set: (value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    // Clamp to range so a typed readout can't push a (log) slider out of bounds.
    model.value = Math.min(config.value.max, Math.max(config.value.min, num));
  },
});

// Computed properties for the slider model
const sliderModel = computed({
  get: () => {
    if (config.value.is_log) {
      return Math.log10(model.value);
    } else {
      return model.value;
    }
  },
  set: (value: number) => {
    if (config.value.is_log) {
      model.value = Math.pow(10, value);
    } else {
      model.value = value;
    }
  },
});
const sliderMax = computed(() => {
  if (config.value.is_log) {
    return Math.log10(config.value.max);
  } else {
    return config.value.max;
  }
});
const sliderMin = computed(() => {
  if (config.value.is_log) {
    return Math.log10(config.value.min);
  } else {
    return config.value.min;
  }
});
const sliderStep = computed(() => {
  if (config.value.is_log) {
    return Math.log10(config.value.step);
  } else {
    return config.value.step;
  }
});
</script>
