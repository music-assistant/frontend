<template>
  <div class="lyrics-container">
    <div v-if="loading || externalLoading" class="lyrics-loading">
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
    <!-- Synced lyrics: transform-based fixed anchor -->
    <div
      v-else-if="hasTimestamps"
      ref="syncedContainerRef"
      class="synced-container"
    >
      <div
        ref="syncedContentRef"
        class="synced-content"
        :style="{ transform: `translateY(${contentTranslateY}px)` }"
      >
        <div
          v-for="(line, index) in parsedLyrics"
          :key="index"
          :ref="(el) => setLineRef(el as HTMLElement | null, index)"
          :class="[
            'lyrics-line',
            {
              active: activeLyricIndex === index,
              'lyrics-line--hidden':
                activeLyricIndex >= 0
                  ? index < activeLyricIndex - 1 ||
                    index > activeLyricIndex + 2
                  : index > 2,
            },
          ]"
        >
          {{ line.text }}
        </div>
      </div>
    </div>
    <!-- Non-synced lyrics: simple scrollable list (hidden in karaoke mode) -->
    <ScrollArea
      v-else-if="!props.anticipation"
      ref="scrollAreaRef"
      class="h-full w-full static-lyrics"
    >
      <div class="lyrics-content">
        <div
          v-for="(line, index) in parsedLyrics"
          :key="index"
          class="lyrics-line active"
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
  anticipation?: number;
  externalLoading?: boolean;
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
  anticipation: 0,
  externalLoading: false,
});

// Core lyrics state
const parsedLyrics = ref<Array<{ time: number; text: string }>>([]);
const loading = ref(false);
const activeLyricIndex = ref(-1);
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const syncedContainerRef = ref<HTMLElement | null>(null);
const syncedContentRef = ref<HTMLElement | null>(null);
const lineRefs = new Map<number, HTMLElement>();

// Transform-based positioning: translateY applied to the content div
// so the active line always sits at the fixed anchor point.
const contentTranslateY = ref(0);

const setLineRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    lineRefs.set(index, el);
  } else {
    lineRefs.delete(index);
  }
};

// True when playback is before the first lyric timestamp — shows intro screen.
// When anticipation is set (karaoke mode), the intro screen is dismissed early
// so the singer can see the upcoming first line before they need to sing it.
const beforeFirstLyric = computed(() => {
  if (!hasTimestamps.value || !parsedLyrics.value.length) {
    return false;
  }
  const firstLyricTime = parsedLyrics.value[0].time;
  const currentPosition = props.position || 0;
  return (
    activeLyricIndex.value === -1 &&
    currentPosition < firstLyricTime - props.anticipation
  );
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

// How far ahead (in seconds) the highlight activates before the lyric timestamp.
// Matches the CSS transition duration so the transition is fully complete
// exactly when the lyric timestamp is reached.
const HIGHLIGHT_LEAD_SECONDS = 1.0;

// Find active lyric index based on current position.
// The highlight activates HIGHLIGHT_LEAD_SECONDS (= transition duration) early
// so the CSS transition is fully complete when the lyric timestamp is reached.
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

// Calculate the translateY needed to place a line at the anchor point
// (40% from top of the container).
const computeTranslateY = (index: number) => {
  const el = lineRefs.get(index);
  const container = syncedContainerRef.value;
  if (!el || !container) return;

  const containerHeight = container.clientHeight;
  const anchorY = containerHeight * 0.25;
  const lineTop = el.offsetTop;
  const lineHeight = el.offsetHeight;

  contentTranslateY.value = anchorY - lineTop - lineHeight / 2;
};

// Watch for lyrics data changes
watch(
  [() => props.mediaItem?.item_id, () => props.lyrics, () => props.lrcLyrics],
  () => {
    activeLyricIndex.value = -1;
    contentTranslateY.value = 0;
    lineRefs.clear();
    fetchLyrics();
  },
  { immediate: true },
);

// Main sync: update active index and reposition content.
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

    // Shift position forward by the highlight lead time so the CSS transition
    // finishes exactly when the lyric timestamp is reached.
    const highlightPositionMs = Math.round(
      (newPosition + HIGHLIGHT_LEAD_SECONDS) * 1000,
    );
    const newActiveIndex = findActiveLyricIndex(highlightPositionMs);

    if (newActiveIndex !== activeLyricIndex.value && newActiveIndex >= 0) {
      activeLyricIndex.value = newActiveIndex;
      nextTick(() => computeTranslateY(newActiveIndex));
    }
  },
);

onBeforeUnmount(() => {
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
  font-size: clamp(1.8rem, 3.5vw, 3.5rem);
  font-weight: bold;
  margin-bottom: 10px;
}

.artist-name {
  font-size: clamp(1.4rem, 2.5vw, 2.5rem);
  margin-bottom: 40px;
  opacity: 0.8;
}

.lyrics-coming-soon {
  font-size: clamp(1rem, 1.8vw, 1.8rem);
  opacity: 0.6;
  font-style: italic;
}

/* Synced lyrics: fixed anchor with transform-based positioning */
.synced-container {
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.synced-content {
  text-align: center;
  will-change: transform;
  transition: transform 1s ease;
}

/* Non-synced static lyrics */
.static-lyrics {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.lyrics-content {
  text-align: center;
  padding: 10px 0;
}

.lyrics-line {
  padding: 10px 4px;
  font-size: clamp(2rem, 4vw, 4rem);
  font-weight: bold;
  opacity: 0.35;
  margin: 8px 0;
  transform: scale(0.78);
  transform-origin: center center;
  will-change: transform, opacity;
  transition:
    opacity 1s ease,
    transform 1s ease;
}

.lyrics-line--hidden {
  opacity: 0 !important;
  transform: scale(0.78) !important;
}

.lyrics-line.active {
  opacity: 1;
  color: v-bind(textColor);
  transform: scale(1);
}
</style>
