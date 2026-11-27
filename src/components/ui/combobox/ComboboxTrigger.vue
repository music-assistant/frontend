<script setup lang="ts">
import { cn } from "@/lib/utils";
import { ChevronDown } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import type { ComboboxTriggerProps } from "reka-ui";
import { ComboboxTrigger, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  ComboboxTriggerProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <ComboboxTrigger
    data-slot="combobox-trigger"
    v-bind="forwarded"
    :class="
      cn(
        'text-muted-foreground flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4',
        props.class,
      )
    "
  >
    <slot>
      <ChevronDown class="opacity-50" />
    </slot>
  </ComboboxTrigger>
</template>
