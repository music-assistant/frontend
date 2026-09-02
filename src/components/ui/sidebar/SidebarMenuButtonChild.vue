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
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<SidebarMenuButtonProps>(), {
  as: "button",
  variant: "default",
  size: "default",
  class: undefined,
});

interface Ripple {
  id: number;
  size: number;
  x: number;
  y: number;
}

const RIPPLE_DURATION_MS = 450;
const RIPPLE_FALLBACK_CLEANUP_MS = RIPPLE_DURATION_MS * 3;
const ripples = ref<Ripple[]>([]);
const rippleTimers = new Map<number, ReturnType<typeof setTimeout>>();
let nextRippleId = 0;

function removeRipple(id: number) {
  ripples.value = ripples.value.filter((ripple) => ripple.id !== id);

  const timer = rippleTimers.get(id);
  if (timer) clearTimeout(timer);
  rippleTimers.delete(id);
}

function addRipple(element: HTMLElement, clientX?: number, clientY?: number) {
  if (
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
    element.matches(":disabled, [aria-disabled='true']")
  ) {
    return;
  }

  const bounds = element.getBoundingClientRect();
  const originX =
    clientX === undefined ? bounds.width / 2 : clientX - bounds.left;
  const originY =
    clientY === undefined ? bounds.height / 2 : clientY - bounds.top;
  const radius = Math.hypot(
    Math.max(originX, bounds.width - originX),
    Math.max(originY, bounds.height - originY),
  );
  const id = nextRippleId++;

  ripples.value.push({
    id,
    size: radius * 2,
    x: originX - radius,
    y: originY - radius,
  });

  rippleTimers.set(
    id,
    setTimeout(() => removeRipple(id), RIPPLE_FALLBACK_CLEANUP_MS),
  );
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  addRipple(event.currentTarget as HTMLElement, event.clientX, event.clientY);
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
  addRipple(event.currentTarget as HTMLElement);
}

onBeforeUnmount(() => {
  rippleTimers.forEach((timer) => clearTimeout(timer));
});
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    :data-size="size"
    :data-active="isActive"
    :class="cn(sidebarMenuButtonVariants({ variant, size }), props.class)"
    :as="as"
    :as-child="asChild"
    v-bind="$attrs"
    @pointerdown="handlePointerDown"
    @keydown="handleKeyDown"
  >
    <span
      v-for="ripple in ripples"
      :key="ripple.id"
      aria-hidden="true"
      class="pointer-events-none absolute rounded-full bg-current will-change-transform animate-[sidebar-ripple_450ms_cubic-bezier(0.2,0,0,1)_forwards] motion-reduce:animate-none"
      :style="{
        width: `${ripple.size}px`,
        height: `${ripple.size}px`,
        left: `${ripple.x}px`,
        top: `${ripple.y}px`,
      }"
      @animationend="removeRipple(ripple.id)"
    ></span>
    <slot></slot>
  </Primitive>
</template>
