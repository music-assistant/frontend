<template>
  <!-- Above the fullscreen player and its controls, not inside its card, and
       below the shared dialogs, which open on top of it (see global.css). -->
  <Teleport to="body">
    <div
      ref="root"
      class="artwork-only group fixed inset-0 z-[9003] cursor-pointer touch-pinch-zoom overflow-hidden bg-[#0b0b0f]"
      :class="{ 'artwork-only--paused': !playing }"
      role="button"
      tabindex="0"
      :aria-label="$t('tooltip.show_player_controls')"
      @click="emit('close')"
      @keydown.enter.prevent="emit('close')"
      @keydown.space.prevent="emit('close')"
      @keydown.tab.prevent
    >
      <!-- The artwork alone fills the screen, so a click anywhere is the way back.
           It holds the focus while open: Tab has nothing else to reach. It
           refuses panning, as the player panel does embedded (global.css), so
           a drag cannot reach a host's pull-to-refresh. -->
      <!-- The backdrop is the artwork itself: blurred hard, livelier and darker,
         and cross-faded when the music changes. It is oversized so the blur
         has pixels to sample at the edges instead of fading to transparent. -->
      <!-- a still backdrop says the music is too -->
      <div
        class="artwork-only__bg absolute inset-0 will-change-transform group-[.artwork-only--paused]:[animation-play-state:paused] motion-reduce:animate-none"
      >
        <Transition
          enter-active-class="transition-opacity duration-[800ms] ease-[ease]"
          leave-active-class="transition-opacity duration-[800ms] ease-[ease]"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <img
            v-if="shownUrl"
            :key="shownUrl"
            class="artwork-only__bg-img absolute inset-[-15%] h-[130%] w-[130%] object-cover blur-[56px] brightness-[0.68] saturate-[1.7] [transform:translateZ(0)]"
            :src="shownUrl"
            alt=""
            draggable="false"
          />
        </Transition>
        <div
          class="artwork-only__scrim absolute inset-0 bg-[rgba(11,11,15,0.45)] group-[.artwork-only--paused]:[animation-play-state:paused] motion-reduce:animate-none"
        ></div>
      </div>
      <!-- old and new cover share the one cell while they cross-fade; the whole
           cover shows, whatever its shape, with the shadow following it -->
      <div class="absolute inset-0 grid place-items-center">
        <Transition
          enter-active-class="transition-opacity duration-[800ms] ease-[ease]"
          leave-active-class="transition-opacity duration-[800ms] ease-[ease]"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <img
            v-if="shownUrl"
            :key="shownUrl"
            class="artwork-only__cover aspect-square w-[min(90vw,90dvh,1000px)] rounded-2xl object-contain drop-shadow-[0_24px_64px_rgba(0,0,0,0.5)] [grid-area:1/1]"
            :src="shownUrl"
            :alt="title ?? $t('tooltip.artwork')"
            draggable="false"
          />
        </Transition>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

export interface Props {
  imageUrl?: string;
  title?: string | null;
  playing: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

// Escape leaves only this view: the fullscreen player under it closes on an
// Escape that reaches the window.
// A Ctrl/Cmd shortcut, such as the command center's, leaves the view and goes
// on to open what it opens, which would otherwise be hidden behind the view.
const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt"]);
const onKeydown = (event: KeyboardEvent) => {
  // the modifier alone is not a shortcut yet
  if ((event.ctrlKey || event.metaKey) && !MODIFIER_KEYS.has(event.key)) {
    emit("close");
    return;
  }
  if (event.key !== "Escape") return;
  event.stopPropagation();
  emit("close");
};

// A new cover is shown once it has loaded, so the cross-fade never fades to a
// blank; one that fails to load leaves the current cover in place.
const shownUrl = ref(props.imageUrl);
let loading: HTMLImageElement | null = null;
const stopLoading = () => {
  if (loading) loading.onload = loading.onerror = null;
  loading = null;
};
watch(
  () => props.imageUrl,
  (url) => {
    stopLoading();
    if (!url) {
      shownUrl.value = url;
      return;
    }
    const image = new Image();
    image.onload = () => {
      shownUrl.value = url;
      stopLoading();
    };
    image.onerror = stopLoading;
    loading = image;
    image.src = url;
  },
);

// Keyboard users land in the view and return to where they came from.
const root = ref<HTMLElement | null>(null);
let focusBefore: HTMLElement | null = null;

// A screen showing nothing but the artwork is there to be looked at, so it
// stays on while there is music. The system drops the lock when the tab is
// hidden, hence asking again when it becomes visible.
// A lock granted after it stopped being wanted is let go at once, and a wish
// that changed while a request was pending is settled once it is answered.
let wakeLock: WakeLockSentinel | null = null;
let wantLock = false;
let acquiring = false;
let changedWhileAcquiring = false;
const visible = ref(!document.hidden);
const onVisibilityChange = () => {
  visible.value = !document.hidden;
};
const holdScreen = async (want: boolean) => {
  wantLock = want;
  if (acquiring) {
    changedWhileAcquiring = true;
    return;
  }
  try {
    if (want && !wakeLock && "wakeLock" in navigator) {
      acquiring = true;
      changedWhileAcquiring = false;
      try {
        const lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          if (wakeLock !== lock) return;
          wakeLock = null;
          // the system can let go on its own; ask again while still wanted
          if (wantLock && !document.hidden) void holdScreen(true);
        });
        if (wantLock) wakeLock = lock;
        else await lock.release();
      } catch (error) {
        console.debug("Screen wake lock:", error);
      } finally {
        acquiring = false;
      }
      // a refusal is not asked again unless the wish changed meanwhile
      if (changedWhileAcquiring) {
        changedWhileAcquiring = false;
        void holdScreen(wantLock);
      }
    } else if (!want && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch (error) {
    console.debug("Screen wake lock:", error);
  }
};
watch(
  () => props.playing && visible.value,
  (want) => holdScreen(want),
  { immediate: true },
);

onMounted(() => {
  focusBefore =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  root.value?.focus();
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  void holdScreen(false);
  stopLoading();
  focusBefore?.focus();
});
</script>

<style scoped>
/* The backdrop breathes: a slow swell of the container, and of the scrim over
   it. Transform and opacity only, so the blur is not recomputed every frame.
   The animations stay next to their keyframes, which Vue scopes by renaming. */
.artwork-only__bg {
  animation: artwork-only-breathe 9s ease-in-out infinite;
}

.artwork-only__scrim {
  animation: artwork-only-swell 9s ease-in-out infinite;
}

@keyframes artwork-only-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

@keyframes artwork-only-swell {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
