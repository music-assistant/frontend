<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import type { ItemVariants } from ".";
import { Primitive } from "reka-ui";
import { computed, inject, useAttrs } from "vue";
import { cn } from "@/lib/utils";
import { itemGroupInjectionKey, itemVariants } from ".";

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      class?: HTMLAttributes["class"];
      variant?: ItemVariants["variant"];
      size?: ItemVariants["size"];
    }
  >(),
  {
    as: "div",
    class: undefined,
    variant: "default",
    size: "default",
  },
);

const attrs = useAttrs();
const inItemGroup = inject(itemGroupInjectionKey, false);

// Rows inside an ItemGroup (role="list") need role="listitem" for valid list
// semantics; a caller-provided role always wins and standalone Items stay bare.
const role = computed(() =>
  attrs.role === undefined && inItemGroup ? "listitem" : undefined,
);
</script>

<template>
  <Primitive
    data-slot="item"
    :as="as"
    :as-child="asChild"
    :role="role"
    :class="cn(itemVariants({ variant, size }), props.class)"
  >
    <slot></slot>
  </Primitive>
</template>
