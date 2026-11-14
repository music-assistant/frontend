<script setup lang="ts">
import { cn } from "@/lib/utils";
import { Check } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import type { ComboboxItemIndicatorProps } from "reka-ui";
import { ComboboxItemIndicator, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  ComboboxItemIndicatorProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <ComboboxItemIndicator
    data-slot="combobox-item-indicator"
    v-bind="forwarded"
    :class="
      cn(
        'absolute right-2 flex size-3.5 items-center justify-center',
        props.class,
      )
    "
  >
    <slot>
      <Check class="size-4" />
    </slot>
  </ComboboxItemIndicator>
</template>
