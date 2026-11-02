<script setup lang="ts">
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type { ComboboxContentEmits, ComboboxContentProps } from "reka-ui";
import {
  ComboboxContent,
  ComboboxPortal,
  ComboboxViewport,
  useForwardPropsEmits,
} from "reka-ui";
import type { HTMLAttributes } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<ComboboxContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    position: "popper",
    align: "start",
    sideOffset: 4,
    class: undefined,
  },
);
const emits = defineEmits<ComboboxContentEmits>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ComboboxPortal>
    <ComboboxContent
      data-slot="combobox-list"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-[10000] max-h-(--reka-combobox-content-available-height) min-w-[8rem] origin-(--reka-combobox-content-transform-origin) overflow-hidden rounded-md border shadow-md',
          position === 'popper' && 'w-(--reka-combobox-trigger-width)',
          props.class,
        )
      "
    >
      <ComboboxViewport
        data-slot="combobox-viewport"
        class="max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto p-1"
      >
        <slot></slot>
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxPortal>
</template>
