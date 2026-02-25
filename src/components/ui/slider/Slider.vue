<script setup lang="ts">
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type { SliderRootEmits, SliderRootProps } from "reka-ui";
import {
  SliderRange,
  SliderRoot,
  SliderThumb,
  SliderTrack,
  useForwardPropsEmits,
} from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

const props = defineProps<
  SliderRootProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<SliderRootEmits>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardPropsEmits(delegatedProps, emits);

const forwarded = computed(() => ({
  ...forwardedProps.value,
  thumbAlignment: props.thumbAlignment ?? "overflow",
}));
</script>

<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    :class="
      cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        props.class,
      )
    "
    v-bind="forwarded"
  >
    <SliderTrack
      data-slot="slider-track"
      class="bg-transparent relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-[6px] data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 before:absolute before:left-0 before:top-1/2 before:h-[4px] before:w-full before:-translate-y-1/2 before:rounded-full before:bg-[_rgba(var(--v-theme-on-surface),0.24))] before:content-['']"
    >
      <SliderRange
        data-slot="slider-range"
        class="bg-[_rgb(var(--v-theme-surface-variant)))] absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
      />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      data-slot="slider-thumb"
      class="grid place-items-center bg-transparent size-[32px] shrink-0 rounded-full transition-[color,box-shadow] focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 before:block before:size-[10px] before:rounded-full before:bg-[_rgb(var(--v-theme-surface-variant))] before:shadow-[0_1px_3px_rgba(0,0,0,0.35)] hover:before:shadow-[0_0_0_5px_rgba(var(--v-theme-surface-variant),0.05)]"
    />
  </SliderRoot>
</template>
