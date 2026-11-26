<template>
  <LabeledField
    :label="label"
    :input-id="inputId"
    :error="error"
    :error-id="errorId"
  >
    <div class="relative">
      <Select
        :model-value="model"
        :multiple="multiple"
        :disabled="disabled"
        :required="required"
        @update:model-value="onPick"
        @update:open="onOpenChange"
      >
        <SelectTrigger
          :id="inputId"
          class="min-h-9 w-full py-1.5 whitespace-normal data-[size=default]:h-auto"
          :aria-invalid="error ? true : undefined"
          :aria-describedby="error ? errorId : undefined"
          @blur="onTriggerBlur"
          @keydown="onTriggerKeydown"
        >
          <!-- room on the right for the clear button, which sits over the trigger -->
          <SelectValue
            class="min-w-0 flex-1 overflow-hidden text-left"
            :class="{ 'pr-7': showClear }"
          >
            <span
              v-if="multiple && selectedTitles.length > 0"
              class="flex min-w-0 flex-wrap gap-1 py-0.5"
            >
              <Badge
                v-for="(title, index) of selectedTitles"
                :key="index"
                variant="outline"
                class="bg-muted max-w-full min-w-0 font-normal"
              >
                <span class="truncate">{{ title }}</span>
              </Badge>
            </span>
            <span v-else class="min-w-0 truncate">{{ selectedTitles[0] }}</span>
          </SelectValue>
        </SelectTrigger>
        <!-- the field width plus the 1px border, around an inner list as wide as the field -->
        <SelectContent
          class="max-w-[calc(var(--reka-select-trigger-width)+2px)]"
        >
          <SelectItem
            v-for="(option, index) of options"
            :key="index"
            :value="String(index)"
            :disabled="option.disabled"
          >
            <span class="flex flex-col gap-0.5">
              <span>{{ option.title }}</span>
              <span
                v-if="optionHint(option)"
                class="text-muted-foreground max-w-prose text-xs"
              >
                {{ optionHint(option) }}
              </span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        v-if="showClear"
        type="button"
        variant="ghost"
        size="icon"
        class="text-muted-foreground absolute top-1/2 right-8 size-6 -translate-y-1/2"
        :aria-label="$t('settings.clear_value', [label])"
        @click="emit('clear')"
      >
        <X class="size-3.5" />
      </Button>
    </div>
  </LabeledField>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ConfigValueOption,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { X } from "@lucide/vue";
import { computed, useId } from "vue";
import { findOptionByPrefix } from "@/helpers/config_field";
import LabeledField from "./LabeledField.vue";

const props = defineProps<{
  label: string;
  options: ConfigValueOption[];
  value?: ConfigValueType;
  multiple?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  "update:value": [value: ConfigValueType];
  clear: [];
  blur: [];
}>();

const inputId = useId();
const errorId = useId();

// the select tracks options by their position: an option value can be an empty
// string or a boolean, which the select can not hold
const keyOf = (value: ConfigValueType) => {
  const index = props.options.findIndex((option) => option.value === value);
  return index === -1 ? undefined : String(index);
};

const selectedValues = computed<ConfigValueType[]>(() => {
  if (props.value === null || props.value === undefined) return [];
  return Array.isArray(props.value) ? props.value : [props.value];
});

const model = computed(() => {
  const keys = selectedValues.value
    .map(keyOf)
    .filter((key) => key !== undefined);
  return props.multiple ? keys : keys[0];
});

const selectedTitles = computed(() =>
  selectedValues.value.map(
    (value) =>
      props.options.find((option) => option.value === value)?.title ?? "",
  ),
);

const showClear = computed(
  () => props.clearable && !props.disabled && selectedValues.value.length > 0,
);

const optionHint = (option: ConfigValueOption) =>
  option.disabled ? option.disabled_reason : option.description;

const onPick = (keys: unknown) => {
  const valueAt = (key: unknown) => props.options[Number(key)]?.value ?? null;
  if (Array.isArray(keys)) {
    emit("update:value", keys.map(valueAt) as ConfigValueType);
  } else {
    emit("update:value", valueAt(keys));
  }
};

let open = false;

const onOpenChange = (isOpen: boolean) => {
  open = isOpen;
  if (!isOpen) emit("blur");
};

// focus moves into the list while it is open, which is not leaving the field
const onTriggerBlur = () => {
  if (!open) emit("blur");
};

// typed letters pick the first option starting with them while the list is
// closed; a pause starts a new search
const TYPEAHEAD_RESET_MS = 1000;
let typeahead = "";
let typedAt = 0;

const onTriggerKeydown = (event: KeyboardEvent) => {
  if (open || props.multiple || props.disabled) return;
  if (event.key === "Backspace" || event.key === "Delete") {
    if (showClear.value) emit("clear");
    return;
  }
  const printable =
    event.key.length === 1 &&
    event.key !== " " &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey;
  if (!printable) return;
  if (event.timeStamp - typedAt > TYPEAHEAD_RESET_MS) typeahead = "";
  typeahead += event.key;
  typedAt = event.timeStamp;
  const match = findOptionByPrefix(props.options, typeahead);
  if (match && match.value !== props.value) emit("update:value", match.value);
};
</script>
