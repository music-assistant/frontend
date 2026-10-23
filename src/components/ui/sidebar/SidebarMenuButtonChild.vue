<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { PrimitiveProps } from "reka-ui";
import { Primitive } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { useSidebarPressFeedback } from "@/composables/useSidebarPressFeedback";
import type { SidebarMenuButtonVariants } from ".";
import { sidebarMenuButtonVariants } from ".";

export interface SidebarMenuButtonProps extends PrimitiveProps {
  variant?: SidebarMenuButtonVariants["variant"];
  size?: SidebarMenuButtonVariants["size"];
  isActive?: boolean;
  ripple?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<SidebarMenuButtonProps>(), {
  as: "button",
  variant: "default",
  size: "default",
  ripple: true,
  class: undefined,
});

const { pressFeedbackActive, handlePointerDown, handleKeyDown, handleClick } =
  useSidebarPressFeedback(() => props.ripple);
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    :data-size="size"
    :data-active="isActive"
    :class="[
      cn(sidebarMenuButtonVariants({ variant, size }), props.class),
      'sidebar-menu-button-feedback',
      { 'sidebar-menu-button-feedback--active': pressFeedbackActive },
    ]"
    :as="as"
    :as-child="asChild"
    v-bind="$attrs"
    @pointerdown="handlePointerDown"
    @keydown="handleKeyDown"
    @click="handleClick"
  >
    <slot></slot>
  </Primitive>
</template>
