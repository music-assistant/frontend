<template>
  <!-- on a phone the pills scroll sideways; wider, they wrap when they do not fit -->
  <div
    role="group"
    :aria-label="$t('settings.provider_labels.filter')"
    class="max-w-full max-md:overflow-x-auto max-md:[scrollbar-width:none]"
    data-testid="provider-label-filter"
  >
    <div
      class="inline-flex gap-0.5 rounded-(--radius-lg) bg-muted p-[3px] md:flex-wrap"
    >
      <Button
        v-for="option in options"
        :key="option.value ?? 'all'"
        type="button"
        variant="ghost"
        size="sm"
        :class="
          cn(
            'h-[30px] rounded-[7px] px-3.5 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent',
            model === option.value &&
              'bg-background text-foreground shadow-sm hover:bg-background dark:bg-input/30 dark:hover:bg-input/30',
          )
        "
        :aria-pressed="model === option.value"
        :data-label="option.value ?? 'all'"
        @click="model = option.value"
      >
        {{ option.label }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  PROVIDER_LABEL_KEYS,
  type ProviderLabel,
} from "@/helpers/provider_labels";
import { cn } from "@/lib/utils";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * The pills filtering a list of providers on what they offer: All, then one
 * per label given. One is picked at a time.
 */
const props = defineProps<{
  labels: readonly ProviderLabel[];
}>();

// the label picked; null for All
const model = defineModel<ProviderLabel | null>({ required: true });

const options = computed(() => [
  { value: null, label: $t("settings.provider_labels.all") },
  ...props.labels.map((label) => ({
    value: label,
    label: $t(PROVIDER_LABEL_KEYS[label]),
  })),
]);
</script>
