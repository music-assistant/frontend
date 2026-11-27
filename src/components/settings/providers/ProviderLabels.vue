<template>
  <span v-if="shownLabels.length" data-testid="provider-labels">
    <template v-for="(label, index) in shownLabels" :key="label">
      <template v-if="index"> · </template>
      <span :data-label="label">{{ $t(PROVIDER_LABEL_KEYS[label]) }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import {
  getShownLabels,
  PROVIDER_LABEL_KEYS,
  type ProviderLabel,
} from "@/helpers/provider_labels";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * The labels saying what a provider offers, as plain text joined by dots;
 * nothing when it has none.
 */
const props = defineProps<{
  labels: readonly ProviderLabel[];
}>();

const shownLabels = computed(() => getShownLabels(props.labels));
</script>
