<template>
  <!-- the pills scroll sideways rather than wrapping when they do not fit -->
  <div
    role="group"
    :aria-label="$t('settings.provider_labels.filter')"
    class="max-w-full overflow-x-auto [scrollbar-width:none]"
    data-testid="provider-label-filter"
  >
    <div class="inline-flex gap-0.5 rounded-(--radius-lg) bg-muted p-[3px]">
      <button
        v-for="option in options"
        :key="option.value ?? 'all'"
        type="button"
        :class="
          cn(
            'h-[30px] shrink-0 cursor-pointer rounded-[7px] px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,box-shadow] outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
            model === option.value &&
              'bg-background text-foreground shadow-sm dark:bg-input/30',
          )
        "
        :aria-pressed="model === option.value"
        :data-label="option.value ?? 'all'"
        @click="model = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
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
