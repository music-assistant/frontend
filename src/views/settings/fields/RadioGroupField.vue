<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type {
  ConfigValueOption,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { CircleCheck } from "@lucide/vue";
import { useId, useTemplateRef } from "vue";

const props = defineProps<{
  label: string;
  options: ConfigValueOption[];
  // the value the entry holds now; the option carrying it shows as selected
  value?: ConfigValueType;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

const labelId = useId();
const group = useTemplateRef<HTMLElement>("group");

const optionTitle = (option: ConfigValueOption) =>
  option.title?.toString() || option.value?.toString() || "";

const optionHint = (option: ConfigValueOption) =>
  option.disabled ? option.disabled_reason : option.description;

const isSelected = (option: ConfigValueOption) =>
  props.value !== null &&
  props.value !== undefined &&
  option.value === props.value;

const onPick = (option: ConfigValueOption) => {
  emit("update:value", option.value);
};

// arrow keys move the focus between the options, as a radio group is expected to;
// only a click, Enter or Space picks one, so moving never submits a step that
// submits on pick
const moveFocus = (event: KeyboardEvent, step: number) => {
  const buttons = Array.from(
    group.value?.querySelectorAll<HTMLButtonElement>(
      "button[role='radio']:not(:disabled)",
    ) ?? [],
  );
  if (buttons.length === 0) return;
  event.preventDefault();
  const current = buttons.indexOf(event.target as HTMLButtonElement);
  buttons[(current + step + buttons.length) % buttons.length].focus();
};
</script>

<template>
  <div class="flex w-full flex-col gap-2 py-1">
    <span v-if="label" :id="labelId" class="text-muted-foreground text-sm">{{
      label
    }}</span>
    <div
      ref="group"
      role="radiogroup"
      :aria-labelledby="label ? labelId : undefined"
      class="flex flex-col gap-2"
      @keydown.down="moveFocus($event, 1)"
      @keydown.right="moveFocus($event, 1)"
      @keydown.up="moveFocus($event, -1)"
      @keydown.left="moveFocus($event, -1)"
    >
      <Button
        v-for="(option, index) of options"
        :key="index"
        type="button"
        role="radio"
        :aria-checked="isSelected(option)"
        variant="outline"
        :disabled="disabled || option.disabled"
        data-testid="option-button"
        :data-selected="isSelected(option) || undefined"
        class="h-auto items-start gap-2 p-3 text-left whitespace-normal"
        :class="{
          'border-primary bg-primary/10 dark:border-primary dark:bg-primary/15':
            isSelected(option),
        }"
        @click="onPick(option)"
      >
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm font-medium">{{ optionTitle(option) }}</span>
          <span
            v-if="optionHint(option)"
            class="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap"
          >
            {{ optionHint(option) }}
          </span>
        </span>
        <!-- the mark tells the selected option apart without relying on colour -->
        <CircleCheck
          v-if="isSelected(option)"
          class="text-primary size-4 shrink-0"
          aria-hidden="true"
        />
      </Button>
    </div>
  </div>
</template>
