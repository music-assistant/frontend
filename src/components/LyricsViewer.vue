<template>
  <div class="lyrics-container">
    <div v-if="loading" class="lyrics-loading">
      <Spinner class="size-6" />
      <div>{{ $t("loading_lyrics") }}</div>
    </div>
    <div v-else-if="!parsedLyrics.length" class="lyrics-empty">
      {{ $t("no_lyrics_available") }}
    </div>
    <div v-else-if="beforeFirstLyric && hasTimestamps" class="lyrics-intro">
      <div class="song-title" :style="{ color: textColor }">
        {{ props.mediaItem?.name }}
      </div>
      <div class="artist-name">{{ artistName }}</div>
      <div class="lyrics-coming-soon">{{ $t("lyrics_will_appear_soon") }}</div>
    </div>
    <ScrollArea
      v-else
      ref="scrollAreaRef"
      class="h-full w-full"
      :class="{ 'static-lyrics': !hasTimestamps }"
    >
      <div
        ref="lyricsContentRef"
        :class="['lyrics-content', { 'lyrics-content--synced': hasTimestamps }]"
      >
        <div
          v-for="(line, index) in parsedLyrics"
          :key="index"
          :ref="(el) => setLineRef(el as HTMLElement | null, index)"
          :class="[
            'lyrics-line',
            {
              active: activeLyricIndex === index || !hasTimestamps,
            },
          ]"
        >
          {{ line.text }}
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { Track, MediaItemType, StreamDetails } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  mediaItem?: MediaItemType;
  position?: number;
  duration?: number;
  streamDetails?: StreamDetails;
  textColor?: string;
  debugMode?: boolean;
  lyrics?: string | null;
  lrcLyrics?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  mediaItem: undefined,
  position: undefined,
  duration: undefined,
  streamDetails: undefined,
  textColor: "#FFFFFF",
  debugMode: false,
  lyrics: undefined,
  lrcLyrics: undefined,
});

// Core lyrics state
const parsedLyrics = ref<Array<{ time: number; text: string }>>([]);
const loading = ref(false);
const activeLyricIndex = ref(-1);
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const lyricsContentRef = ref<HTMLElement | null>(null);
const lineRefs = new Map<number, HTMLElement>();
const isProgrammaticScroll = ref(false);
let programmaticScrollCooldown: ReturnType<typeof setTimeout> | null = null;
const userManuallyScrolled = ref(false);
let manualScrollTimer: ReturnType<typeof setTimeout> | null = null;

// Continuous scroll state.
// Instead of discrete scrollIntoView jumps, we linearly interpolate scrollTop
// between the current and next lyric's centered positions. This creates a
// constant smooth scroll rate that lands the next line at center exactly
// when it highlights.
let scrollViewport: HTMLElement | null = null;
let scrollStartTop = 0;
let scrollEndTop = 0;
let scrollStartTime = 0;
let scrollDuration = 0;

const setLineRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    lineRefs.set(index, el);
  } else {
    lineRefs.delete(index);
  }
};

// True when playback is before the first lyric timestamp — shows intro screen
const beforeFirstLyric = computed(() => {
  if (!hasTimestamps.value || !parsedLyrics.value.length) {
    return false;
  }
  const firstLyricTime = parsedLyrics.value[0].time;
  const currentPosition = props.position || 0;
  return activeLyricIndex.value === -1 && currentPosition < firstLyricTime;
});

const artistName = computed(() => {
  if (!props.mediaItem) return "";
  if (
    "media_type" in props.mediaItem &&
    props.mediaItem.media_type === "track"
  ) {
    const track = props.mediaItem as Track;
    if (track.artists?.length) {
      return track.artists.map((a) => a.name).join(", ");
    }
  }
  if (
    "media_type" in props.mediaItem &&
    props.mediaItem.media_type === "artist"
  ) {
    return props.mediaItem.name;
  }
  return "";
});

// Helper to get lyrics - prefer props, fall back to metadata
const getPlainLyrics = () => {
  return props.lyrics ?? props.mediaItem?.metadata?.lyrics ?? null;
};

const getSyncedLyrics = () => {
  return props.lrcLyrics ?? props.mediaItem?.metadata?.lrc_lyrics ?? null;
};

const hasLyrics = computed(() => {
  const plainLyrics = getPlainLyrics();
  const syncedLyrics = getSyncedLyrics();
  return (
    (!!plainLyrics && plainLyrics.trim().length > 0) ||
    (!!syncedLyrics && syncedLyrics.trim().length > 0)
  );
});

