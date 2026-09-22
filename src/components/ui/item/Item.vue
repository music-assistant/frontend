<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import type { ItemVariants } from ".";
import { Primitive } from "reka-ui";
import { computed, inject, useAttrs } from "vue";
import { cn } from "@/lib/utils";
import { itemGroupInjectionKey, itemVariants } from ".";

defineOptions({ inheritAttrs: false });

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

// A caller-provided role owns the row's semantics; otherwise rows inside an
// ItemGroup (role="list") need role="listitem" for valid list semantics.
const listRow = computed(() => inItemGroup && attrs.role === undefined);

// A plain row carries the role directly. An interactive row (button/link, via
// `as` or `as-child`) instead gets a display:contents listitem wrapper so it
// keeps its native role while still counting as an item in the list.
const isInteractive = computed(() => props.asChild || props.as !== "div");
const role = computed(() =>
  listRow.value && !isInteractive.value ? "listitem" : undefined,
);
const wrap = computed(() => listRow.value && isInteractive.value);
</script>

<template>
  <div v-if="wrap" role="listitem" class="contents">
    <Primitive
      data-slot="item"
      :as="as"
      :as-child="asChild"
      :class="cn(itemVariants({ variant, size }), props.class)"
      v-bind="attrs"
    >
      <slot></slot>
    </Primitive>
  </div>
  <Primitive
    v-else
    data-slot="item"
    :as="as"
    :as-child="asChild"
    :role="role"
    :class="cn(itemVariants({ variant, size }), props.class)"
    v-bind="attrs"
  >
    <slot></slot>
  </Primitive>
</template>
