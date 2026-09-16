<template>
  <!-- the cards answer one question, and the step's own description is what
       asks it: a screen reader reads that before it reads the options -->
  <div
    role="group"
    :aria-labelledby="labelledBy"
    class="grid auto-rows-fr gap-3 sm:grid-cols-2"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="hover:border-primary focus-visible:ring-ring bg-card flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      :class="{ 'border-primary': active === option.value }"
      :aria-pressed="active === option.value"
      :disabled="busy"
      :data-testid="`${testIdPrefix}-${option.value}`"
      @click="emit('select', option.value)"
    >
      <span
        class="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-md"
      >
        <component :is="option.icon" class="size-6" aria-hidden="true" />
      </span>
      <span class="flex min-w-0 flex-col gap-1">
        <span class="flex items-center gap-2">
          <span class="font-semibold">{{ $t(option.labelKey) }}</span>
          <Badge v-if="option.recommended" variant="secondary">
            {{ $t("recommended") }}
          </Badge>
        </span>
        <span class="text-muted-foreground text-sm">
          {{ $t(option.descriptionKey) }}
        </span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { Badge } from "@/components/ui/badge";
import { computed, type Component } from "vue";

/** One card: the answer it stands for, and how it is put to the user. */
export interface ChoiceCardOption<T extends string> {
  value: T;
  icon: Component;
  labelKey: string;
  descriptionKey: string;
  // shown with a "Recommended" badge, and preselected until the user picks
  recommended?: boolean;
}

const props = defineProps<{
  options: ChoiceCardOption<T>[];
  // the answer already on the account, so coming back to the step shows it
  selected?: T;
  // the step is persisting an answer: the cards stay inert until it lands
  busy?: boolean;
  // the element that asks what these cards answer
  labelledBy: string;
  testIdPrefix: string;
}>();

const emit = defineEmits<{
  (e: "select", value: T): void;
}>();

// which card reads as chosen: the saved answer, or the recommended option
// until one is saved, so the option the step defaults to shows preselected
const active = computed(
  () =>
    props.selected ?? props.options.find((option) => option.recommended)?.value,
);
</script>
