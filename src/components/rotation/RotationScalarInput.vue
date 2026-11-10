<template>
  <NumberField
    v-if="type === 'number'"
    class="w-24"
    :model-value="numberValue"
    :aria-label="label"
    @update:model-value="onNumber"
  >
    <NumberFieldContent>
      <NumberFieldInput class="h-8" />
    </NumberFieldContent>
  </NumberField>

  <Popover v-else-if="type === 'date'">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm" class="h-8 font-normal">
        <CalendarIcon class="h-3.5 w-3.5" />
        {{ textValue || $t("rotation.value.pick_date") }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar :model-value="dateValue" @update:model-value="onDate" />
    </PopoverContent>
  </Popover>

  <Input
    v-else
    class="h-8 w-48 text-sm"
    :model-value="textValue"
    :aria-label="label"
    :placeholder="label"
    @update:model-value="emit('update:modelValue', String($event))"
  />
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { $t } from "@/plugins/i18n";
import { parseDate, type DateValue } from "@internationalized/date";
import { Calendar as CalendarIcon } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  type: string;
  modelValue?: unknown;
  label: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

const numberValue = computed(() =>
  typeof props.modelValue === "number" ? props.modelValue : 0,
);
const textValue = computed(() =>
  typeof props.modelValue === "string" ? props.modelValue : "",
);
const dateValue = computed(() => {
  try {
    return textValue.value ? parseDate(textValue.value) : undefined;
  } catch {
    return undefined;
  }
});

function onNumber(value: number | undefined) {
  emit(
    "update:modelValue",
    value === undefined || Number.isNaN(value) ? 0 : value,
  );
}

function onDate(value: DateValue | undefined) {
  if (value) emit("update:modelValue", value.toString());
}
</script>
