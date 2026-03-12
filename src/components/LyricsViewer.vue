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
const userManuallyScrolled = ref(false);
let manualScrollTimer: ReturnType<typeof setTimeout> | null = null;

const setLineRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    lineRefs.set(index, el);
  } else {
    lineRefs.delete(index);
  }
};

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

const hasTimestamps = computed(() => {
  if (parsedLyrics.value.some((line) => line.time > 0)) {
    return true;
  }
  const syncedLyrics = getSyncedLyrics();
  const plainLyrics = getPlainLyrics();
  if (syncedLyrics && syncedLyrics.includes("[")) {
    return true;
  }
  if (plainLyrics && /\[\d+:\d+[.:]?\d*\]/.test(plainLyrics)) {
    return true;
  }
  return false;
});

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

// Simple linear look-ahead: 15% of gap to next lyric, clamped to [0.05, 1.0]s
const calculateLookAhead = (currentPosition: number): number => {
  let currentIndex = -1;
  let nextIndex = -1;

  for (let i = 0; i < parsedLyrics.value.length; i++) {
    if (parsedLyrics.value[i].time <= currentPosition) {
      currentIndex = i;
    } else {
      nextIndex = i;
      break;
    }
  }

  if (nextIndex === -1 || currentIndex === -1) {
    return 0.15;
  }

  const gap =
    parsedLyrics.value[nextIndex].time - parsedLyrics.value[currentIndex].time;
  return Math.min(1.0, Math.max(0.05, gap * 0.15));
};

// Find active lyric index based on current position
const findActiveLyricIndex = (position: number, lookAhead: number): number => {
  const adjustedPositionMs = Math.round((position + lookAhead) * 1000);

  let index = -1;
  for (let i = 0; i < parsedLyrics.value.length; i++) {
    const lineTimeMs = Math.round(parsedLyrics.value[i].time * 1000);
    if (lineTimeMs <= adjustedPositionMs) {
      index = i;
    } else {
      break;
    }
  }
  return index;
};

// Scroll to active lyric using scoped ref instead of document.querySelector
const scrollToActiveLyric = (index: number) => {
  const activeElement = lineRefs.get(index);
  if (!activeElement) return;

  isProgrammaticScroll.value = true;
  activeElement.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  // Reset programmatic scroll flag after animation completes
  setTimeout(() => {
    isProgrammaticScroll.value = false;
  }, 400);
};

// Setup scroll listener to detect manual scrolling
const setupScrollListener = () => {
  const root = scrollAreaRef.value?.$el as HTMLElement | undefined;
  const scrollEl = root?.querySelector<HTMLElement>(
    "[data-slot=scroll-area-viewport]",
  );
  if (!scrollEl) return;

  scrollEl.addEventListener(
    "scroll",
    () => {
      // Ignore scroll events triggered by our own scrollIntoView
      if (isProgrammaticScroll.value) return;

      userManuallyScrolled.value = true;

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

// Main sync watcher
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

    const lookAhead = calculateLookAhead(newPosition);
    const newIndex = findActiveLyricIndex(newPosition, lookAhead);

    if (newIndex !== activeLyricIndex.value && newIndex >= 0) {
      activeLyricIndex.value = newIndex;

      if (!userManuallyScrolled.value) {
        nextTick(() => scrollToActiveLyric(newIndex));
      }
    }
  },
);

onBeforeUnmount(() => {
  if (manualScrollTimer) {
    clearTimeout(manualScrollTimer);
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
