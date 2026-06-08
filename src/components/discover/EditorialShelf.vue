<template>
  <section
    class="ed-shelf"
    :class="{ 'ed-shelf--dimmed': dimmed }"
    @mouseenter="hovering = canHover"
    @mouseleave="hovering = false"
  >
    <div class="ed-shelf__head">
      <slot name="header">
        <div class="ed-shelf__titles">
          <h2 class="ed-shelf__title">{{ title }}</h2>
          <slot name="title-append"></slot>
          <span v-if="subtitle" class="ed-shelf__subtitle">{{ subtitle }}</span>
        </div>
      </slot>
      <div v-if="provider || $slots.actions" class="ed-shelf__aside">
        <ProviderIcon
          v-if="provider"
          class="ed-shelf__provider"
          :domain="provider"
          :size="20"
        />
        <div v-if="$slots.actions" class="ed-shelf__actions">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>

    <div
      class="ed-shelf__viewport"
      :style="{ '--ed-nav-top': navTop + 'px' }"
      @wheel="onWheel"
    >
      <!-- prev -->
      <button
        v-show="hovering && canLeft"
        class="ed-shelf__nav ed-shelf__nav--left"
        aria-label="Scroll left"
        @click="scroll(-1)"
      >
        <ChevronLeft :size="20" />
      </button>

      <div
        ref="track"
        class="ed-shelf__track ma-scroll"
        :style="{
          '--ed-gap': gap + 'px',
          ...(tileArt != null ? { '--ed-tile-art': tileArt + 'px' } : {}),
        }"
        @scroll="onScroll"
      >
        <slot></slot>
      </div>

      <!-- next -->
      <button
        v-show="hovering && canRight"
        class="ed-shelf__nav ed-shelf__nav--right"
        aria-label="Scroll right"
        @click="scroll(1)"
      >
        <ChevronRight :size="20" />
      </button>
    </div>
  </section>
</template>

<script lang="ts">
export interface EditorialShelfExpose {
  scrollToStart: () => void;
  alignItemStart: (selector: string) => void;
}
</script>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

interface Props {
  title?: string;
  subtitle?: string;
  provider?: string;
  gap?: number;
  navCenter?: number;
  dimmed?: boolean;
  tilesPerView?: number;
}
const props = withDefaults(defineProps<Props>(), {
  title: "",
  subtitle: "",
  provider: "",
  gap: 14,
  navCenter: 92,
  dimmed: false,
  tilesPerView: 0,
});

const CARD_PAD = 16;
const PHONE_GAP = 4;
const PHONE_CARD_PAD = 8
const MIN_ART = 120;
const MAX_ART = 280;
const ART_TOP_OFFSET = 12;

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

const onWheel = (e: WheelEvent) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();

  if (Math.abs(e.deltaY) < 1) return;

  const scroller = verticalScrollParent(e.currentTarget as HTMLElement);
  scroller.scrollTop += e.deltaY;
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

const update = () => {
  const el = track.value;
  if (!el) return;
  canLeft.value = el.scrollLeft > 1;
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  updateTileArt();
};
const onScroll = () => update();

watch(() => props.tilesPerView, updateTileArt);

const scroll = (dir: number) => {
  const el = track.value;
  if (!el) return;
  el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
};

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

defineExpose<EditorialShelfExpose>({
  scrollToStart,
  alignItemStart,
});

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
.ed-shelf {
  --ed-gutter: 28px;
  --ed-card-pad: 8px;
  position: relative;
  margin-bottom: 32px;
}
.ed-shelf__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
  padding: 0 var(--ed-gutter);
}
.ed-shelf__titles {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.ed-shelf__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ed-shelf__subtitle {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}
.ed-shelf__aside {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.ed-shelf__provider {
  flex-shrink: 0;
  /* ProviderIcon ships with its own horizontal margins; cancel them so it
     lines up with the shelf gutter and the aside gap is consistent. */
  margin-left: -10px;
  margin-right: -10px;
}
.ed-shelf__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.ed-shelf--dimmed {
  opacity: 0.4;
}

.ed-shelf__viewport {
  position: relative;
  padding-left: calc(var(--ed-gutter) - var(--ed-card-pad));
  padding-right: var(--ed-gutter);
}
.ed-shelf__track {
  display: flex;
  align-items: flex-start;
  gap: var(--ed-gap, 14px);
  overflow-x: auto;
  overflow-y: visible;
  overscroll-behavior-x: contain;
  padding-block: 4px;
  /* pan-y too: a vertical swipe starting on a tile must scroll the page */
  touch-action: pan-x pan-y;
  scroll-snap-type: x proximity;
  overflow-anchor: none;
  scroll-padding-inline: calc(var(--ed-gutter) - var(--ed-card-pad));
}
.ed-shelf__track::after {
  content: "";
  flex: 0 0 calc(var(--ed-gutter) - var(--ed-gap, 14px));
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
  .ed-shelf {
    --ed-gutter: 16px;
    margin-bottom: 16px;
  }
  .ed-shelf__head {
    margin-bottom: 0;
  }
  .ed-shelf__title {
    font-size: 19px;
  }
  .ed-shelf__nav {
    display: none;
  }
}

@media (max-width: 500px) {
  .ed-shelf {
    --ed-card-pad: 4px;
  }
  .ed-shelf__track {
    gap: 4px;
  }
}
</style>
