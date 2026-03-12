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
              upcoming: upcomingLyricIndex === index,
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
const upcomingLyricIndex = ref(-1);
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const lyricsContentRef = ref<HTMLElement | null>(null);
const lineRefs = new Map<number, HTMLElement>();
const isProgrammaticScroll = ref(false);
const userManuallyScrolled = ref(false);
let manualScrollTimer: ReturnType<typeof setTimeout> | null = null;

// Rolling window of recent inter-lyric gaps for scroll anticipation timing.
// Tracks the last N actual gap durations to derive a median "current tempo",
// which determines how far ahead to pre-scroll the next line into view.
const TEMPO_WINDOW_SIZE = 6;
const recentGaps = ref<number[]>([]);

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

// Record the gap between the last two lyrics into the rolling tempo window.
// Used to estimate current pacing for scroll anticipation.
const recordGap = (index: number) => {
  if (index <= 0) return;
  const gap =
    parsedLyrics.value[index].time - parsedLyrics.value[index - 1].time;
  // Ignore outlier gaps (instrumental breaks) — they'd skew the tempo estimate
  if (gap > 8) return;
  recentGaps.value.push(gap);
  if (recentGaps.value.length > TEMPO_WINDOW_SIZE) {
    recentGaps.value.shift();
  }
};

// Estimate scroll anticipation from rolling tempo.
// Returns seconds ahead to pre-scroll the next line into view.
// Uses the median of recent gaps so outliers don't cause jumps.
const getScrollAnticipation = (): number => {
  if (recentGaps.value.length < 2) return 0.4;
  const sorted = [...recentGaps.value].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  // Pre-scroll at 30% of the median gap, clamped to [0.15, 1.2]s
  return Math.min(1.2, Math.max(0.15, median * 0.3));
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

// Find the upcoming lyric that should be pre-scrolled into view.
// Uses rolling tempo anticipation so the next line is visible before it activates.
const findUpcomingLyricIndex = (positionMs: number): number => {
  const anticipation = getScrollAnticipation();
  const anticipatedMs = positionMs + Math.round(anticipation * 1000);

  let index = -1;
  for (let i = 0; i < parsedLyrics.value.length; i++) {
    const lineTimeMs = Math.round(parsedLyrics.value[i].time * 1000);
    if (lineTimeMs <= anticipatedMs) {
      index = i;
    } else {
      break;
    }
  }
  return index;
};

// Scroll to a lyric line using scoped ref instead of document.querySelector
const scrollToLyric = (index: number) => {
  const element = lineRefs.get(index);
  if (!element) return;

  isProgrammaticScroll.value = true;
  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  // Reset programmatic scroll flag after animation completes
  setTimeout(() => {
    isProgrammaticScroll.value = false;
  }, 400);
};

// Detect manual scrolling so we don't fight the user with auto-scroll.
// Uses isProgrammaticScroll to distinguish our scrollIntoView calls from
// user-initiated scrolls. After user scrolls, auto-scroll is paused for 8s.
const setupScrollListener = () => {
  const root = scrollAreaRef.value?.$el as HTMLElement | undefined;
  const scrollEl = root?.querySelector<HTMLElement>(
    "[data-slot=scroll-area-viewport]",
  );
  if (!scrollEl) return;

  scrollEl.addEventListener(
    "scroll",
    () => {
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
    upcomingLyricIndex.value = -1;
    recentGaps.value = [];
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

// Two-phase sync: highlight follows timestamps exactly, scroll anticipates.
// The active highlight only changes when the playback position crosses a
// lyric's exact timestamp (no look-ahead). Separately, we pre-scroll the
// upcoming line into view using a rolling tempo estimate so the reader
// sees the next line before it activates — like karaoke apps do.
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

    // Phase 1: Update highlight at exact timestamp (no look-ahead)
    const newActiveIndex = findActiveLyricIndex(positionMs);
    if (newActiveIndex !== activeLyricIndex.value && newActiveIndex >= 0) {
      recordGap(newActiveIndex);
      activeLyricIndex.value = newActiveIndex;
    }

    // Phase 2: Pre-scroll upcoming line into view using tempo-based anticipation
    const newUpcomingIndex = findUpcomingLyricIndex(positionMs);
    if (
      newUpcomingIndex !== upcomingLyricIndex.value &&
      newUpcomingIndex >= 0
    ) {
      upcomingLyricIndex.value = newUpcomingIndex;

      if (!userManuallyScrolled.value) {
        nextTick(() => scrollToLyric(newUpcomingIndex));
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

.lyrics-line.upcoming {
  opacity: 0.7;
  filter: blur(0);
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
