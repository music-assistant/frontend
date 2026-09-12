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
  /** Shows a spinner before the content and disables the button. */
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
    <Spinner v-if="loading" />
    <slot></slot>
  </Primitive>
</template>
