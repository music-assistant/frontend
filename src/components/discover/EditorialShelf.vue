<template>
  <section
    class="ed-shelf"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div class="ed-shelf__head">
      <slot name="header">
        <div class="ed-shelf__titles">
          <h2 class="ed-shelf__title">{{ title }}</h2>
          <span v-if="subtitle" class="ed-shelf__subtitle">{{ subtitle }}</span>
        </div>
      </slot>
    </div>

    <div
      class="ed-shelf__viewport"
      :style="{ '--ed-nav-top': navCenter + 'px' }"
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
        :style="{ '--ed-gap': gap + 'px' }"
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

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

interface Props {
  title?: string;
  subtitle?: string;
  gap?: number;
  navCenter?: number;
}
const props = withDefaults(defineProps<Props>(), {
  title: "",
  subtitle: "",
  gap: 14,
  navCenter: 92,
});

const track = ref<HTMLElement | null>(null);
const hovering = ref(false);
const canLeft = ref(false);
const canRight = ref(false);

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
  e.preventDefault();
  if (Math.abs(e.deltaY) < 1) return;
  const scroller = verticalScrollParent(e.currentTarget as HTMLElement);
  scroller.scrollTop += e.deltaY;
};

const update = () => {
  const el = track.value;
  if (!el) return;
  canLeft.value = el.scrollLeft > 1;
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
};
const onScroll = () => update();

const scroll = (dir: number) => {
  const el = track.value;
  if (!el) return;
  el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
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
  padding-block: 4px;
  touch-action: pan-x;
  scroll-snap-type: x proximity;
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
  }
  .ed-shelf__title {
    font-size: 19px;
  }
  .ed-shelf__nav {
    display: none;
  }
}
</style>
