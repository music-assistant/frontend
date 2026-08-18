<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  ConfigValueOption,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { computed, useId } from "vue";

const props = defineProps<{
  label: string;
  options: ConfigValueOption[];
  value?: ConfigValueType;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

const groupId = useId();

// the selection travels as the option's index: option values may be numbers, booleans or
// null, none of which survive as a radio group's (string) model value
const selectedIndex = computed(() => {
  const index = props.options.findIndex(
    (option) => option.value === props.value,
  );
  return index === -1 ? undefined : String(index);
});

const optionTitle = (option: ConfigValueOption) =>
  option.title?.toString() || option.value?.toString() || "";

const optionHint = (option: ConfigValueOption) =>
  option.disabled ? option.disabled_reason : option.description;

const onSelect = (index: unknown) => {
  const option = props.options[Number(index)];
  if (option) emit("update:value", option.value);
};
</script>

<template>
  <div class="flex w-full flex-col gap-2 py-1">
    <span class="text-muted-foreground text-sm">{{ label }}</span>
    <RadioGroup
      :model-value="selectedIndex"
      :disabled="disabled"
      class="gap-2"
      @update:model-value="onSelect"
    >
      <div
        v-for="(option, index) of options"
        :key="index"
        class="flex items-start gap-3 rounded-md border p-3"
        :class="{ 'opacity-60': option.disabled }"
      >
        <RadioGroupItem
          :id="`${groupId}-${index}`"
          :value="String(index)"
          :disabled="option.disabled"
          class="mt-0.5"
        />
        <Label
          :for="`${groupId}-${index}`"
          class="flex flex-1 flex-col items-start gap-1 font-normal"
        >
          <span class="text-sm font-medium">{{ optionTitle(option) }}</span>
          <span
            v-if="optionHint(option)"
            class="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap"
          >
            {{ optionHint(option) }}
          </span>
        </Label>
      </div>
    </RadioGroup>
  </div>
</template>
