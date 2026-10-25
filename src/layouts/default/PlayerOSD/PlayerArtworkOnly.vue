<template>
  <!-- Above the fullscreen player and its controls, not inside its card. -->
  <Teleport to="body">
    <div
      class="artwork-only"
      :class="{ 'artwork-only--paused': !playing }"
      role="button"
      tabindex="0"
      :aria-label="$t('tooltip.show_player_controls')"
      @click="emit('close')"
      @keydown.enter.prevent="emit('close')"
      @keydown.space.prevent="emit('close')"
    >
      <!-- The artwork alone fills the screen, so a click anywhere is the way back. -->
      <!-- The backdrop is the artwork itself: blurred hard, livelier and darker,
         and cross-faded when the music changes. -->
      <div class="artwork-only__bg">
        <Transition name="artwork-only-xfade">
          <img
            v-if="imageUrl"
            :key="imageUrl"
            class="artwork-only__bg-img"
            :src="imageUrl"
            alt=""
            draggable="false"
          />
        </Transition>
        <div class="artwork-only__scrim"></div>
      </div>
      <div class="artwork-only__stage">
        <Transition name="artwork-only-xfade">
          <img
            v-if="imageUrl"
            :key="imageUrl"
            class="artwork-only__cover"
            :src="imageUrl"
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

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") emit("close");
};

// A screen showing nothing but the artwork is there to be looked at, so it
// stays on while there is music. The system drops the lock when the tab is
// hidden, hence asking again when it becomes visible.
let wakeLock: WakeLockSentinel | null = null;
const visible = ref(!document.hidden);
const onVisibilityChange = () => {
  visible.value = !document.hidden;
};
const holdScreen = async (want: boolean) => {
  try {
    if (want && !wakeLock && "wakeLock" in navigator) {
      const lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
      });
      wakeLock = lock;
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
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
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  void holdScreen(false);
});
</script>

<style scoped>
.artwork-only {
  position: fixed;
  inset: 0;
  z-index: 10000;
  overflow: hidden;
  background: #0b0b0f;
  cursor: pointer;
  touch-action: manipulation;
}

/* The backdrop breathes: a slow swell of the container, and of the scrim over
   it. Transform and opacity only, so the blur is not recomputed every frame. */
.artwork-only__bg {
  position: absolute;
  inset: 0;
  animation: artwork-only-breathe 9s ease-in-out infinite;
  will-change: transform;
}

/* Oversized so the blur has pixels to sample at the edges instead of fading
   to transparent. */
.artwork-only__bg-img {
  position: absolute;
  inset: -15%;
  width: 130%;
  height: 130%;
  object-fit: cover;
  filter: blur(56px) saturate(1.7) brightness(0.68);
  transform: translateZ(0);
}

.artwork-only__scrim {
  position: absolute;
  inset: 0;
  background: rgba(11, 11, 15, 0.45);
  animation: artwork-only-swell 9s ease-in-out infinite;
}

/* A still backdrop says the music is too. */
.artwork-only--paused .artwork-only__bg,
.artwork-only--paused .artwork-only__scrim {
  animation-play-state: paused;
}

.artwork-only__stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

/* Old and new cover share the one cell while they cross-fade. */
.artwork-only__cover {
  grid-area: 1 / 1;
  width: min(90vw, 90dvh, 1000px);
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.artwork-only-xfade-enter-active,
.artwork-only-xfade-leave-active {
  transition: opacity 800ms ease;
}

.artwork-only-xfade-enter-from,
.artwork-only-xfade-leave-to {
  opacity: 0;
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

@media (prefers-reduced-motion: reduce) {
  .artwork-only__bg,
  .artwork-only__scrim {
    animation: none;
  }
}
</style>
