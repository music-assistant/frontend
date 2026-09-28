<template>
  <div>
    <DSPSlider
      v-model="limiter.ceiling"
      :type="{
        min: -24,
        max: 0,
        step: 0.1,
        label: $t('settings.dsp.safety_limiter.ceiling'),
        unit: 'dB',
        is_log: false,
      }"
    />

    <DSPHelp :text="$t('settings.dsp.safety_limiter.help')" />
  </div>
</template>
<script setup lang="ts">
import { SafetyLimiterFilter } from "@/plugins/api/interfaces";
import DSPHelp from "./DSPHelp.vue";
import DSPSlider from "./DSPSlider.vue";

const limiter = defineModel<SafetyLimiterFilter>({ required: true });
</script>
