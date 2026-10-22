<template>
  <div
    ref="handle"
    data-panel-drag-region
    class="panel-drag-handle relative flex h-8 shrink-0 touch-none cursor-grab items-center justify-center select-none active:cursor-grabbing"
    role="button"
    tabindex="0"
    :aria-label="$t('close')"
    @keydown.enter.space.prevent="emit('dismiss')"
  >
    <div class="bg-muted-foreground/40 h-1 w-12 rounded-full"></div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const DISMISS_DISTANCE = 24;
const SWIPE_DISMISS_DISTANCE = 72;
const SWIPE_SLOP = 10;
const SWIPE_BLOCKED_SELECTOR =
  "[data-slot='slider'], input[type='range'], [data-no-panel-drag]";

const props = defineProps<{
  swipeAnywhere?: boolean;
}>();

const handle = ref<HTMLElement>();
const panel = ref<HTMLElement>();
const emit = defineEmits<{
  dismiss: [];
}>();

let pointerId: number | undefined;
let startY = 0;
let distance = 0;
let dismissDistance = DISMISS_DISTANCE;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;
let candidateId: number | undefined;
let candidateStartX = 0;
let candidateStartY = 0;
let swipeDrag = false;
let swipeDragEndedAt = 0;

onMounted(() => {
  panel.value =
    handle.value?.closest<HTMLElement>("[data-player-panel]") ?? undefined;
  panel.value?.addEventListener("pointerdown", startDrag);
  panel.value?.addEventListener("pointermove", moveDrag);
  panel.value?.addEventListener("pointerup", endDrag);
  panel.value?.addEventListener("pointercancel", cancelDrag);
  if (props.swipeAnywhere) {
    panel.value?.addEventListener("touchmove", preventTouchScroll, {
      passive: false,
    });
    panel.value?.addEventListener("click", suppressSwipeClick, true);
  }
});

onBeforeUnmount(() => {
  panel.value?.removeEventListener("pointerdown", startDrag);
  panel.value?.removeEventListener("pointermove", moveDrag);
  panel.value?.removeEventListener("pointerup", endDrag);
  panel.value?.removeEventListener("pointercancel", cancelDrag);
  panel.value?.removeEventListener("touchmove", preventTouchScroll);
  panel.value?.removeEventListener("click", suppressSwipeClick, true);
  clearDismissTimer();
});

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const activePanel = getPanel();
  if (!activePanel) return;
  if (isDragTarget(target)) {
    event.preventDefault();
    engage(event, DISMISS_DISTANCE, false);
    return;
  }
  if (!props.swipeAnywhere) return;
  if (!event.isPrimary || event.pointerType === "mouse") return;
  if (isSwipeBlocked(target, activePanel)) return;
  candidateId = event.pointerId;
  candidateStartX = event.clientX;
  candidateStartY = event.clientY;
}

function engage(event: PointerEvent, threshold: number, viaSwipe: boolean) {
  const activePanel = getPanel();
  if (!activePanel) return;
  pointerId = event.pointerId;
  startY = event.clientY;
  distance = 0;
  dismissDistance = threshold;
  swipeDrag = viaSwipe;
  delete activePanel.dataset.dragDismissed;
  activePanel.setPointerCapture(event.pointerId);
  activePanel.style.transition = "none";
  activePanel.style.willChange = "transform, opacity";
}

function moveDrag(event: PointerEvent) {
  if (pointerId === undefined && candidateId === event.pointerId) {
    const dx = event.clientX - candidateStartX;
    const dy = event.clientY - candidateStartY;
    if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return;
    candidateId = undefined;
    if (dy >= SWIPE_SLOP && dy > Math.abs(dx)) {
      engage(event, SWIPE_DISMISS_DISTANCE, true);
    }
    return;
  }
  if (event.pointerId !== pointerId) return;
  event.preventDefault();
  distance = Math.max(0, event.clientY - startY);
  const panel = getPanel();
  if (!panel) return;
  panel.style.setProperty(
    "transform",
    `translate3d(0, ${distance}px, 0)`,
    "important",
  );
  panel.style.setProperty(
    "opacity",
    String(Math.max(0.5, 1 - distance / 400)),
    "important",
  );
}

function endDrag(event: PointerEvent) {
  if (candidateId === event.pointerId) candidateId = undefined;
  if (event.pointerId !== pointerId) return;
  if (swipeDrag) swipeDragEndedAt = Date.now();
  swipeDrag = false;
  releasePointer(event.pointerId);
  if (distance >= dismissDistance) {
    animateDismiss();
  } else {
    resetPanel();
  }
}

function cancelDrag(event: PointerEvent) {
  if (candidateId === event.pointerId) candidateId = undefined;
  if (event.pointerId !== pointerId) return;
  swipeDrag = false;
  releasePointer(event.pointerId);
  resetPanel();
}

function preventTouchScroll(event: TouchEvent) {
  if (pointerId !== undefined && swipeDrag) event.preventDefault();
}

function suppressSwipeClick(event: MouseEvent) {
  if (Date.now() - swipeDragEndedAt > 400) return;
  event.preventDefault();
  event.stopPropagation();
}

function animateDismiss() {
  const panel = getPanel();
  if (!panel) {
    emit("dismiss");
    return;
  }
  panel.style.transition = "transform 160ms ease-in, opacity 160ms ease-in";
  panel.dataset.dragDismissed = "true";
  panel.style.setProperty("transform", "translate3d(0, 100%, 0)", "important");
  panel.style.setProperty("opacity", "0", "important");
  clearDismissTimer();
  dismissTimer = setTimeout(() => emit("dismiss"), 170);
}

function resetPanel() {
  const panel = getPanel();
  if (!panel) return;
  panel.style.transition = "transform 180ms ease-out, opacity 180ms ease-out";
  panel.style.setProperty("transform", "translate3d(0, 0, 0)", "important");
  panel.style.setProperty("opacity", "1", "important");
  setTimeout(() => {
    panel.style.removeProperty("transition");
    panel.style.removeProperty("transform");
    panel.style.removeProperty("opacity");
    panel.style.removeProperty("will-change");
  }, 180);
}

function releasePointer(activePointerId: number) {
  if (panel.value?.hasPointerCapture(activePointerId)) {
    panel.value.releasePointerCapture(activePointerId);
  }
  pointerId = undefined;
}

function getPanel() {
  return panel.value;
}

function isDragTarget(target: Element) {
  if (target.closest(".panel-drag-handle")) return true;
  if (!target.closest("[data-panel-drag-region]")) return false;
  return !target.closest(
    "button, a, input, select, textarea, [role='menuitem'], [data-no-panel-drag]",
  );
}

function isSwipeBlocked(target: Element, activePanel: HTMLElement): boolean {
  if (target.closest(SWIPE_BLOCKED_SELECTOR)) return true;

  let el: Element | null = target;
  while (el && el !== activePanel) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

function clearDismissTimer() {
  if (!dismissTimer) return;
  clearTimeout(dismissTimer);
  dismissTimer = undefined;
}
</script>

<style scoped>
.panel-drag-handle::before {
  position: absolute;
  inset: -10px 0;
  content: "";
}
</style>
