<template>
  <div
    class="ed-shelf__viewport"
    :style="{ '--ed-nav-top': navTop + 'px' }"
    @mouseenter="hovering = canHover"
    @mouseleave="hovering = false"
    @wheel="onWheel"
  >
    <!-- prev -->
    <button
      v-show="hovering && canLeft"
      class="ed-shelf__nav ed-shelf__nav--left"
      :aria-label="$t('tooltip.scroll_left')"
      @click="scroll(-1)"
    >
      <ChevronLeft :size="20" />
    </button>

    <div
      ref="track"
      class="ed-shelf__track ma-scroll"
      :class="{ 'ed-shelf__track--dragging': dragging }"
      :style="{
        '--ed-gap': gap + 'px',
        ...(tileArt != null ? { '--ed-tile-art': tileArt + 'px' } : {}),
      }"
      @scroll="onScroll"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onClickCapture"
      @dragstart.prevent
    >
      <slot></slot>
    </div>

    <!-- next -->
    <button
      v-show="hovering && canRight"
      class="ed-shelf__nav ed-shelf__nav--right"
      :aria-label="$t('tooltip.scroll_right')"
      @click="scroll(1)"
    >
      <ChevronRight :size="20" />
    </button>
  </div>
</template>

<script lang="ts">
export interface ShelfTrackExpose {
  scrollToStart: () => void;
  alignItemStart: (selector: string) => void;
}
</script>

<script setup lang="ts">
import { getBreakpointValue } from "@/plugins/breakpoint";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

interface Props {
  gap?: number;
  navCenter?: number;
  tilesPerView?: number;
}
const props = withDefaults(defineProps<Props>(), {
  gap: 14,
  navCenter: 92,
  tilesPerView: 0,
});

const emit = defineEmits<{
  (e: "endReached"): void;
}>();

const CARD_PAD = 16;
const PHONE_GAP = 4;
const PHONE_CARD_PAD = 8;
const MIN_ART = 120;
const MAX_ART = 280;
const ART_TOP_OFFSET = 12;
// stands in for a line of text when a wheel reports its delta in lines
const WHEEL_LINE_HEIGHT = 20;

// Only track hover (for the nav chevrons) on hover-capable devices. On touch
// devices the emulated mouseenter would mutate the DOM, which makes mobile
// Safari swallow the first tap as "hover" instead of a click.
const canHover = window.matchMedia?.("(hover: hover)")?.matches ?? true;
const track = ref<HTMLElement | null>(null);
const hovering = ref(false);
const canLeft = ref(false);
const canRight = ref(false);
const tileArt = ref<number | null>(null);

const navTop = computed(() =>
  tileArt.value != null ? ART_TOP_OFFSET + tileArt.value / 2 : props.navCenter,
);

function scrollToStart() {
  const el = track.value;
  if (!el) return;
  el.scrollLeft = 0;
}

function alignItemStart(selector: string) {
  const el = track.value;
  if (!el) return;
  const item = el.querySelector(selector) as HTMLElement | null;
  if (!item) {
    scrollToStart();
    return;
  }
  const delta =
    item.getBoundingClientRect().left - el.getBoundingClientRect().left;
  el.scrollBy({ left: delta, behavior: "smooth" });
}

defineExpose<ShelfTrackExpose>({
  scrollToStart,
  alignItemStart,
});

const verticalScrollParent = (el: HTMLElement): HTMLElement => {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      /(auto|scroll|overlay)/.test(overflowY) &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return document.documentElement;
};

// Firefox reports a wheel notch as lines rather than pixels, so the raw delta
// has to be converted before it means anything to a scroller.
const wheelPixels = (e: WheelEvent, scroller: HTMLElement) => {
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return e.deltaY * WHEEL_LINE_HEIGHT;
  }
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return e.deltaY * scroller.clientHeight;
  }
  return e.deltaY;
};

const onWheel = (e: WheelEvent) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();

  const scroller = verticalScrollParent(e.currentTarget as HTMLElement);
  const delta = wheelPixels(e, scroller);
  if (Math.abs(delta) < 1) return;

  scroller.scrollTop += delta;
};

const updateTileArt = () => {
  const el = track.value;
  if (!el || !props.tilesPerView || props.tilesPerView <= 0) {
    tileArt.value = null;
    return;
  }
  const isPhone = getBreakpointValue({ breakpoint: "bp1", condition: "lt" });
  const gap = isPhone ? Math.min(props.gap, PHONE_GAP) : props.gap;
  const cardPad = isPhone ? PHONE_CARD_PAD : CARD_PAD;
  const size = el.clientWidth / props.tilesPerView - gap - cardPad;
  tileArt.value = Math.round(Math.max(MIN_ART, Math.min(MAX_ART, size)));
};

// emitted once per approach of the end zone; growing the content pushes the
// end back out of reach, which re-arms it for the next page
let endSignalled = false;

