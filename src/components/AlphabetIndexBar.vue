<template>
  <div
    ref="barEl"
    class="alphabet-index-bar"
    :style="barStyle"
    role="navigation"
    :aria-label="$t('alphabet_jump')"
    @pointerleave="activeLabel = null"
  >
    <button
      v-for="bucket in buckets"
      :key="bucket.label"
      type="button"
      class="alphabet-index-letter"
      :class="{ 'alphabet-index-letter--active': activeLabel === bucket.label }"
      :aria-label="bucket.label"
      @pointerdown.prevent="onActivate(bucket)"
      @pointerenter="onPointerEnter($event, bucket)"
    >
      {{ bucket.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { LetterIndexBucket } from "@/plugins/api/interfaces";
import { onBeforeUnmount, onMounted, ref } from "vue";

interface Props {
  // Buckets in the exact order they should be displayed (already reversed by
  // the server for descending sorts).
  buckets: LetterIndexBucket[];
}
defineProps<Props>();

const emit = defineEmits<{
  (e: "jump", bucket: LetterIndexBucket): void;
}>();

const activeLabel = ref<string | null>(null);

const onActivate = function (bucket: LetterIndexBucket) {
  activeLabel.value = bucket.label;
  emit("jump", bucket);
};

// Support dragging a finger/cursor down the bar to scrub through letters,
// matching the iOS-style fast-scroller UX. Only react while a pointer button
// is held down (buttons !== 0) so plain hover doesn't trigger jumps.
const onPointerEnter = function (evt: PointerEvent, bucket: LetterIndexBucket) {
  if (evt.buttons === 0) return;
  onActivate(bucket);
};

// Size the bar to the available vertical space of the scroll viewport, so the
// letters spread out to fill the height instead of clustering in the middle.
// Clear the listing toolbar at the top and the player bar (the scroll area's
// padding-bottom) at the bottom.
const TOOLBAR_CLEARANCE = 56;
const barEl = ref<HTMLElement | null>(null);
const barStyle = ref<Record<string, string>>({});

const updateSize = function () {
  const content = document.querySelector(
    ".content-section",
  ) as HTMLElement | null;
  if (!content) return;
  const rect = content.getBoundingClientRect();
  const padBottom = parseFloat(getComputedStyle(content).paddingBottom) || 0;
  const margin = 8;
  const top = rect.top + TOOLBAR_CLEARANCE;
  const height = rect.height - TOOLBAR_CLEARANCE - padBottom - margin;
  barStyle.value = {
    top: `${Math.round(top)}px`,
    height: `${Math.max(0, Math.round(height))}px`,
    transform: "none",
  };
};

onMounted(() => {
  updateSize();
  window.addEventListener("resize", updateSize);
});
onBeforeUnmount(() => window.removeEventListener("resize", updateSize));
</script>

<style scoped>
.alphabet-index-bar {
  /* fixed so the bar stays pinned to the right edge while the list scrolls
     (the surrounding .content-section is the scroll container). top/height are
     set dynamically so the letters fill the available vertical space. */
  position: fixed;
  right: 2px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
  touch-action: none;
  user-select: none;
}

.alphabet-index-letter {
  /* each letter takes an equal share of the bar height, giving full-height tap
     targets and an even distribution regardless of how many letters there are */
  flex: 1 1 0;
  width: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.7rem, 1.6vh, 0.95rem);
  line-height: 1;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  opacity: 0.75;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.alphabet-index-letter:hover,
.alphabet-index-letter--active {
  opacity: 1;
  background: rgba(var(--v-theme-primary), 0.18);
}
</style>
