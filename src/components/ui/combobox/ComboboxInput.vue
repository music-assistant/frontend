<script setup lang="ts">
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type {
  AcceptableValue,
  ComboboxInputEmits,
  ComboboxInputProps,
} from "reka-ui";
import {
  ComboboxInput,
  injectComboboxRootContext,
  useForwardPropsEmits,
} from "reka-ui";
import type { HTMLAttributes } from "vue";
import { ref, watch } from "vue";
import { useComboboxFreeText } from ".";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<
  ComboboxInputProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<ComboboxInputEmits>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const rootContext = injectComboboxRootContext();
const freeText = useComboboxFreeText();
// typed since the last commit or selection
const typed = ref(false);

watch(rootContext.modelValue, () => {
  typed.value = false;
});

function commitTypedText(input: HTMLInputElement) {
  const text = input.value.trim();
  if (!text) return;
  typed.value = false;
  if (!rootContext.multiple.value) {
    rootContext.modelValue.value = text;
    return;
  }
  const current = (rootContext.modelValue.value ?? []) as AcceptableValue[];
  if (!current.includes(text))
    rootContext.modelValue.value = [...current, text];
  input.value = "";
  rootContext.filterSearch.value = "";
  emits("update:modelValue", "");
}

function onKeydownEnter(event: KeyboardEvent) {
  if (!freeText.value || rootContext.highlightedElement.value?.isConnected)
    return;
  commitTypedText(event.target as HTMLInputElement);
  if (!rootContext.multiple.value) rootContext.onOpenChange(false);
}

function onBlur(event: FocusEvent) {
  if (!freeText.value || !typed.value || rootContext.multiple.value) return;
  commitTypedText(event.target as HTMLInputElement);
}
</script>

<template>
  <ComboboxInput
    data-slot="combobox-input"
    v-bind="{ ...forwarded, ...$attrs }"
    :class="
      cn(
        'placeholder:text-muted-foreground h-7 min-w-16 flex-1 bg-transparent text-base outline-hidden disabled:cursor-not-allowed md:text-sm',
        props.class,
      )
    "
    @input="typed = true"
    @keydown.enter="onKeydownEnter"
    @blur="onBlur"
  />
</template>