// Check parsed lyrics first, then fall back to raw data for LRC format patterns
const hasTimestamps = computed(() => {
  if (parsedLyrics.value.some((line) => line.time > 0)) {
    return true;
  }
  const syncedLyrics = getSyncedLyrics();
  const plainLyrics = getPlainLyrics();
  // Check lrc_lyrics field
  if (syncedLyrics && syncedLyrics.includes("[")) {
    return true;
  }
  // Check regular lyrics field for LRC patterns like [00:29.79]
  if (plainLyrics && /\[\d+:\d+[.:]?\d*\]/.test(plainLyrics)) {
    return true;
  }
  return false;
});

// Parse a single LRC line like "[00:29.79] Some lyric text" into {time, text}
const parseLrcLine = (line: string) => {
  const match = line.match(/\[(\d+):(\d+)([.:]\d+)?\](.*)/);
  if (match) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    let milliseconds = 0;
    if (match[3]) {
      const decimalPart = match[3].replace(/[.:]/, ".");
      milliseconds = Math.round(parseFloat(decimalPart) * 1000);
    }
    const timeMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
    const time = timeMs / 1000;
    return { time, text: match[4].trim() || " " };
  }
  return { time: 0, text: line.trim() || " " };
};

// Determine which lyrics source to use and parse them.
// Priority: lrc_lyrics > plain lyrics with LRC patterns > plain text lyrics
const fetchLyrics = () => {
  loading.value = true;
  try {
    const syncedLyrics = getSyncedLyrics() || "";
    const plainLyrics = getPlainLyrics() || "";

    let lyricsToProcess = "";
    let isLrcFormat = false;

    if (syncedLyrics) {
      lyricsToProcess = syncedLyrics;
      isLrcFormat = true;
    } else if (plainLyrics && /\[\d+:\d+[.:]?\d*\]/.test(plainLyrics)) {
      // Plain lyrics field contains LRC format
      lyricsToProcess = plainLyrics;
      isLrcFormat = true;
    } else if (plainLyrics) {
      lyricsToProcess = plainLyrics;
      isLrcFormat = false;
    }

    if (isLrcFormat) {
      const lyricsLines = lyricsToProcess
        .split("\n")
        .filter((line) => line.trim());

      parsedLyrics.value = lyricsLines
        .map((line) => parseLrcLine(line))
        .filter((line) => line.text.trim())
        .sort((a, b) => a.time - b.time);
    } else if (lyricsToProcess) {
      const lyricsLines = lyricsToProcess
        .split("\n")
        .filter((line) => line.trim());

      parsedLyrics.value = lyricsLines
        .map((line) => ({
          time: 0,
          text: line.trim(),
        }))
        .filter((line) => line.text);
    } else {
      parsedLyrics.value = [];
    }
  } catch (error) {
    console.error(`[LyricsViewer] Error processing lyrics: ${error}`);
    parsedLyrics.value = [];
  } finally {
    loading.value = false;
  }
};

// Find active lyric index based on current position — no look-ahead.
// The highlight always matches the actual timestamp exactly.
const findActiveLyricIndex = (positionMs: number): number => {
  let index = -1;
  for (let i = 0; i < parsedLyrics.value.length; i++) {
    const lineTimeMs = Math.round(parsedLyrics.value[i].time * 1000);
    if (lineTimeMs <= positionMs) {
      index = i;
    } else {
      break;
    }
  }
  return index;
};

// Calculate the scrollTop value that centers a given lyric line in the viewport.
const getCenteredScrollTop = (index: number): number | null => {
  const el = lineRefs.get(index);
  if (!el || !scrollViewport) return null;
  const elTop = el.offsetTop;
  const elHeight = el.offsetHeight;
  const viewportHeight = scrollViewport.clientHeight;
  return elTop - viewportHeight / 2 + elHeight / 2;
};

// Begin a new scroll interpolation from the current position to center the
// target lyric, completing over the given duration in seconds.
const beginScrollTo = (targetIndex: number, durationSec: number) => {
  if (!scrollViewport) return;
  const targetTop = getCenteredScrollTop(targetIndex);
  if (targetTop === null) return;

  scrollStartTop = scrollViewport.scrollTop;
  scrollEndTop = targetTop;
  scrollStartTime = performance.now();
  // Minimum 300ms so very fast lyrics don't cause jarring snaps
  scrollDuration = Math.max(300, durationSec * 1000);
};

// Called on every position update (~60fps via rAF) to advance the scroll.
// Uses ease-out interpolation for a natural feel.
const tickScroll = () => {
  if (!scrollViewport || scrollDuration === 0) return;

  const elapsed = performance.now() - scrollStartTime;
  const t = Math.min(1, elapsed / scrollDuration);

  // Ease-out for a natural feel: fast start, gentle arrival at center
  const eased = 1 - (1 - t) * (1 - t);

  isProgrammaticScroll.value = true;
  scrollViewport.scrollTop =
    scrollStartTop + (scrollEndTop - scrollStartTop) * eased;

  if (t >= 1) {
    scrollDuration = 0;
    // Keep the flag true briefly so trailing momentum scroll events
    // on touch devices aren't misidentified as manual scrolls.
    if (programmaticScrollCooldown) clearTimeout(programmaticScrollCooldown);
    programmaticScrollCooldown = setTimeout(() => {
      isProgrammaticScroll.value = false;
      programmaticScrollCooldown = null;
    }, 100);
  }
};

