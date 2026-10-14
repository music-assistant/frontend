<template>
  <div
    class="flex h-80 flex-col rounded-2xl bg-[rgb(var(--v-theme-surface))] p-6 shadow-sm transition-shadow duration-200 hover:shadow-lg"
  >
    <div class="mb-4">
      <h3 class="m-0 text-base font-bold text-[rgb(var(--v-theme-on-surface))]">
        {{ title }}
      </h3>
    </div>
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <Spinner class="size-8" />
    </div>
    <div
      v-else-if="isEmpty"
      class="flex flex-1 items-center justify-center text-[rgb(var(--v-theme-on-surface))] opacity-50"
    >
      {{ emptyMessage || $t("no_data") }}
    </div>
    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center"
      :class="clickable && '[&_canvas]:cursor-pointer'"
      :role="accessibleSummary ? 'group' : undefined"
      :aria-label="accessibleSummary || undefined"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import Spinner from "@/components/ui/spinner/Spinner.vue";

interface Props {
  title: string;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  clickable?: boolean;
  accessibleSummary?: string;
}

withDefaults(defineProps<Props>(), {
  loading: false,
  isEmpty: false,
  emptyMessage: "",
  clickable: false,
  accessibleSummary: "",
});
</script>
