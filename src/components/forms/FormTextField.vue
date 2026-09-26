<template>
  <Field :data-invalid="showValidation ? invalid : undefined">
    <FieldLabel :for="field.name">
      {{ label }}
    </FieldLabel>
    <Input
      :id="field.name"
      :name="field.name"
      :type="type"
      :model-value="field.state.value"
      :aria-invalid="showValidation ? invalid : undefined"
      :disabled="disabled"
      :autofocus="autofocus"
      :autocomplete="autocomplete"
      @blur="field.handleBlur"
      @input="onInput"
    />
    <FieldDescription v-if="showDescription">
      {{ description }}
    </FieldDescription>
    <FieldError
      v-if="showValidation && invalid"
      :errors="field.state.meta.errors"
    />
  </Field>
</template>

<script setup lang="ts">
import type { AnyFieldApi } from "@tanstack/form-core";
import { computed } from "vue";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const props = withDefaults(
  defineProps<{
    /** The TanStack field api for the field this input is bound to. */
    field: AnyFieldApi;
    /** Text for the field's label. */
    label: string;
    /** Native input type, e.g. "text" or "password". */
    type?: string;
    /** Native autocomplete hint; omitted when not set. */
    autocomplete?: string;
    disabled?: boolean;
    autofocus?: boolean;
    /** Helper text shown below the input; omitted when not set. */
    description?: string;
    /**
     * "always" keeps the description visible; "hideWhenInvalid" hides it while
     * the field shows a validation error.
     */
    descriptionMode?: "always" | "hideWhenInvalid";
    /** Whether to reflect the field's validation state and render its errors. */
    showValidation?: boolean;
  }>(),
  {
    type: "text",
    autocomplete: undefined,
    disabled: false,
    autofocus: false,
    description: undefined,
    descriptionMode: "always",
    showValidation: true,
  },
);

/** Emitted with the new value on every input, after the field is updated. */
const emit = defineEmits<{ change: [value: string] }>();

const invalid = computed(() => props.field.state.meta.errors.length > 0);

const showDescription = computed(
  () =>
    props.description !== undefined &&
    (props.descriptionMode === "always" || !invalid.value),
);

const onInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  props.field.handleChange(value);
  emit("change", value);
};
</script>
