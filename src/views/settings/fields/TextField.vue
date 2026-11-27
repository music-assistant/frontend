<template>
  <LabeledField
    :label="label"
    :input-id="inputId"
    :error="error"
    :error-id="errorId"
  >
    <InputGroup :data-disabled="disabled || undefined">
      <InputGroupInput
        :id="inputId"
        :key="renderKey"
        :model-value="inputValue"
        :type="inputType"
        :placeholder="placeholder"
        :step="step"
        :readonly="readonly"
        :disabled="disabled"
        :required="required"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? errorId : undefined"
        @update:model-value="onInput"
        @blur="onBlur"
      />
      <InputGroupAddon v-if="showClear || passwordToggle" align="inline-end">
        <InputGroupButton
          v-if="showClear"
          type="button"
          size="icon-xs"
          :aria-label="$t('settings.clear_value', [label])"
          @click="emit('clear')"
        >
          <X />
        </InputGroupButton>
        <InputGroupButton
          v-if="passwordToggle"
          type="button"
          size="icon-xs"
          :disabled="disabled"
          :aria-label="
            passwordVisible
              ? $t('settings.hide_password')
              : $t('settings.show_password')
          "
          @click="emit('togglePassword')"
        >
          <Eye v-if="passwordVisible" />
          <EyeOff v-else />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </LabeledField>
</template>

<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Eye, EyeOff, X } from "@lucide/vue";
import { computed, ref, useId } from "vue";
import LabeledField from "./LabeledField.vue";

const props = defineProps<{
  label: string;
  value?: ConfigValueType;
  type: "text" | "number" | "password";
  placeholder?: string;
  // the step of a number field; "any" lets it hold fractions
  step?: number | "any";
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  error?: string;
  // a password field shows its value in plain text
  passwordVisible?: boolean;
  // a password field offers to show its value
  passwordToggle?: boolean;
}>();

const emit = defineEmits<{
  "update:value": [value: ConfigValueType];
  clear: [];
  blur: [];
  togglePassword: [];
}>();

const inputId = useId();
const errorId = useId();

const inputType = computed(() =>
  props.type === "password" && props.passwordVisible ? "text" : props.type,
);

// a number stays a number: the input then keeps a value being typed, such as
// "1." on the way to "1.5", that reads as the same number
const inputValue = computed(() => {
  if (props.value === null || props.value === undefined) return "";
  if (props.type === "number" && typeof props.value === "number") {
    return props.value;
  }
  return String(props.value);
});

// a read-only value filled in by an action can still be cleared, to run the action again
const showClear = computed(
  () => props.clearable && !props.disabled && inputValue.value !== "",
);

// an edit the form turns back into the value it already held, such as an emptied
// required field going back to its default, leaves the input showing the edit:
// rendering the input anew shows the value again
const renderKey = ref(0);

const onBlur = (event: FocusEvent) => {
  const input = event.target as HTMLInputElement;
  if (input.value !== String(inputValue.value)) renderKey.value++;
  emit("blur");
};

const onInput = (value: string | number) => {
  // a number input reads "" while it holds no valid number
  if (props.type === "number" && value !== "") {
    emit("update:value", Number(value));
  } else {
    emit("update:value", String(value));
  }
};
</script>
