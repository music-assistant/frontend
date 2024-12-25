<!--
Creates a horizontally scrolling text effect when content exceeds container width

Features:
- Automatic scrolling for overflow content
- Synchronization with other MarqueeText components for increased readability
- Constant speed scrolling
- Visibility-based animation control (so only visible elements are synced)
-->
<template>
  <!-- Main container with hidden overflow -->
  <div ref="containerRef" class="container">
    <!-- Scrolling content wrapper with dynamic transform -->
    <div ref="scrollingRef" class="scrolling" :style="scrollingStyle">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  computed,
  onBeforeUnmount,
  watch,
  nextTick,
} from "vue";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";

// Animation Constants
const SCROLL_SPEED = 30; // Scrolling speed in pixels per second
const START_DELAY = 2000; // Delay before starting scroll (milliseconds)
const END_DELAY = 4000; // Delay after scroll completion (milliseconds)
const RESET_ANIMATION_DURATION_MS = 1000; // Duration for reset animation (milliseconds)

// DOM References and State Management
const containerRef = ref<HTMLElement | null>(null);
const scrollingRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const scrollingWidth = ref(0);
const offsetPosition = ref(0);
const isForwardScroll = ref(false);
const isVisible = ref(false);
const justEnabled = ref(false);

// Props Definition
const props = defineProps<{
  sync?: MarqueeTextSync; // Optional sync helper for coordinating multiple marquees
  disabled?: boolean; // Disable scrolling animation
}>();

// Register with the sync helper if provided
let animationSync = props.sync?._registerAnimation();
watch(
  () => props.sync,
  (newSync) => {
    if (animationSync !== undefined) {
      animationSync.unregister();
    }
    animationSync = newSync?._registerAnimation();
    startScrollCycle();
  },
);

// Computed Properties
const maxOffsetPosition = computed(() => {
  // Calculate maximum scroll distance needed to show the rightmost content
  return Math.max(scrollingWidth.value - containerWidth.value, 0);
});

const scrollDuration = computed(() => {
  // Calculate total scroll duration for constant speed
  const scroll_duration = maxOffsetPosition.value / SCROLL_SPEED;
  return scroll_duration * 1000; // Convert to milliseconds
});

const scrollingStyle = computed(() => ({
  transform: `translateX(${-offsetPosition.value}px)`,
  transition: isForwardScroll.value
    ? `transform ${scrollDuration.value}ms linear` // Forward scroll
    : `transform ${RESET_ANIMATION_DURATION_MS}ms ease-in-out`, // Reset animation
}));

// Animation Control for aborting the current animation
let animationController: AbortController | null = null;

// Utility function for creating cancelable delays
const delay = (ms: number, signal: AbortSignal) =>
  Promise.race([
    new Promise((resolve) => setTimeout(resolve, ms)),
    new Promise((_, reject) =>
      signal.addEventListener("abort", reject, { once: true }),
    ),
  ]);

// Main scrolling cycle implementation
const startScrollCycle = async () => {
  // Cancel any existing animation
  if (animationController && !animationController.signal.aborted) {
    animationController.abort();
  }

  isForwardScroll.value = false;
  offsetPosition.value = 0;

  // Check if scrolling is necessary
  if (
    props.disabled === true ||
    maxOffsetPosition.value <= 0 ||
    scrollDuration.value <= 0 ||
    !isVisible.value
  ) {
    animationSync?.unregister();
    return;
  }

  animationSync?.setScrollingDuration(scrollDuration.value);

  animationController = new AbortController();
  // Store the controller in a local variable, so we won't have
  // race conditions when the controller is reset in the finally block
  const ctrl = animationController;

  try {
    // Extra delay so other MarqueeText's can register their scrolling durations
    // in case they are all loaded at roughly the same time
    await delay(200, ctrl.signal);

    while (!ctrl.signal.aborted) {
      // Synchronization of all marquees
      if (animationSync !== undefined) {
        await Promise.race([
          animationSync.sync(),
          new Promise((_, reject) =>
            ctrl.signal.addEventListener("abort", reject, { once: true }),
          ),
        ]);
      }

      // Reset position to start
      isForwardScroll.value = false;
      offsetPosition.value = 0;

      // Calculate timing adjustments for sync, so all Marquees end at the same time
      const maxDuration = animationSync?.maxDuration() ?? scrollDuration.value;
      const extraStartDelay = maxDuration - scrollDuration.value;

      // Hold at the start of the text (including time required for reset animation and sync)
      await delay(
        (justEnabled.value ? 0 : RESET_ANIMATION_DURATION_MS + START_DELAY) +
          extraStartDelay,
        ctrl.signal,
      );
      justEnabled.value = false;

      // Start the scrolling to the end
      isForwardScroll.value = true;
      offsetPosition.value = maxOffsetPosition.value;

      // Wait for the scroll to finish, hold at the end, so the user can read the text
      await delay(scrollDuration.value + END_DELAY, ctrl.signal);
    }
  } catch (err) {
    // Animation aborted, reset position
    isForwardScroll.value = false;
    offsetPosition.value = 0;
    // no need to cleanup `animationSync` here, since:
    // - the new scroll cycle will be started, which will reset or use animationSync
    // - the component will be unmounted, which will cleanup the animationSync
  }
};

// Observers Setup

// Detects changes in the width of this component
const containerObserver = new ResizeObserver(() => {
  if (!containerRef.value) return;
  containerWidth.value = containerRef.value.clientWidth;
});

// Detects changes in the content of the scrolling element
// (so also when the width of the content changes)
const scrollingObserver = new MutationObserver(() => {
  if (!scrollingRef.value) return;
  scrollingWidth.value = scrollingRef.value.scrollWidth;
});

// Detects visibility changes of the container,
// so we only animate when the element is visible
const visibilityObserver = new IntersectionObserver(
  (entries) => {
    const [entry] = entries;
    isVisible.value = entry.isIntersecting;
  },
  { threshold: 0 },
);

// Lifecycle Hooks

// Setup observers and initial measurements
const setup = () => {
  nextTick(() => {
    if (!containerRef.value || !scrollingRef.value) return;

    // Initialize measurements after DOM update
    scrollingWidth.value = scrollingRef.value.scrollWidth;
    containerWidth.value = containerRef.value.clientWidth;
  });
  if (!containerRef.value || !scrollingRef.value) return;
  // Setup observers
  scrollingObserver.observe(scrollingRef.value, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  containerObserver.observe(containerRef.value);
  visibilityObserver.observe(containerRef.value);
};

// Cleanup observers and animation
const cleanup = () => {
  if (animationController) {
    animationController.abort();
    animationController = null;
  }
  animationSync?.unregister();
  scrollingObserver.disconnect();
  containerObserver.disconnect();
  visibilityObserver.disconnect();
  isVisible.value = false;
};

onMounted(() => {
  if (props.disabled !== true) {
    setup();
  }
});

onBeforeUnmount(() => {
  cleanup();
});

// Watch for changes that require animation restart
watch(
  [maxOffsetPosition, isVisible, () => props.disabled],
  () => {
    startScrollCycle();
  },
  { flush: "post" },
);
watch(
  () => props.disabled,
  () => {
    if (props.disabled === true) {
      cleanup();
    } else {
      justEnabled.value = true;
      setup();
    }
  },
);
</script>

<style scoped>
.container {
  position: relative;
  overflow: hidden;
  width: 100%;
  min-height: 1.5em;
}

.scrolling {
  white-space: nowrap;
  display: inline-block;
  will-change: transform;
  position: relative;
  left: 0;
  top: 0;
}
</style>
