<template>
  <LabeledField
    :label="label"
    :input-id="inputId"
    :error="error"
    :error-id="errorId"
  >
    <TagsInput
      :key="renderKey"
      :model-value="items"
      :disabled="disabled"
      :required="required"
      add-on-blur
      add-on-paste
      :delimiter="LINE_BREAK"
      class="bg-transparent dark:bg-input/30 min-h-9 data-[disabled]:opacity-50"
      :aria-invalid="error ? true : undefined"
      @update:model-value="onUpdate"
    >
      <TagsInputItem
        v-for="item of items"
        :key="item"
        :value="item"
        class="bg-muted"
      >
        <TagsInputItemText />
        <TagsInputItemDelete
          v-if="!disabled"
          :aria-label="$t('settings.remove_value', [item])"
        />
      </TagsInputItem>
      <TagsInputInput
        :id="inputId"
        class="min-w-24"
        :aria-describedby="error ? errorId : undefined"
        @blur="emit('blur')"
      />
      <Button
        v-if="showClear"
        type="button"
        variant="ghost"
        size="icon"
        class="text-muted-foreground ml-auto size-6"
        :aria-label="$t('settings.clear_value', [label])"
        @mousedown.prevent
        @click="onClear"
      >
        <X class="size-3.5" />
      </Button>
    </TagsInput>
  </LabeledField>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { X } from "@lucide/vue";
import { computed, ref, useId } from "vue";
import LabeledField from "./LabeledField.vue";

/**
 * A list of free text values: a value is added with Enter or by leaving the field,
 * and pasted lines are added one value each. A comma is part of a value.
 */
const props = defineProps<{
  label: string;
  value?: ConfigValueType;
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

const items = computed(() =>
  Array.isArray(props.value) ? props.value.map(String) : [],
);

const showClear = computed(() => !props.disabled && items.value.length > 0);

// rendering the list anew drops a value still being typed
const renderKey = ref(0);

// pressing the button keeps the focus in the input, so a value being typed is
// not added by leaving it, and clearing drops it as well
const onClear = () => {
  renderKey.value++;
  emit("clear");
};

const LINE_BREAK = /\r?\n/;

const onUpdate = (values: unknown[]) => {
  const cleaned = values
    .map((value) => String(value).trim())
    .filter((value) => value !== "");
  emit("update:value", [...new Set(cleaned)]);
};
</script>
