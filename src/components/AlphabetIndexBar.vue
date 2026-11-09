<template>
  <!-- fixed so the bar stays pinned to the right edge while the list scrolls
       (.content-section is the scroll container); it ends just above the bars
       pinned to the bottom of the screen, and its letters size to its height -->
  <div
    ref="bar"
    class="fixed right-[2px] bottom-[calc(var(--bottom-obscured-height,0px)+8px)] z-4 flex flex-col items-center justify-between px-[2px] touch-none select-none"
    :class="{ invisible: tooShort }"
    :style="barStyle"
    role="navigation"
    :aria-label="$t('alphabet_jump')"
    @pointerleave="activeLabel = null"
  >
    <button
      v-for="letter in letters"
      :key="letter.label"
      type="button"
      :class="letterClass(letter)"
      :aria-label="letter.label"
      @pointerdown.prevent="onPointerDown($event, letter.label)"
      @pointerenter="onPointerEnter($event, letter.label)"
      @click="onClick($event, letter.label)"
    >
      {{ letter.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { IndexLetter } from "@/composables/useLetterIndex";
import { useElementBounding, useElementSize } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";

interface Props {
  // every letter in listing order; one without items is dimmed but can still
  // be picked, the parent resolves it to a letter that has items
  letters: IndexLetter[];
}
defineProps<Props>();

const emit = defineEmits<{
  (e: "jump", label: string): void;
}>();

const activeLabel = ref<string | null>(null);

// Each letter takes an equal share of the bar height, giving full-height tap
// targets and an even spread regardless of how many letters there are.
const LETTER_BASE_CLASS =
  "flex min-h-0 w-full flex-[1_1_0] cursor-pointer items-center justify-center rounded-[6px] border-none text-[length:min(0.95rem,var(--letter-size,0.95rem))] leading-none font-semibold text-primary hover:bg-primary/18 hover:opacity-100";
const LETTER_ACTIVE_CLASS = "bg-primary/18 opacity-100";

const onActivate = function (label: string) {
  activeLabel.value = label;
  emit("jump", label);
};

// Support dragging a finger/cursor down the bar to scrub through letters,
// matching the iOS-style fast-scroller UX. Only react while a pointer button
// is held down (buttons !== 0) so plain hover doesn't trigger jumps.
// a touch stays tied to the letter it pressed, so the letters it is dragged
// onto would not hear of it
const onPointerDown = function (evt: PointerEvent, label: string) {
  (evt.currentTarget as Element).releasePointerCapture(evt.pointerId);
  onActivate(label);
};

// a mouse or finger press already jumped; a click from the keyboard or a
// screen reader has no press count
const onClick = function (evt: MouseEvent, label: string) {
  if (evt.detail === 0) onActivate(label);
};

const onPointerEnter = function (evt: PointerEvent, label: string) {
  if (evt.buttons === 0) return;
  onActivate(label);
};

// Exactly one background and opacity class per state, since all utilities are
// !important; hover beats both through its higher specificity, so hovering a
// dimmed letter still shows it at full opacity.
const letterClass = function (letter: IndexLetter) {
  if (activeLabel.value === letter.label) {
    return [LETTER_BASE_CLASS, LETTER_ACTIVE_CLASS];
  }
  return [
    LETTER_BASE_CLASS,
    "bg-transparent",
    letter.available ? "opacity-75" : "opacity-30",
  ];
};

// The bar starts below the listing toolbar at the top of the scroll area, so
// the letters spread over the height instead of clustering in the middle.
const TOOLBAR_CLEARANCE = 56;
const { top: contentTop } = useElementBounding(() =>
  document.querySelector<HTMLElement>(".content-section"),
);
// a letter's size as a share of the bar height, so all letters fit a short bar
const LETTER_SIZE_SHARE = 0.03;
// below this letter size in pixels the bar is too short to use, so it hides
const MIN_LETTER_SIZE = 9;
const { height: barHeight } = useElementSize(useTemplateRef("bar"));
const barStyle = computed(() => ({
  top: `${Math.round(contentTop.value + TOOLBAR_CLEARANCE)}px`,
  "--letter-size": barHeight.value
    ? `${barHeight.value * LETTER_SIZE_SHARE}px`
    : undefined,
}));
const tooShort = computed(
  () =>
    barHeight.value > 0 &&
    barHeight.value * LETTER_SIZE_SHARE < MIN_LETTER_SIZE,
);
</script>
