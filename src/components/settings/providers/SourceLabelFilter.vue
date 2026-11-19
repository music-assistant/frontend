<template>
  <div
    role="group"
    :aria-label="$t('settings.source_labels.filter')"
    class="flex flex-wrap gap-1.5"
    data-testid="source-label-filter"
  >
    <Button
      v-for="option in options"
      :key="option.value ?? 'all'"
      type="button"
      size="xs"
      class="rounded-full"
      :variant="model === option.value ? 'default' : 'outline'"
      :aria-pressed="model === option.value"
      :data-label="option.value ?? 'all'"
      @click="model = option.value"
    >
      {{ option.label }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { SOURCE_LABEL_KEYS, type SourceLabel } from "@/helpers/source_labels";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * The chips filtering a list of sources on what they offer: All, then one per
 * label given. One is picked at a time.
 */
const props = defineProps<{
  labels: readonly SourceLabel[];
}>();

// the label picked; null for All
const model = defineModel<SourceLabel | null>({ required: true });

const options = computed(() => [
  { value: null, label: $t("settings.source_labels.all") },
  ...props.labels.map((label) => ({
    value: label,
    label: $t(SOURCE_LABEL_KEYS[label]),
  })),
]);
</script>
