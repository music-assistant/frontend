<template>
  <div class="lyrics-container">
    <div v-if="loading || externalLoading" class="lyrics-loading">
      <Spinner class="size-6" />
      <div>{{ $t("loading_lyrics") }}</div>
    </div>
    <div v-else-if="!displayLines.length" class="lyrics-empty">
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
        class="synced-content"
        :style="{
          transform: `translateY(${contentTranslateY}px)`,
          transition: contentTransitionEnabled ? undefined : 'none',
        }"
      >
        <div
          v-for="(line, index) in displayLines"
          :key="index"
          :ref="(el) => setLineRef(el as HTMLElement | null, index)"
          :class="[
            'lyrics-line',
            {
              active: activeLyricIndex === index,
              'lyrics-line--hidden':
                activeLyricIndex >= 0
                  ? index < activeLyricIndex - 1 || index > activeLyricIndex + 2
                  : index > 2,
            },
          ]"
        >
          <!-- Lyric text -->
          <template v-if="!line.isBreak">
            {{ line.text }}
          </template>
          <!-- Musical break notes -->
          <template v-else>
            <span
              v-for="n in NOTE_COUNT"
              :key="n"
              class="break-note"
              :class="{
                'break-note--filled':
                  activeLyricIndex === index && n <= filledNoteCount,
                'break-note--filling':
                  activeLyricIndex === index && n === filledNoteCount + 1,
              }"
              :style="
                activeLyricIndex === index && n === filledNoteCount + 1
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
          </template>
        </div>
      </div>
    </div>
    <!-- Non-synced lyrics: simple scrollable list (hidden in karaoke mode) -->
    <ScrollArea
      v-else-if="!props.anticipation"
      class="h-full w-full static-lyrics"
    >
      <div class="lyrics-content">
        <div
          v-for="(line, index) in displayLines"
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { parseLrcLine } from "@/helpers/lrcParser";
import { MediaItemType, StreamDetails, Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

interface DisplayLine {
  time: number;
  text: string;
  isBreak: boolean;
  breakEnd?: number;
}

interface Props {
  mediaItem?: MediaItemType;
  position?: number;
  streamDetails?: StreamDetails;
  textColor?: string;
  lyrics?: string | null;
  lrcLyrics?: string | null;
  anticipation?: number;
  externalLoading?: boolean;
  highlightAhead?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  mediaItem: undefined,
  position: undefined,
  streamDetails: undefined,
  textColor: "#FFFFFF",
  lyrics: undefined,
  lrcLyrics: undefined,
  anticipation: 0,
  externalLoading: false,
  highlightAhead: true,
});

// Core state
const displayLines = ref<DisplayLine[]>([]);
const loading = ref(false);
const activeLyricIndex = ref(-1);
const syncedContainerRef = ref<HTMLElement | null>(null);
const lineRefs = new Map<number, HTMLElement>();

// Transform-based positioning
const contentTranslateY = ref(0);
const contentTransitionEnabled = ref(false);

const setLineRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    lineRefs.set(index, el);
  } else {
    lineRefs.delete(index);
  }
};

const beforeFirstLyric = computed(() => {
  if (!hasTimestamps.value || !displayLines.value.length) {
    return false;
  }
  const firstTime = displayLines.value[0].time;
  if (firstTime < 2) return false;
  const currentPosition = props.position || 0;
  return currentPosition < firstTime - props.anticipation;
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

const getPlainLyrics = () => {
  return props.lyrics ?? props.mediaItem?.metadata?.lyrics ?? null;
};

const getSyncedLyrics = () => {
  return props.lrcLyrics ?? props.mediaItem?.metadata?.lrc_lyrics ?? null;
};

const hasTimestamps = computed(() => {
  if (displayLines.value.some((line) => line.time > 0)) {
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

// Constants
const INTRO_BREAK_LEAD = 5; // seconds before first lyric to insert intro break
const MIN_BREAK_DURATION = 5; // minimum gap (seconds) to show a musical break
const NOTE_COUNT = 7;

// Build the unified display array: lyric lines + break entries interleaved.
// Break entries are first-class items with their own timestamps. The DOM
// layout is completely stable — nothing is inserted or removed at runtime.
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
      const allParsed = lyricsToProcess
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => parseLrcLine(line))
        .sort((a, b) => a.time - b.time);

      // Collect break markers (empty timestamped lines)
      const breakMarkers = new Set<number>();
      for (const line of allParsed) {
        if (!line.text.trim() && line.time > 0) {
          breakMarkers.add(line.time);
        }
      }

      // Keep only content lines
      const contentLines = allParsed.filter((line) => line.text.trim());

      // Build the unified display array with breaks interleaved
      const lines: DisplayLine[] = [];

      // Intro break: if the first lyric starts late enough, add a
      // countdown break so the singer knows lyrics are coming.
      if (contentLines.length > 0) {
        const firstTime = contentLines[0].time;
        if (firstTime >= INTRO_BREAK_LEAD) {
          lines.push({
            time: firstTime - INTRO_BREAK_LEAD,
            text: "",
            isBreak: true,
            breakEnd: firstTime,
          });
        }
      }

      for (let i = 0; i < contentLines.length; i++) {
        // Add the lyric line
        lines.push({
          time: contentLines[i].time,
          text: contentLines[i].text,
          isBreak: false,
        });

        // Check for a break marker between this line and the next.
        // Use the marker's actual LRC timestamp as the break start so
        // the duration and activation align with the authored timing.
        if (i < contentLines.length - 1) {
          const gapStart = contentLines[i].time;
          const gapEnd = contentLines[i + 1].time;
          let markerTime: number | null = null;
          for (const t of breakMarkers) {
            if (t > gapStart && t < gapEnd) {
              markerTime = t;
              break;
            }
          }
          if (
            markerTime !== null &&
            gapEnd - markerTime >= MIN_BREAK_DURATION
          ) {
            lines.push({
              time: markerTime,
              text: "",
              isBreak: true,
              breakEnd: gapEnd,
            });
          }
        }
      }

      displayLines.value = lines;
    } else if (lyricsToProcess) {
      displayLines.value = lyricsToProcess
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => ({
          time: 0,
          text: line.trim(),
          isBreak: false,
        }))
        .filter((line) => line.text);
    } else {
      displayLines.value = [];
    }
  } catch (error) {
    console.error(`[LyricsViewer] Error processing lyrics: ${error}`);
    displayLines.value = [];
  } finally {
    loading.value = false;
  }
};

