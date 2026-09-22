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

// Plain rows inside an ItemGroup (role="list") take role="listitem" for valid
// list semantics. An interactive `as` (button/link) or `as-child` keeps its
// native role, and a caller-provided role always wins.
const role = computed(() => {
  if (attrs.role !== undefined || props.asChild || props.as !== "div") {
    return undefined;
  }
  return inItemGroup ? "listitem" : undefined;
});
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
