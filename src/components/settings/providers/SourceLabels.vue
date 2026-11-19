<template>
  <div
    v-if="labels.length"
    class="flex flex-wrap gap-1"
    data-testid="source-labels"
  >
    <Badge
      v-for="label in labels"
      :key="label"
      variant="secondary"
      :class="label === 'live' ? LIVE_CLASS : undefined"
      :data-label="label"
    >
      {{ $t(SOURCE_LABEL_KEYS[label]) }}
    </Badge>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { SOURCE_LABEL_KEYS, type SourceLabel } from "@/helpers/source_labels";
import { $t } from "@/plugins/i18n";

/**
 * The labels saying what a source offers, as a row of small badges; nothing
 * when it has none.
 */
defineProps<{
  labels: readonly SourceLabel[];
}>();

// a live source stands apart from the sources of music to browse
const LIVE_CLASS = "bg-orange-500/15 text-orange-700 dark:text-orange-300";
</script>