const checkEndReached = (el: HTMLElement) => {
  const atEnd =
    el.scrollWidth > el.clientWidth &&
    el.scrollLeft + el.clientWidth >= el.scrollWidth - el.clientWidth;
  if (!atEnd) {
    endSignalled = false;
    return;
  }
  if (endSignalled) return;
  endSignalled = true;
  emit("endReached");
};

const update = () => {
  const el = track.value;
  if (!el) return;
  canLeft.value = el.scrollLeft > 1;
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  updateTileArt();
  checkEndReached(el);
};
const onScroll = () => update();

watch(() => props.tilesPerView, updateTileArt);

const scroll = (dir: number) => {
  const el = track.value;
  if (!el) return;
  el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
};

// Click-and-drag panning for mice; touch already pans natively. A pointer only
// counts as a drag once it passes the threshold, so a click on a tile still
// reaches the tile.
const DRAG_THRESHOLD = 6;

const dragging = ref(false);
let pointerDown = false;
let dragStartX = 0;
let dragStartScroll = 0;
let swallowClick = false;

const onPointerDown = (e: PointerEvent) => {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  pointerDown = true;
  swallowClick = false;
  dragStartX = e.clientX;
  dragStartScroll = track.value?.scrollLeft ?? 0;
};

const onPointerMove = (e: PointerEvent) => {
  const el = track.value;
  if (!pointerDown || !el) return;
  // the button can be let go outside the track, where our pointerup never
  // lands; a move with no button held means that gesture is over
  if (!(e.buttons & 1)) {
    pointerDown = false;
    dragging.value = false;
    return;
  }
  const dx = e.clientX - dragStartX;
  if (!dragging.value) {
    if (Math.abs(dx) < DRAG_THRESHOLD) return;
    dragging.value = true;
    el.setPointerCapture(e.pointerId);
  }
  el.scrollLeft = dragStartScroll - dx;
};

const onPointerUp = () => {
  const el = track.value;
  pointerDown = false;
  // a gesture that never moved the row is still a click, which keeps short
  // rows and rows already at their end clickable
  swallowClick = dragging.value && !!el && el.scrollLeft !== dragStartScroll;
  dragging.value = false;
};

const onClickCapture = (e: MouseEvent) => {
  if (!swallowClick) return;
  swallowClick = false;
  e.stopPropagation();
  e.preventDefault();
};

let ro: ResizeObserver | undefined;
onMounted(() => {
  update();
  window.addEventListener("resize", update);
  if (track.value && "ResizeObserver" in window) {
    ro = new ResizeObserver(update);
    ro.observe(track.value);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", update);
  ro?.disconnect();
});
</script>

<style scoped>
.ed-shelf__viewport {
  /* the gutter and card padding are inherited when this sits inside an
     EditorialShelf; the fallbacks keep a standalone track looking the same */
  --ed-track-gutter: var(--ed-gutter, 28px);
  --ed-track-pad: var(--ed-card-pad, 8px);
  position: relative;
  padding-left: calc(var(--ed-track-gutter) - var(--ed-track-pad));
  padding-right: var(--ed-track-gutter);
}
.ed-shelf__track {
  display: flex;
  align-items: flex-start;
  gap: var(--ed-gap, 14px);
  position: relative;
  overflow-x: auto;
  overflow-y: visible;
  overscroll-behavior-x: contain;
  padding-block: 4px;
  /* pan-y too: a vertical swipe starting on a tile must scroll the page */
  touch-action: pan-x pan-y;
  scroll-snap-type: x proximity;
  overflow-anchor: none;
  scroll-padding-inline: calc(var(--ed-track-gutter) - var(--ed-track-pad));
}
.ed-shelf__track::after {
  content: "";
  flex: 0 0 calc(var(--ed-track-gutter) - var(--ed-gap, 14px));
}
.ed-shelf__track--dragging {
  cursor: grabbing;
  user-select: none;
  /* snapping while the pointer drives scrollLeft fights the drag */
  scroll-snap-type: none;
}
.ma-scroll {
  scrollbar-width: none;
}
.ma-scroll::-webkit-scrollbar {
  display: none;
}

.ed-shelf__nav {
  position: absolute;
  top: var(--ed-nav-top, 96px);
  transform: translateY(-50%);
  z-index: 3;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--v-theme-on-background));
  background: rgb(var(--v-theme-panel));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}
.ed-shelf__nav:hover {
  background: rgb(var(--v-theme-surface));
}
.ed-shelf__nav:active {
  transform: translateY(-50%) scale(0.94);
}
.ed-shelf__nav--left {
  left: 12px;
}
.ed-shelf__nav--right {
  right: 12px;
}

@media (max-width: 600px) {
  .ed-shelf__viewport {
    --ed-track-gutter: var(--ed-gutter, 16px);
  }
  .ed-shelf__nav {
    display: none;
  }
}

@media (max-width: 500px) {
  .ed-shelf__viewport {
    --ed-track-pad: var(--ed-card-pad, 4px);
  }
  .ed-shelf__track {
    gap: 4px;
  }
}
</style>
