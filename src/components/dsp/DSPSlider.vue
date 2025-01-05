<template>
  <v-card flat color="transparent">
    <v-card-text class="d-flex align-center gap-4">
      <span style="min-width: 100px" class="v-label pl-2">{{
        config.label
      }}</span>
      <v-slider
        v-model="model"
        :min="config.min"
        :max="config.max"
        :step="config.step"
        hide-details
        class="flex-grow-1 pr-4"
        density="compact"
        color="primary"
      />
      <v-text-field
        v-model="displayValue"
        type="number"
        hide-details
        density="compact"
        style="max-width: 100px"
        @focus="isEditing = true"
        @blur="isEditing = false"
      />
      <span style="min-width: 40px" class="pl-2">{{ config.unit }}</span>
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
    };
  } else if (props.type === "q") {
    return {
      min: 0.1,
      max: 20,
      step: 0.1,
      label: $t("settings.dsp.parameter.q_factor"),
      unit: "",
    };
  } else if (props.type === "frequency") {
    return {
      min: 20,
      max: 20000,
      step: 1,
      label: $t("settings.dsp.parameter.frequency"),
      unit: "Hz",
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
    if (model.value > 1000) return model.value.toFixed(0);
    if (model.value > 100) return model.value.toFixed(1);
    return model.value.toFixed(2);
  },
  set: (value: string) => {
    model.value = Number(value);
  },
});
</script>
