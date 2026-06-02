<template>
  <div
    class="alphabet-index-bar"
    role="navigation"
    :aria-label="$t('alphabet_jump') || 'Alphabet quick jump'"
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
import { ref } from "vue";

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
</script>

<style scoped>
.alphabet-index-bar {
  /* fixed so the bar stays pinned to the right edge while the list scrolls
     (the surrounding .content-section is the scroll container) */
  position: fixed;
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 2px;
  /* keep clear of the player bar / bottom padding of the scroll area */
  max-height: calc(100% - 24px);
  touch-action: none;
  user-select: none;
}

.alphabet-index-letter {
  font-size: 0.62rem;
  line-height: 1;
  font-weight: 600;
  padding: 0 3px;
  margin: 0;
  height: 1.05rem;
  min-width: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-primary));
  opacity: 0.75;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.alphabet-index-letter:hover,
.alphabet-index-letter--active {
  opacity: 1;
  background: rgba(var(--v-theme-primary), 0.18);
}
</style>
