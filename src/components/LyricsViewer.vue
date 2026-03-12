<template>
  <div class="lyrics-container">
    <div v-if="loading || externalLoading" class="lyrics-loading">
      <Spinner class="size-6" />
      <div>{{ $t("loading_lyrics") }}</div>
    </div>
    <div v-else-if="!parsedLyrics.length" class="lyrics-empty">
      {{ $t("no_lyrics_available") }}
    </div>
    <!-- Synced lyrics: always mounted when timestamps exist so DOM is ready for transition -->
    <div
      v-else-if="hasTimestamps"
      ref="syncedContainerRef"
      class="synced-container"
    >
      <Transition name="intro-fade">
        <div v-if="beforeFirstLyric" class="lyrics-intro">
          <div class="song-title" :style="{ color: textColor }">
            {{ props.mediaItem?.name }}
          </div>
          <div class="artist-name">{{ artistName }}</div>
          <div class="lyrics-coming-soon">
            {{ $t("lyrics_will_appear_soon") }}
          </div>
        </div>
      </Transition>
      <div
        ref="syncedContentRef"
        class="synced-content"
        :style="{
          transform: `translateY(${contentTranslateY}px)`,
          transition: contentTransitionEnabled
            ? undefined
            : 'none',
        }"
      >
        <template
          v-for="(line, index) in parsedLyrics"
          :key="index"
        >
          <div
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
          <!-- Musical break notes inserted between lines, never replacing them -->
          <div
            v-if="musicalBreakLineIndex === index"
            :class="[
              'lyrics-line',
              {
                active: isInMusicalBreak,
                'lyrics-line--hidden':
                  activeLyricIndex >= 0 &&
                  (index < activeLyricIndex - 2 ||
                    index > activeLyricIndex + 1),
              },
            ]"
          >
            <span
              v-for="n in NOTE_COUNT"
              :key="n"
              class="break-note"
              :class="{
                'break-note--filled': n <= filledNoteCount,
                'break-note--filling': n === filledNoteCount + 1,
              }"
              :style="
                n === filledNoteCount + 1
                  ? {
                      backgroundImage: `linear-gradient(to right, ${textColor} ${currentNoteFillPercent}%, color-mix(in srgb, ${textColor} 35%, transparent) ${currentNoteFillPercent}%)`,
                      backgroundClip: 'text',
                      '-webkit-background-clip': 'text',
                      '-webkit-text-fill-color': 'transparent',
                    }
                  : undefined
              "
              >&#9835;</span
            >
          </div>
        </template>
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
const contentTransitionEnabled = ref(false);

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

// Musical break detection: show countdown notes during long instrumental gaps
const GAP_THRESHOLD = 10; // seconds — minimum gap to trigger break display
const BREAK_DELAY = 2; // seconds after line before showing notes
const NOTE_COUNT = 7;

const musicalBreakMap = computed(() => {
  const map = new Map<number, { gapStart: number; gapEnd: number }>();
  const lyrics = parsedLyrics.value;
  for (let i = 0; i < lyrics.length - 1; i++) {
    const gap = lyrics[i + 1].time - lyrics[i].time;
    if (gap > GAP_THRESHOLD) {
      map.set(i, {
        gapStart: lyrics[i].time + BREAK_DELAY,
        gapEnd: lyrics[i + 1].time,
      });
    }
  }
  return map;
});

const isInMusicalBreak = ref(false);
const musicalBreakLineIndex = ref(-1);

// Derive fill state as computed properties so the template always sees
// values consistent with the current break state — no stale refs possible.
const noteProgressState = computed(() => {
  if (!isInMusicalBreak.value || musicalBreakLineIndex.value < 0) {
    return { filled: NOTE_COUNT, percent: 100 };
  }
  const breakInfo = musicalBreakMap.value.get(musicalBreakLineIndex.value);
  if (!breakInfo) {
    return { filled: NOTE_COUNT, percent: 100 };
  }
  const pos = props.position || 0;
  const gapDuration = breakInfo.gapEnd - breakInfo.gapStart;
  const elapsed = Math.max(0, pos - breakInfo.gapStart);
  const noteProgress = (elapsed / gapDuration) * NOTE_COUNT;
  return {
    filled: Math.min(NOTE_COUNT, Math.floor(noteProgress)),
    percent: Math.round(
      (noteProgress - Math.floor(noteProgress)) * 100,
    ),
  };
});
const filledNoteCount = computed(() => noteProgressState.value.filled);
const currentNoteFillPercent = computed(() => noteProgressState.value.percent);

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
  const anchorY = containerHeight * 0.35;
  const lineTop = el.offsetTop;
  const lineHeight = el.offsetHeight;

  contentTranslateY.value = anchorY - lineTop - lineHeight / 2;
};

// Watch for lyrics data changes
watch(
  [() => props.mediaItem?.item_id, () => props.lyrics, () => props.lrcLyrics],
  () => {
    activeLyricIndex.value = -1;
    musicalBreakLineIndex.value = -1;
    isInMusicalBreak.value = false;
    contentTranslateY.value = 99999;
    contentTransitionEnabled.value = false;
    lineRefs.clear();
    fetchLyrics();
    // After DOM renders with new lyrics, position first line at bottom of container
    nextTick(() => {
      const container = syncedContainerRef.value;
      if (container && hasTimestamps.value) {
        contentTranslateY.value = container.clientHeight;
      }
    });
  },
  { immediate: true },
);

// Slide lyrics into view when the intro dismisses (handles anticipation mode
// where beforeFirstLyric goes false before activeLyricIndex becomes 0).
watch(beforeFirstLyric, (isBefore, wasBefore) => {
  if (wasBefore && !isBefore && !contentTransitionEnabled.value) {
    contentTransitionEnabled.value = true;
    nextTick(() => computeTranslateY(0));
  }
});

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
      contentTransitionEnabled.value = true;
      activeLyricIndex.value = newActiveIndex;
      nextTick(() => computeTranslateY(newActiveIndex));
    }

    // Update musical break state using raw position (not highlight-shifted).
    // musicalBreakLineIndex persists so notes remain as a "previous line"
    // after the next lyric activates. Fill state is derived via computed props.
    const breakInfo = musicalBreakMap.value.get(activeLyricIndex.value);
    if (
      breakInfo &&
      newPosition >= breakInfo.gapStart &&
      newPosition < breakInfo.gapEnd
    ) {
      isInMusicalBreak.value = true;
      musicalBreakLineIndex.value = activeLyricIndex.value;
    } else {
      isInMusicalBreak.value = false;
      // Clear the break line index only once it would be scrolled out of view
      if (
        musicalBreakLineIndex.value >= 0 &&
        activeLyricIndex.value > musicalBreakLineIndex.value + 1
      ) {
        musicalBreakLineIndex.value = -1;
      }
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
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.intro-fade-leave-active {
  transition: opacity 0.8s ease;
}

.intro-fade-leave-to {
  opacity: 0;
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

.lyrics-line.lyrics-line--hidden {
  opacity: 0;
  transform: scale(0.78);
}

.lyrics-line.active {
  opacity: 1;
  color: v-bind(textColor);
  transform: scale(1);
}

.break-note {
  display: inline-block;
  font-size: clamp(2rem, 4vw, 4rem);
  margin: 0 0.15em;
  color: v-bind(textColor);
  opacity: 0.35;
  background-image: none;
  -webkit-text-fill-color: initial;
}

.break-note--filled {
  opacity: 1;
}

.break-note--filling {
  opacity: 1;
}
</style>
