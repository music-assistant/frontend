<template>
  <DSPSlider v-model="gain.gain" type="gain" />
</template>
<script setup lang="ts">
import { GainFilter } from "@/plugins/api/interfaces";
import DSPSlider from "./DSPSlider.vue";

const gain = defineModel<GainFilter>({ required: true });
</script>
