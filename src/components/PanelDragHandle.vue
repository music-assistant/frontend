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
const handle = ref<HTMLElement>();
const panel = ref<HTMLElement>();
const emit = defineEmits<{
  dismiss: [];
}>();

let pointerId: number | undefined;
let startY = 0;
let distance = 0;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  panel.value =
    handle.value?.closest<HTMLElement>("[data-player-panel]") ?? undefined;
  panel.value?.addEventListener("pointerdown", startDrag);
  panel.value?.addEventListener("pointermove", moveDrag);
  panel.value?.addEventListener("pointerup", endDrag);
  panel.value?.addEventListener("pointercancel", cancelDrag);
});

onBeforeUnmount(() => {
  panel.value?.removeEventListener("pointerdown", startDrag);
  panel.value?.removeEventListener("pointermove", moveDrag);
  panel.value?.removeEventListener("pointerup", endDrag);
  panel.value?.removeEventListener("pointercancel", cancelDrag);
  clearDismissTimer();
});

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element) || !isDragTarget(target)) return;
  const activePanel = getPanel();
  if (!activePanel) return;
  event.preventDefault();
  pointerId = event.pointerId;
  startY = event.clientY;
  distance = 0;
  delete activePanel.dataset.dragDismissed;
  activePanel.setPointerCapture(event.pointerId);
  activePanel.style.transition = "none";
  activePanel.style.willChange = "transform, opacity";
}

function moveDrag(event: PointerEvent) {
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
  if (event.pointerId !== pointerId) return;
  releasePointer(event.pointerId);
  if (distance >= DISMISS_DISTANCE) {
    animateDismiss();
  } else {
    resetPanel();
  }
}

function cancelDrag(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  releasePointer(event.pointerId);
  resetPanel();
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
