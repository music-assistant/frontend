<template>
  <DSPSlider
    v-model="tone_control.bass_level"
    :type="{
      min: -10,
      max: 10,
      step: 0.1,
      label: $t('settings.dsp.tone_control.bass_level'),
      unit: 'dB',
      is_log: false,
    }"
  />
  <DSPSlider
    v-model="tone_control.mid_level"
    :type="{
      min: -10,
      max: 10,
      step: 0.1,
      label: $t('settings.dsp.tone_control.mid_level'),
      unit: 'dB',
      is_log: false,
    }"
  />
  <DSPSlider
    v-model="tone_control.treble_level"
    :type="{
      min: -10,
      max: 10,
      step: 0.1,
      label: $t('settings.dsp.tone_control.treble_level'),
      unit: 'dB',
      is_log: false,
    }"
  />

  <div class="px-4">
    <Alert variant="info" class="mb-4">
      <Info />
      <AlertDescription>
        {{ $t("settings.dsp.tone_control.help") }}
      </AlertDescription>
    </Alert>
  </div>
</template>
<script setup lang="ts">
import { Info } from "@lucide/vue";
import { ToneControlFilter } from "@/plugins/api/interfaces";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DSPSlider from "./DSPSlider.vue";

const tone_control = defineModel<ToneControlFilter>({ required: true });
</script>
