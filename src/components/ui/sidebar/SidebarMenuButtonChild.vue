<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { PrimitiveProps } from "reka-ui";
import { Primitive } from "reka-ui";
import { onBeforeUnmount, ref, type HTMLAttributes } from "vue";
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

const PRESS_FEEDBACK_DURATION_MS = 650;
const pressFeedbackActive = ref(false);
let pressFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
let lastFeedbackAt = 0;

function activatePressFeedback(element: HTMLElement) {
  if (!props.ripple || element.matches(":disabled, [aria-disabled='true']")) {
    return;
  }

  pressFeedbackActive.value = true;
  if (pressFeedbackTimer) clearTimeout(pressFeedbackTimer);
  pressFeedbackTimer = setTimeout(() => {
    pressFeedbackActive.value = false;
    pressFeedbackTimer = undefined;
  }, PRESS_FEEDBACK_DURATION_MS);
}

function triggerPressFeedback(element: HTMLElement) {
  const now = Date.now();
  if (now - lastFeedbackAt < 100) return;
  lastFeedbackAt = now;
  activatePressFeedback(element);
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  triggerPressFeedback(event.currentTarget as HTMLElement);
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
  triggerPressFeedback(event.currentTarget as HTMLElement);
}

function handleClick(event: MouseEvent) {
  triggerPressFeedback(event.currentTarget as HTMLElement);
}

onBeforeUnmount(() => {
  if (pressFeedbackTimer) clearTimeout(pressFeedbackTimer);
});
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

<style scoped>
.sidebar-menu-button-feedback::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: var(--sidebar-active);
  opacity: 0;
  pointer-events: none;
  content: "";
}

.sidebar-menu-button-feedback > :deep(*) {
  position: relative;
  z-index: 1;
}

.sidebar-menu-button-feedback--active::after {
  animation: sidebar-menu-button-feedback 650ms ease-out both;
}

@keyframes sidebar-menu-button-feedback {
  0% {
    opacity: 0;
  }

  24% {
    opacity: 0.8;
  }

  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-menu-button-feedback--active::after {
    animation: none;
  }
}
</style>
