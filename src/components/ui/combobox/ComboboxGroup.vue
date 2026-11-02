<script setup lang="ts">
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type { ComboboxGroupProps } from "reka-ui";
import { ComboboxGroup, ComboboxLabel } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  ComboboxGroupProps & {
    class?: HTMLAttributes["class"];
    heading?: string;
  }
>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <ComboboxGroup
    data-slot="combobox-group"
    v-bind="delegatedProps"
    :class="cn('text-foreground overflow-hidden', props.class)"
  >
    <ComboboxLabel
      v-if="heading"
      data-slot="combobox-group-heading"
      class="text-muted-foreground px-2 py-1.5 text-xs font-medium"
    >
      {{ heading }}
    </ComboboxLabel>
    <slot></slot>
  </ComboboxGroup>
</template>
