<script lang="ts" setup>
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type { CalendarHeadCellProps } from "reka-ui";
import { CalendarHeadCell, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  CalendarHeadCellProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CalendarHeadCell
    data-slot="calendar-head-cell"
    :class="
      cn(
        'text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem]',
        props.class,
      )
    "
    v-bind="forwardedProps"
  >
    <slot></slot>
  </CalendarHeadCell>
</template>
