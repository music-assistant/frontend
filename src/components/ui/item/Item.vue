<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import type { ItemVariants } from ".";
import { Primitive } from "reka-ui";
import { computed, inject } from "vue";
import { cn } from "@/lib/utils";
import { itemGroupInjectionKey, itemVariants } from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      class?: HTMLAttributes["class"];
      variant?: ItemVariants["variant"];
      size?: ItemVariants["size"];
      role?: string | null;
    }
  >(),
  {
    as: "div",
    class: undefined,
    variant: "default",
    size: "default",
    role: undefined,
  },
);

const inItemGroup = inject(itemGroupInjectionKey, false);

// A caller-provided role owns the element's semantics; null means absent.
const role = computed(() => props.role ?? undefined);

// Inside an ItemGroup (role="list") each row is wrapped in a listitem element,
// so the list has valid item children while the row element keeps its own role:
// a native interactive one, a caller role, or none. The row fills the wrapper
// (it is always display:flex), so the wrapper stays layout-neutral.
</script>

<template>
  <div v-if="inItemGroup" role="listitem">
    <Primitive
      data-slot="item"
      :as="as"
      :as-child="asChild"
      :role="role"
      :class="cn(itemVariants({ variant, size }), props.class)"
      v-bind="$attrs"
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
    v-bind="$attrs"
  >
    <slot></slot>
  </Primitive>
</template>
