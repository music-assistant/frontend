<template>
  <div
    v-if="shownLabels.length"
    class="flex flex-wrap gap-1"
    data-testid="provider-labels"
  >
    <Badge
      v-for="label in shownLabels"
      :key="label"
      variant="secondary"
      :class="label === 'live' ? LIVE_CLASS : undefined"
      :data-label="label"
    >
      {{ $t(PROVIDER_LABEL_KEYS[label]) }}
    </Badge>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { OTHER_PLUGIN_LABEL } from "@/helpers/plugin_labels";
import {
  PROVIDER_LABEL_KEYS,
  type ProviderLabel,
} from "@/helpers/provider_labels";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * The labels saying what a provider offers, as a row of small badges; nothing
 * when it has none.
 */
const props = defineProps<{
  labels: readonly ProviderLabel[];
}>();

// a live source stands apart from the sources of music to browse
const LIVE_CLASS = "bg-orange-500/15 text-orange-700 dark:text-orange-300";

// other only gathers the plugins without a label for the filter, so it tells
// nothing about one
const shownLabels = computed(() =>
  props.labels.filter((label) => label !== OTHER_PLUGIN_LABEL),
);
</script>
