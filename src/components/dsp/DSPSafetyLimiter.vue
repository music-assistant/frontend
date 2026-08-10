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

    <div class="px-4">
      <Alert variant="info" class="mb-4 mt-2">
        <Info />
        <AlertDescription>
          {{ $t("settings.dsp.safety_limiter.help") }}
        </AlertDescription>
      </Alert>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Info } from "@lucide/vue";
import { SafetyLimiterFilter } from "@/plugins/api/interfaces";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DSPSlider from "./DSPSlider.vue";

const limiter = defineModel<SafetyLimiterFilter>({ required: true });
</script>
