<script setup lang="ts">
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type { ComboboxInputEmits, ComboboxInputProps } from "reka-ui";
import { ComboboxInput, useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<
  ComboboxInputProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<ComboboxInputEmits>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
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
  />
</template>