// Note fill progress: derived from the active line's break timing.
// When the active line is a break, fill notes proportionally across the
// break duration. Otherwise return fully filled (irrelevant — not rendered).
const noteProgressState = computed(() => {
  const idx = activeLyricIndex.value;
  if (idx < 0) return { filled: NOTE_COUNT, percent: 100 };
  const line = displayLines.value[idx];
  if (!line?.isBreak || !line.breakEnd) {
    return { filled: NOTE_COUNT, percent: 100 };
  }
  const pos = props.position || 0;
  const duration = line.breakEnd - highlightLeadTime.value - line.time;
  if (duration <= 0) return { filled: NOTE_COUNT, percent: 100 };
  const elapsed = Math.max(0, pos - line.time);
  const noteProgress = (elapsed / duration) * NOTE_COUNT;
  return {
    filled: Math.min(NOTE_COUNT, Math.floor(noteProgress)),
    percent: Math.round((noteProgress - Math.floor(noteProgress)) * 100),
  };
});
const filledNoteCount = computed(() => noteProgressState.value.filled);
const currentNoteFillPercent = computed(() => noteProgressState.value.percent);

const LINE_TRANSITION_DURATION = 0.5;
const transitionDuration = computed(() => `${LINE_TRANSITION_DURATION}s`);

// When highlightAhead is true, the transition finishes at the LRC timestamp.
// When false, the transition starts at the LRC timestamp.
const highlightLeadTime = computed(() =>
  props.highlightAhead ? LINE_TRANSITION_DURATION : 0,
);

const findActiveLineIndex = (positionMs: number): number => {
  let index = -1;
  for (let i = 0; i < displayLines.value.length; i++) {
    const lineTimeMs = Math.round(displayLines.value[i].time * 1000);
    if (lineTimeMs <= positionMs) {
      index = i;
    } else {
      break;
    }
  }
  return index;
};

const computeTranslateY = (index: number) => {
  const el = lineRefs.get(index);
  const container = syncedContainerRef.value;
  if (!el || !container) return;

  const containerHeight = container.clientHeight;
  const anchorY = containerHeight * (props.anticipation > 0 ? 0.5 : 0.35);
  const lineTop = el.offsetTop;
  const lineHeight = el.offsetHeight;

  contentTranslateY.value = anchorY - lineTop - lineHeight / 2;
};

// Watch for lyrics data changes
watch(
  [() => props.mediaItem?.item_id, () => props.lyrics, () => props.lrcLyrics],
  () => {
    activeLyricIndex.value = -1;
    contentTranslateY.value = 99999;
    contentTransitionEnabled.value = false;
    lineRefs.clear();
    fetchLyrics();
    nextTick(() => {
      const firstEl = lineRefs.get(0);
      const container = syncedContainerRef.value;
      if (firstEl && container) {
        contentTranslateY.value =
          container.clientHeight - firstEl.offsetTop + 40;
      }
    });
  },
  { immediate: true },
);

// Main sync: just find the active index and reposition.
watch(
  () => props.position,
  (newPosition: number | undefined) => {
    if (
      newPosition === undefined ||
      !displayLines.value.length ||
      !hasTimestamps.value
    ) {
      return;
    }

    // Shift position forward by the lead time so the CSS transition
    // is fully complete exactly when the line's timestamp arrives.
    const highlightPositionMs = Math.round(
      (newPosition + highlightLeadTime.value) * 1000,
    );
    const newActiveIndex = findActiveLineIndex(highlightPositionMs);

    if (newActiveIndex !== activeLyricIndex.value) {
      if (newActiveIndex >= 0) {
        contentTransitionEnabled.value = true;
        activeLyricIndex.value = newActiveIndex;
        nextTick(() => computeTranslateY(newActiveIndex));
      } else {
        // Rewound before the first lyric — scroll content back out of view
        activeLyricIndex.value = -1;
        contentTransitionEnabled.value = true;
        const firstEl = lineRefs.get(0);
        const container = syncedContainerRef.value;
        if (firstEl && container) {
          contentTranslateY.value =
            container.clientHeight - firstEl.offsetTop + 40;
        }
      }
    }
  },
);

// When the intro screen dismisses, slide content to the first line.
watch(beforeFirstLyric, (isBefore) => {
  if (!isBefore && displayLines.value.length) {
    contentTransitionEnabled.value = true;
    nextTick(() => computeTranslateY(0));
  }
});

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
  transition: transform v-bind(transitionDuration) ease;
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
  will-change: opacity;
  transition: opacity v-bind(transitionDuration) ease;
}

.lyrics-line.lyrics-line--hidden {
  opacity: 0;
}

.lyrics-line.active {
  opacity: 1;
  color: v-bind(textColor);
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

.break-note--filled,
.break-note--filling {
  opacity: 1;
}

.intro-fade-leave-active {
  transition: opacity v-bind(transitionDuration) ease;
}
.intro-fade-leave-to {
  opacity: 0;
}
</style>