// Detect manual scrolling so we don't fight the user with auto-scroll.
// Uses isProgrammaticScroll to distinguish our scroll writes from
// user-initiated scrolls. After user scrolls, auto-scroll is paused for 8s.
const setupScrollListener = () => {
  const root = scrollAreaRef.value?.$el as HTMLElement | undefined;
  scrollViewport =
    root?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]") ??
    null;
  if (!scrollViewport) return;

  scrollViewport.addEventListener(
    "scroll",
    () => {
      if (isProgrammaticScroll.value) return;

      userManuallyScrolled.value = true;
      // Stop any in-progress interpolation
      scrollDuration = 0;

      // Debounce: clear previous timer, start new 8s timer
      if (manualScrollTimer) {
        clearTimeout(manualScrollTimer);
      }
      manualScrollTimer = setTimeout(() => {
        userManuallyScrolled.value = false;
        manualScrollTimer = null;
      }, 8000);
    },
    { passive: true },
  );
};

// Watch for lyrics data changes
watch(
  [() => props.mediaItem?.item_id, () => props.lyrics, () => props.lrcLyrics],
  () => {
    activeLyricIndex.value = -1;
    scrollDuration = 0;
    lineRefs.clear();
    fetchLyrics();
  },
  { immediate: true },
);

// Watch for ScrollArea ref becoming available and attach scroll listener
watch(scrollAreaRef, (newRef) => {
  if (newRef) {
    nextTick(() => setupScrollListener());
  }
});

// Main sync: highlight follows timestamps exactly, scroll interpolates smoothly.
//
// On each ~60fps position update:
//   1. Check if the active lyric changed — if so, start a new scroll
//      interpolation toward the NEXT lyric's centered position, timed to
//      arrive exactly when that lyric will activate.
//   2. Advance the ongoing scroll interpolation by one frame (tickScroll).
//
// This creates a constant, smooth scroll that naturally lands each line
// at the center of the viewport right when it highlights.
watch(
  () => props.position,
  (newPosition: number | undefined) => {
    if (
      newPosition === undefined ||
      !parsedLyrics.value.length ||
      !hasTimestamps.value
    ) {
      return;
    }

    const positionMs = Math.round(newPosition * 1000);
    const newActiveIndex = findActiveLyricIndex(positionMs);

    // When the active lyric changes, begin scrolling toward the next one
    if (newActiveIndex !== activeLyricIndex.value && newActiveIndex >= 0) {
      activeLyricIndex.value = newActiveIndex;

      if (!userManuallyScrolled.value) {
        const nextIndex = newActiveIndex + 1;
        if (nextIndex < parsedLyrics.value.length) {
          // Time until the next lyric activates — scroll over this duration
          const timeUntilNext =
            parsedLyrics.value[nextIndex].time - newPosition;
          nextTick(() => beginScrollTo(nextIndex, timeUntilNext));
        }
      }
    }

    // Advance the scroll interpolation every frame
    if (!userManuallyScrolled.value) {
      tickScroll();
    }
  },
);

onBeforeUnmount(() => {
  if (manualScrollTimer) {
    clearTimeout(manualScrollTimer);
  }
  if (programmaticScrollCooldown) {
    clearTimeout(programmaticScrollCooldown);
  }
  lineRefs.clear();
});
</script>

<style scoped>
.lyrics-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.lyrics-loading,
.lyrics-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  gap: 20px;
}

.lyrics-intro {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.song-title {
  font-size: 2em;
  font-weight: bold;
  margin-bottom: 10px;
}

.artist-name {
  font-size: 1.5em;
  margin-bottom: 40px;
  opacity: 0.8;
}

.lyrics-coming-soon {
  font-size: 1.2em;
  opacity: 0.6;
  font-style: italic;
}

.lyrics-content {
  text-align: center;
  padding: 10px 0;
}

.lyrics-content--synced {
  padding: 40vh 0;
}

.static-lyrics {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.lyrics-line {
  padding: 10px 4px;
  font-size: 1.1em;
  opacity: 0.5;
  margin: 8px 0;
  filter: blur(1px);
  text-shadow: 0 0 1px var(--text-color);
}

.lyrics-line.active {
  opacity: 1;
  font-size: 1.4em;
  font-weight: bold;
  color: v-bind(textColor);
  filter: blur(0);
  text-shadow: none;
}
</style>
