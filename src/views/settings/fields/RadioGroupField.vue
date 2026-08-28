<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type {
  ConfigValueOption,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { useId } from "vue";

defineProps<{
  label: string;
  options: ConfigValueOption[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

const labelId = useId();

const optionTitle = (option: ConfigValueOption) =>
  option.title?.toString() || option.value?.toString() || "";

const optionHint = (option: ConfigValueOption) =>
  option.disabled ? option.disabled_reason : option.description;

const onPick = (option: ConfigValueOption) => {
  emit("update:value", option.value);
};
</script>

<template>
  <div class="flex w-full flex-col gap-2 py-1">
    <span v-if="label" :id="labelId" class="text-muted-foreground text-sm">{{
      label
    }}</span>
    <div
      role="group"
      :aria-labelledby="label ? labelId : undefined"
      class="flex flex-col gap-2"
    >
      <Button
        v-for="(option, index) of options"
        :key="index"
        type="button"
        variant="outline"
        :disabled="disabled || option.disabled"
        data-testid="option-button"
        class="h-auto flex-col items-start gap-1 p-3 text-left whitespace-normal"
        @click="onPick(option)"
      >
        <span class="text-sm font-medium">{{ optionTitle(option) }}</span>
        <span
          v-if="optionHint(option)"
          class="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap"
        >
          {{ optionHint(option) }}
        </span>
      </Button>
    </div>
  </div>
</template>
