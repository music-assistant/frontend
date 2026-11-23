<template>
  <!-- the cards answer one question, and the step's own description is what
       asks it: a screen reader reads that before it reads the options -->
  <div role="group" :aria-labelledby="labelledBy" class="grid gap-3">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="focus-visible:ring-ring bg-card flex items-start gap-3 rounded-xl border p-4 text-left transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      :class="
        selected === option.value
          ? 'ring-primary ring-1'
          : 'hover:ring-primary/30 hover:ring-1'
      "
      :aria-pressed="selected === option.value"
      :aria-busy="isSaving(option.value) || undefined"
      :disabled="busy"
      :data-testid="`${testIdPrefix}-${option.value}`"
      @click="emit('select', option.value)"
    >
      <span
        class="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-md"
      >
        <component :is="option.icon" class="size-6" aria-hidden="true" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="font-semibold">{{ $t(option.labelKey) }}</span>
          <Badge v-if="option.recommended" as="span" variant="secondary">
            {{ $t("recommended") }}
          </Badge>
        </span>
        <span class="text-muted-foreground text-sm">
          {{ $t(option.descriptionKey) }}
        </span>
      </span>
      <Spinner
        v-if="isSaving(option.value)"
        class="text-muted-foreground self-center"
      />
      <ChevronRight
        v-else
        class="text-muted-foreground size-4 shrink-0 self-center"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ChevronRight } from "@lucide/vue";
import type { Component } from "vue";

/** One card: the answer it stands for, and how it is put to the user. */
export interface ChoiceCardOption<T extends string> {
  value: T;
  icon: Component;
  labelKey: string;
  descriptionKey: string;
  // shown with a "Recommended" badge
  recommended?: boolean;
}

const props = defineProps<{
  options: ChoiceCardOption<T>[];
  // the answer the cards show as chosen: the one on its way to the server, or
  // the one already on the account, so coming back to the step shows it
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

const isSaving = (value: T) => props.busy && props.selected === value;
</script>
