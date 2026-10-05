<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type {
  ConfigValueOption,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { CircleCheck } from "@lucide/vue";
import { computed, useId } from "vue";

const props = defineProps<{
  label: string;
  options: ConfigValueOption[];
  // the value the entry holds now; the option carrying it shows as selected
  value?: ConfigValueType;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

const labelId = useId();

const optionTitle = (option: ConfigValueOption) =>
  option.title?.toString() || option.value?.toString() || "";

const optionHint = (option: ConfigValueOption) =>
  option.disabled ? option.disabled_reason : option.description;

// options with nothing to explain are short, so they sit side by side
const compact = computed(() =>
  props.options.every((option) => !optionHint(option)),
);

const isSelected = (option: ConfigValueOption) =>
  props.value !== null &&
  props.value !== undefined &&
  option.value === props.value;

const onPick = (option: ConfigValueOption) => {
  emit("update:value", option.value);
};
</script>

<template>
  <div class="@container flex w-full flex-col gap-2 py-1">
    <span v-if="label" :id="labelId" class="text-muted-foreground text-sm">{{
      label
    }}</span>
    <!-- toggle buttons, not radios: a radio is picked by moving onto it with an arrow
         key, and a step that submits on pick must only go on when an option is pressed -->
    <div
      role="group"
      :aria-labelledby="label ? labelId : undefined"
      :class="
        compact
          ? 'grid grid-cols-2 gap-2 @md:grid-cols-4'
          : 'flex flex-col gap-2'
      "
      :data-layout="compact ? 'compact' : 'stacked'"
    >
      <Button
        v-for="(option, index) of options"
        :key="index"
        type="button"
        :aria-pressed="isSelected(option)"
        variant="outline"
        :disabled="disabled || option.disabled"
        data-testid="option-button"
        :data-selected="isSelected(option) || undefined"
        class="h-auto whitespace-normal"
        :class="[
          compact
            ? 'relative min-h-9 justify-center px-3 py-2 text-center'
            : 'items-start gap-2 p-3 text-left',
          {
            'border-primary bg-primary/10 dark:border-primary dark:bg-primary/15':
              isSelected(option),
          },
        ]"
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
        <!-- the mark tells the selected option apart without relying on colour; a
             compact button carries it on its corner, so the label keeps its width -->
        <CircleCheck
          v-if="isSelected(option)"
          class="text-primary size-4 shrink-0"
          :class="{
            'bg-background absolute -top-1.5 -right-1.5 rounded-full': compact,
          }"
          aria-hidden="true"
        />
      </Button>
    </div>
  </div>
</template>
