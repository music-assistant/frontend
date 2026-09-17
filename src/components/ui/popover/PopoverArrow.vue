<script setup lang="ts">
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type { PopoverArrowProps } from "reka-ui";
import { PopoverArrow } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  PopoverArrowProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <!-- a rotated square, as the tooltip's arrow is drawn: the two edges that
       stick out of the content carry its border -->
  <PopoverArrow
    data-slot="popover-arrow"
    v-bind="delegatedProps"
    :class="
      cn(
        'bg-popover fill-popover border-border z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] border-r border-b',
        props.class,
      )
    "
  />
</template>
