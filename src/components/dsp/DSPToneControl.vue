<template>
  <v-card-item>
    <DSPSlider
      v-model="tone_control.bass_level"
      :type="{
        min: -10,
        max: 10,
        step: 0.1,
        label: $t('settings.dsp.tone_control.bass_level'),
        unit: 'dB',
      }"
    />
  </v-card-item>
  <v-card-item>
    <DSPSlider
      v-model="tone_control.mid_level"
      :type="{
        min: -10,
        max: 10,
        step: 0.1,
        label: $t('settings.dsp.tone_control.mid_level'),
        unit: 'dB',
      }"
    />
  </v-card-item>
  <v-card-item>
    <DSPSlider
      v-model="tone_control.treble_level"
      :type="{
        min: -10,
        max: 10,
        step: 0.1,
        label: $t('settings.dsp.tone_control.treble_level'),
        unit: 'dB',
      }"
    />
  </v-card-item>
</template>
<script setup lang="ts">
import { ToneControlFilter } from "@/plugins/api/interfaces";
import DSPSlider from "./DSPSlider.vue";

const tone_control = defineModel<ToneControlFilter>({ required: true });
</script>
