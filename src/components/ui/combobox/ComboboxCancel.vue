<script setup lang="ts">
import { cn } from "@/lib/utils";
import { X } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import type { ComboboxCancelProps } from "reka-ui";
import { ComboboxCancel, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  ComboboxCancelProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <ComboboxCancel
    data-slot="combobox-cancel"
    v-bind="forwarded"
    :class="
      cn(
        'text-muted-foreground hover:text-foreground flex shrink-0 items-center justify-center rounded-sm [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4',
        props.class,
      )
    "
  >
    <slot>
      <X />
    </slot>
  </ComboboxCancel>
</template>
