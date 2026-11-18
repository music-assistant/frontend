<template>
  <Select
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', String($event))"
  >
    <SelectTrigger
      size="sm"
      :aria-label="accessibleName"
      :aria-invalid="error ? 'true' : undefined"
      :title="error"
      :class="cn(CHIP_CLASS, 'gap-1', error && CHIP_INVALID_CLASS)"
    >
      <span>{{ selectedLabel }}</span>
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>

<script setup lang="ts">
import {
  CHIP_CLASS,
  CHIP_INVALID_CLASS,
} from "@/components/rotation/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  modelValue: string;
  options: { value: string; label: string }[];
  // what the chip chooses; the chosen value is added to the name
  label: string;
  // why the chosen value does not work here; marks the chip invalid
  error?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const selectedLabel = computed(
  () =>
    props.options.find((o) => o.value === props.modelValue)?.label ??
    props.modelValue,
);

const accessibleName = computed(() =>
  $t("rotation.step.chip.accessible_name", {
    label: props.label,
    value: selectedLabel.value,
  }),
);
</script>
