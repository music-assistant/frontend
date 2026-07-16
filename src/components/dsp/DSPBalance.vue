<template>
  <DSPSlider
    v-model="balance.balance"
    :type="{
      min: -100,
      max: 100,
      step: 1,
      label: $t('settings.dsp.balance.balance'),
      unit: '',
      is_log: false,
    }"
  />
</template>
<script setup lang="ts">
import { BalanceFilter } from "@/plugins/api/interfaces";
import DSPSlider from "./DSPSlider.vue";

const balance = defineModel<BalanceFilter>({ required: true });
</script>
