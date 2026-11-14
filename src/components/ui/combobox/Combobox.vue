<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { ComboboxRootEmits, ComboboxRootProps } from "reka-ui";
import { ComboboxRoot, useForwardPropsEmits } from "reka-ui";
import { toRef } from "vue";
import { provideComboboxFreeText } from ".";

const props = defineProps<
  ComboboxRootProps & {
    // commit typed text that matches no item, on Enter or when leaving the field
    freeText?: boolean;
  }
>();
const emits = defineEmits<ComboboxRootEmits>();

const delegatedProps = reactiveOmit(props, "freeText");

const forwarded = useForwardPropsEmits(delegatedProps, emits);

provideComboboxFreeText(toRef(props, "freeText"));
</script>

<template>
  <ComboboxRoot v-slot="slotProps" data-slot="combobox" v-bind="forwarded">
    <slot v-bind="slotProps"></slot>
  </ComboboxRoot>
</template>
