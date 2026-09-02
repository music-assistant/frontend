<script setup lang="ts">
import { cn } from "@/lib/utils";
import { ChevronRight } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import type { DropdownMenuSubTriggerProps } from "reka-ui";
import { DropdownMenuSubTrigger, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  DropdownMenuSubTriggerProps & {
    class?: HTMLAttributes["class"];
    inset?: boolean;
  }
>();

const delegatedProps = reactiveOmit(props, "class", "inset");
const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <DropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    v-bind="forwardedProps"
    :class="
      cn(
        'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex h-10 cursor-default items-center gap-4 rounded-md px-2 text-sm outline-hidden select-none data-[inset]:pl-8 [&>svg]:size-[18px]',
        props.class,
      )
    "
  >
    <slot></slot>
    <ChevronRight class="ml-auto size-[18px]" />
  </DropdownMenuSubTrigger>
</template>
