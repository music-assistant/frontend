<template>
  <!-- fixed so the bar stays pinned to the right edge while the list scrolls
       (.content-section is the scroll container); it ends just above the bars
       pinned to the bottom of the screen, and its letters size to its height.
       It keeps clear of the overlay scrollbar, and the listing reserves a
       gutter for it so no row runs underneath. -->
  <nav
    ref="bar"
    class="fixed right-[6px] bottom-[calc(var(--bottom-obscured-height,0px)+8px)] z-4 flex w-6 flex-col items-stretch rounded-full py-1 touch-none select-none pointer-coarse:w-7"
    :class="{ invisible: tooShort, 'bg-primary/10': scrubbing }"
    :style="barStyle"
    :aria-label="$t('alphabet_jump')"
    @pointerdown.prevent="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @keydown="onKeyDown"
  >
    <button
      v-for="letter in letters"
      :key="letter.label"
      type="button"
      :class="letterClass(letter)"
      :aria-label="letter.label"
      :aria-current="letter.label === shownLabel ? 'true' : undefined"
      @click="onClick($event, letter.label)"
    >
      {{ letter.label }}
    </button>

    <!-- the big letter beside the finger while scrubbing, as on a phone's
         contact list -->
    <div
      v-if="bubbleLabel"
      aria-hidden="true"
      class="pointer-events-none absolute right-full mr-3 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-lg transition-opacity duration-150 motion-reduce:transition-none"
      :class="scrubbing ? 'opacity-100' : 'opacity-0'"
      :style="{ top: `${bubbleTop}px` }"
    >
      {{ bubbleLabel }}
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { IndexLetter } from "@/composables/useLetterIndex";
import { useElementBounding, useElementSize } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";

interface Props {
  // every letter in listing order; one without items is dimmed but can still
  // be picked, the parent resolves it to a letter that has items
  letters: IndexLetter[];
  // the letter of the rows at the top of the list, highlighted while the bar
  // is not being used
  current?: string | null;
  // moves the list to the letter; settles once the list is there
  jump: (label: string) => Promise<void>;
}
const props = withDefaults(defineProps<Props>(), { current: null });

const barEl = useTemplateRef<HTMLElement>("bar");

const scrubbing = ref(false);
// the letter picked; it stays highlighted until the pointer lets go and the
// list has moved there, so the letter of the rows then at the top takes over
// without flicking back in between
const pickedLabel = ref<string | null>(null);
const shownLabel = computed(() => pickedLabel.value ?? props.current);
let jumpsInFlight = 0;

const settle = function () {
  if (!scrubbing.value && jumpsInFlight === 0) pickedLabel.value = null;
};

// Each letter takes an equal share of the bar height, giving full-height tap
// targets and an even spread regardless of how many letters there are.
const LETTER_BASE_CLASS =
  "flex min-h-0 w-full flex-[1_1_0] cursor-pointer items-center justify-center rounded-full border-none text-[length:min(0.75rem,var(--letter-size,0.75rem))] leading-none font-semibold";
const LETTER_ACTIVE_CLASS = "bg-primary text-primary-foreground";

// Exactly one colour class per state, since all utilities are !important; a
// letter not active has no background class, as Vuetify's bg-transparent
// would also force its text colour.
const letterClass = function (letter: IndexLetter) {
  if (letter.label === shownLabel.value) {
    return [LETTER_BASE_CLASS, LETTER_ACTIVE_CLASS];
  }
  return [
    LETTER_BASE_CLASS,
    letter.available ? "text-primary" : "text-muted-foreground/40",
  ];
};

const pick = async function (label: string) {
  if (pickedLabel.value === label) return;
  pickedLabel.value = label;
  jumpsInFlight++;
  try {
    await props.jump(label);
  } finally {
    jumpsInFlight--;
    settle();
  }
};

// The pointer's row along the bar picks the letter, so a finger dragged
// anywhere over the bar scrubs through them, whatever button it is over.
const letterAtY = function (y: number) {
  const rect = barEl.value?.getBoundingClientRect();
  const count = props.letters.length;
  if (!rect || !count || rect.height === 0) return undefined;
  const share = (y - rect.top) / rect.height;
  const index = Math.min(count - 1, Math.max(0, Math.floor(share * count)));
  return props.letters[index]?.label;
};

const HAPTIC_MS = 8;
const onPointerDown = function (evt: PointerEvent) {
  scrubbing.value = true;
  const label = letterAtY(evt.clientY);
  if (label) void pick(label);
  // keeps the moves coming while the pointer drifts off the bar; a pointer
  // the browser does not track (a synthetic event) cannot be captured
  try {
    barEl.value?.setPointerCapture(evt.pointerId);
  } catch {
    // the moves over the bar itself still scrub
  }
};

const onPointerMove = function (evt: PointerEvent) {
  if (!scrubbing.value) return;
  const label = letterAtY(evt.clientY);
  if (!label || label === pickedLabel.value) return;
  if (evt.pointerType === "touch") navigator.vibrate?.(HAPTIC_MS);
  void pick(label);
};

const onPointerEnd = function () {
  scrubbing.value = false;
  settle();
};

// a press already jumped; a click from the keyboard or a screen reader has
// no press count
const onClick = function (evt: MouseEvent, label: string) {
  if (evt.detail === 0) void pick(label);
};

// arrow keys walk the letters from the focused one and jump as they go
const onKeyDown = function (evt: KeyboardEvent) {
  const buttons = Array.from(
    barEl.value?.querySelectorAll<HTMLButtonElement>("button") ?? [],
  );
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  const steps: Record<string, number> = {
    ArrowDown: at + 1,
    ArrowUp: at - 1,
    Home: 0,
    End: buttons.length - 1,
  };
  const next = steps[evt.key];
  if (next === undefined || next < 0 || next >= buttons.length) return;
  evt.preventDefault();
  buttons[next].focus();
  void pick(props.letters[next].label);
};

// the bubble sits level with the picked letter, and fades once let go
const bubbleLabel = computed(() => pickedLabel.value);
const { height: barHeight } = useElementSize(barEl);
const bubbleTop = computed(() => {
  const count = props.letters.length;
  const at = props.letters.findIndex((l) => l.label === pickedLabel.value);
  if (at < 0 || !count) return 0;
  return ((at + 0.5) / count) * barHeight.value;
});

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
