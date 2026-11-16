<script setup lang="ts">
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { PrimitiveProps } from "reka-ui";
import { Primitive } from "reka-ui";
import type { HTMLAttributes } from "vue";
import type { ButtonVariants } from ".";
import { buttonVariants } from ".";

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  class?: HTMLAttributes["class"];
  // A declared prop, so a caller's :disabled="false" can't re-enable a
  // loading button the way a fallthrough attribute would.
  disabled?: boolean;
  /**
   * Disables the button and shows a spinner before its content. With as-child
   * the child only gets the `disabled` and `aria-busy` attributes.
   */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  variant: "default",
  size: "default",
  class: undefined,
});
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
    :disabled="disabled || loading || undefined"
    :aria-busy="loading || undefined"
  >
    <!-- as-child hands the button's classes to the first child, so that can't be a spinner -->
    <Spinner v-if="loading && !asChild" />
    <slot></slot>
  </Primitive>
</template>
