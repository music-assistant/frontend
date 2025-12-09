<template>
  <div class="lyrics-container">
    <div v-if="loading" class="lyrics-loading">
      <v-progress-circular indeterminate :color="textColor" />
      <div>{{ $t("loading_lyrics") }}</div>
    </div>
    <div v-else-if="!lyrics.length" class="lyrics-empty">
      {{ $t("no_lyrics_available") }}
    </div>
    <div v-else-if="beforeFirstLyric && hasTimestamps" class="lyrics-intro">
      <div class="song-title">{{ props.mediaItem?.name }}</div>
      <div class="artist-name">{{ artistName }}</div>
      <div class="lyrics-coming-soon">{{ $t("lyrics_will_appear_soon") }}</div>
    </div>
    <div
      v-else
      ref="lyricsContainer"
      class="lyrics-scroll-container"
      :class="{ 'static-lyrics': !hasTimestamps }"
    >
      <div
        v-for="(line, index) in lyrics"
        :key="index"
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
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import {
  Track,
  MediaItemType,
  ContentType,
  Artist,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

interface Props {
  mediaItem?: MediaItemType;
  position?: number;
  duration?: number;
  streamDetails?: any;
  textColor?: string;
  debugMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  mediaItem: undefined,
  position: undefined,
  duration: undefined,
  streamDetails: undefined,
  textColor: "#FFFFFF",
  debugMode: false,
});

// Logger helper that respects debug mode
const logSync = (message: string, isVerbose = true) => {
  if (isVerbose && !props.debugMode) {
    return; // Skip verbose logs in non-debug mode
  }
  // Always use console.debug for verbose logs, console.log for important ones
  const logger = isVerbose ? console.debug : console.log;
  logger(`[lyricSynch] ${message}`);
};

// Core lyrics state
const lyrics = ref<Array<{ time: number; text: string }>>([]);
const loading = ref(false);
const activeLyricIndex = ref(-1);
const lyricsContainer = ref<HTMLElement | null>(null);
const userManuallyScrolled = ref(false);
const lyricsLookAhead = ref(0); // Dynamic look-ahead
const previousLyricTransitionTime = ref(0);

// Add this computed property to check if we're before the first lyric
const beforeFirstLyric = computed(() => {
  if (!hasTimestamps.value || !lyrics.value.length) {
    return false;
  }

  // Check if we're before the first lyric timestamp or if no lyric is active yet
  const firstLyricTime = lyrics.value[0].time;
  const currentPosition = props.position || 0;

  return activeLyricIndex.value === -1 && currentPosition < firstLyricTime;
});

// Replace the artistName computed property
const artistName = computed(() => {
  if (!props.mediaItem) return "";

  // Handle Track which has artists array
  if (
    "media_type" in props.mediaItem &&
    props.mediaItem.media_type === "track"
  ) {
    const track = props.mediaItem as Track;
    if (track.artists?.length) {
      // Use a more generic type approach - both ItemMapping and Artist have name property
      return track.artists.map((a) => a.name).join(", ");
    }
  }

  // If it's an artist, return its own name
  if (
    "media_type" in props.mediaItem &&
    props.mediaItem.media_type === "artist"
  ) {
    return props.mediaItem.name;
  }

  // Fall back to empty string if no artist found
  return "";
});

// Computed properties
const hasLyrics = computed(() => {
  const plainLyrics = props.mediaItem?.metadata?.lyrics;
  const syncedLyrics = props.mediaItem?.metadata?.lrc_lyrics;
  return (
    (!!plainLyrics && plainLyrics.trim().length > 0) ||
    (!!syncedLyrics && syncedLyrics.trim().length > 0)
  );
});

const hasTimestamps = computed(() => {
  // First check if we have parsed lyrics with timestamps
  if (lyrics.value.some((line) => line.time > 0)) {
    return true;
  }

  // If no parsed lyrics yet, check the raw data for LRC format patterns
  const syncedLyrics = props.mediaItem?.metadata?.lrc_lyrics;
  const plainLyrics = props.mediaItem?.metadata?.lyrics;

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

// Methods for lyrics handling
const parseLrcLine = (line: string) => {
  const match = line.match(/\[(\d+):(\d+)([.:]\d+)?\](.*)/);
  if (match) {
    const minutes = parseInt(match[1]);
    let seconds = parseInt(match[2]);
    let milliseconds = 0;

    // Handle milliseconds/hundredths part with more precision
    if (match[3]) {
      const decimalPart = match[3].replace(/[.:]/, ".");
      milliseconds = Math.round(parseFloat(decimalPart) * 1000);
    }

    // Calculate total time in milliseconds for precision
    const timeMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;

    // Store as seconds but with precise decimal
    const time = timeMs / 1000;

    return { time, text: match[4].trim() || " " };
  }
  return { time: 0, text: line.trim() || " " };
};

const fetchLyrics = () => {
  if (!props.mediaItem) {
    lyrics.value = [];
    return;
  }

  loading.value = true;
  try {
    const syncedLyrics = props.mediaItem.metadata?.lrc_lyrics || "";
    const plainLyrics = props.mediaItem.metadata?.lyrics || "";

    // Determine which lyrics to use - prefer lrc_lyrics but check both for LRC format
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
      // Plain text lyrics without timestamps
      lyricsToProcess = plainLyrics;
      isLrcFormat = false;
    }

    if (isLrcFormat) {
      // Process LRC formatted lyrics
      const lyricsLines = lyricsToProcess
        .split("\n")
        .filter((line) => line.trim());

      lyrics.value = lyricsLines
        .map((line) => parseLrcLine(line))
        .filter((line) => line.text.trim()) // Filter out empty text
        .sort((a, b) => a.time - b.time);

      logSync(`Loaded ${lyrics.value.length} synchronized lyrics lines`, false);
    } else if (lyricsToProcess) {
      // For plain text lyrics without timestamps
      const lyricsLines = lyricsToProcess
        .split("\n")
        .filter((line) => line.trim());

      lyrics.value = lyricsLines
        .map((line) => ({
          time: 0,
          text: line.trim(),
        }))
        .filter((line) => line.text);

      logSync(`Loaded ${lyrics.value.length} plain text lyrics lines`, false);
    } else {
      lyrics.value = [];
    }
  } catch (error) {
    logSync(`Error processing lyrics: ${error}`, false);
    lyrics.value = [];
  } finally {
    loading.value = false;
  }
};

// Function to calculate dynamic look-ahead based on upcoming lyrics pattern
const calculateDynamicLookAhead = (currentPosition: number) => {
  // Find current position in lyrics timeline
  const adjustedTime = currentPosition;

  // Basic state logging (verbose)
  logSync(`Calculating look-ahead at ${currentPosition.toFixed(3)}s`);

  // Find current and next lyric indices
  let currentIndex = -1;
  let nextIndex = -1;

  for (let i = 0; i < lyrics.value.length; i++) {
    if (lyrics.value[i].time <= adjustedTime) {
      currentIndex = i;
    } else {
      nextIndex = i;
      break;
    }
  }

  // Log the found indices (verbose)
  logSync(
    `Current lyric index: ${currentIndex}, Next lyric index: ${nextIndex}`,
  );

  // Handle special cases with more concise logging
  if (nextIndex === 0) {
    const firstLyricTime = lyrics.value[0].time;
    const timeUntilFirstLyric = firstLyricTime - adjustedTime;

    logSync(
      `Pre-lyrics intro: ${timeUntilFirstLyric.toFixed(2)}s until first lyric`,
    );

    if (timeUntilFirstLyric > 5) {
      logSync("Long intro - using fixed look-ahead: 0.3s");
      lyricsLookAhead.value = 0.3;
      return;
    } else if (timeUntilFirstLyric > 2) {
      const newLookAhead = Math.min(1.0, timeUntilFirstLyric * 0.15);
      logSync(
        `Medium intro - calculated look-ahead: ${newLookAhead.toFixed(2)}s`,
      );
      lyricsLookAhead.value = newLookAhead;
      return;
    }
    logSync("Short intro - using standard calculation");
  }

  // If we couldn't find next lyric, use a default look-ahead
  if (nextIndex === -1 || currentIndex === -1) {
    logSync("Cannot determine appropriate look-ahead, using default: 0.3s");
    lyricsLookAhead.value = 0.3;
    return;
  }

  // Calculate time until next lyric
  const currentLyricTime = lyrics.value[currentIndex].time;
  const nextLyricTime = lyrics.value[nextIndex].time;
  const gapToNextLyric = nextLyricTime - currentLyricTime;

  // Get previous look-ahead for smoother transitions
  const previousLookAhead = lyricsLookAhead.value;

  // Gap analysis (verbose)
  logSync(`Gap analysis:
    - Current lyric time: ${currentLyricTime.toFixed(3)}s
    - Next lyric time: ${nextLyricTime.toFixed(3)}s
    - Gap between lyrics: ${gapToNextLyric.toFixed(3)}s
    - Previous look-ahead: ${previousLookAhead.toFixed(3)}s`);

  // Calculate look-ahead percentage based on gap size
  let lookAheadPercentage;
  if (gapToNextLyric < 0.5) {
    lookAheadPercentage = 0.3; // Very rapid lyrics - 30%
    logSync(
      `Very rapid lyrics detected (${gapToNextLyric.toFixed(2)}s gap) - using 30% look-ahead`,
    );
  } else if (gapToNextLyric < 0.8) {
    lookAheadPercentage = 0.1;
    logSync(
      `Fast lyrics detected (${gapToNextLyric.toFixed(2)}s gap) - using 10% look-ahead`,
    );
  } else if (gapToNextLyric < 1.5) {
    lookAheadPercentage = 0.2;
    logSync(
      `Medium lyrics detected (${gapToNextLyric.toFixed(2)}s gap) - using 20% look-ahead`,
    );
  } else if (gapToNextLyric < 3) {
    lookAheadPercentage = 0.3;
    logSync(
      `Slower lyrics detected (${gapToNextLyric.toFixed(2)}s gap) - using 30% look-ahead`,
    );
  } else if (gapToNextLyric > 10) {
    lookAheadPercentage = 0.02; // Extremely slow - just 2%
    logSync(
      `Very slow lyrics detected (${gapToNextLyric.toFixed(2)}s gap) - using 2% look-ahead`,
    );
  } else {
    lookAheadPercentage = 0.4;
    logSync(
      `Slow lyrics detected (${gapToNextLyric.toFixed(2)}s gap) - using 40% look-ahead`,
    );
  }

  // Calculate target look-ahead
  const targetLookAhead = Math.min(1.5, gapToNextLyric * lookAheadPercentage);
  logSync(`Target look-ahead: ${targetLookAhead.toFixed(3)}s`);

  // Smooth transition to new look-ahead
  const difference = Math.abs(targetLookAhead - previousLookAhead);
  const adaptationRate = Math.min(0.8, 0.3 + difference * 0.5); // More difference = faster adaptation
  const newLookAhead =
    previousLookAhead * (1 - adaptationRate) + targetLookAhead * adaptationRate;
  logSync(
    `Smoothed look-ahead: ${newLookAhead.toFixed(3)}s (adaptation rate: ${(adaptationRate * 100).toFixed(0)}%)`,
  );

  // Only log significant look-ahead changes (non-verbose)
  if (Math.abs(newLookAhead - previousLookAhead) > 0.3) {
    logSync(
      `Look-ahead adjusted: ${previousLookAhead.toFixed(2)}s → ${newLookAhead.toFixed(2)}s`,
      false,
    );
  }

  // Update the look-ahead value
  lyricsLookAhead.value = newLookAhead;
};

// Function to check if synchronization should be skipped
const shouldSkipSync = (position?: number): boolean => {
  return (
    position === undefined ||
    !lyrics.value.length ||
    !hasTimestamps.value ||
    userManuallyScrolled.value
  );
};

// Function to find active lyric index based on current position
const findActiveLyricIndex = (position: number): number => {
  // Calculate the adjusted position with look-ahead
  const adjustedPositionMs = Math.round(
    (position + lyricsLookAhead.value) * 1000,
  );

  // Find the active lyric using millisecond precision
  let index = -1;
  for (let i = 0; i < lyrics.value.length; i++) {
    const lineTimeMs = Math.round(lyrics.value[i].time * 1000);
    if (lineTimeMs <= adjustedPositionMs) {
      index = i;
    } else {
      break;
    }
  }

  return index;
};

// Function to handle active lyric change
const handleActiveLyricChange = (newIndex: number, position: number) => {
  if (newIndex < 0 || newIndex === activeLyricIndex.value) return;

  // Log lyric activation
  logSync(`Lyric activated: "${lyrics.value[newIndex].text}"`);

  // Debug logging
  logSync(`Activating lyric at ${position.toFixed(2)}s (adjusted: ${(position + lyricsLookAhead.value).toFixed(2)}s):
    - Index: ${newIndex}
    - Lyric time: ${lyrics.value[newIndex].time.toFixed(2)}s`);

  logSync(`Transition details:
    - Raw position: ${position.toFixed(3)}s
    - Dynamic look-ahead: ${lyricsLookAhead.value.toFixed(3)}s
    - Adjusted position: ${(position + lyricsLookAhead.value).toFixed(3)}s`);

  // Timing analysis
  if (newIndex > 0) {
    logTimingAnalysis(newIndex, position);
  }

  // Store transition time for future analysis
  previousLyricTransitionTime.value = position;

  // Update state
  activeLyricIndex.value = newIndex;

  // Scroll to active lyric
  nextTick(() => scrollToActiveLyric());
};

// Function to analyze timing
const logTimingAnalysis = (index: number, position: number) => {
  const actualGap = position - previousLyricTransitionTime.value;
  const expectedGap = lyrics.value[index].time - lyrics.value[index - 1].time;

  logSync(`Timing analysis:
    - Expected gap: ${expectedGap.toFixed(3)}s
    - Actual gap: ${actualGap.toFixed(3)}s
    - Difference: ${(actualGap - expectedGap).toFixed(3)}s`);
};

// Function to scroll to active lyric
const scrollToActiveLyric = () => {
  const activeElement = document.querySelector(".lyrics-line.active");
  const container = lyricsContainer.value;

  if (activeElement && container) {
    activeElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
};

// Setup watchers
watch(
  () => props.mediaItem?.item_id,
  () => {
    fetchLyrics();
  },
  { immediate: true },
);

watch(
  () => props.position,
  (newPosition: number | undefined) => {
    // Skip synchronization if needed
    if (shouldSkipSync(newPosition)) return;

    // Safely handle the position with a default or unwrapped value
    const position = newPosition ?? 0;

    // Calculate dynamic look-ahead based on upcoming lyrics
    calculateDynamicLookAhead(position);

    // Find the active lyric index
    const newIndex = findActiveLyricIndex(position);

    // Handle lyric change if needed
    if (newIndex !== activeLyricIndex.value) {
      handleActiveLyricChange(newIndex, position);
    }
  },
);

// Setup scroll listener to detect manual scrolling
onMounted(() => {
  const container = lyricsContainer.value;
  if (container) {
    container.addEventListener(
      "scroll",
      () => {
        userManuallyScrolled.value = true;

        // Reset the flag after 8 seconds of no scrolling
        setTimeout(() => {
          userManuallyScrolled.value = false;
        }, 8000);
      },
      { passive: true },
    );
  }
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
  color: v-bind(textColor);
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

.lyrics-scroll-container {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: 40vh 0; /* This padding is for timestamped lyrics only */
  text-align: center;
}

.static-lyrics {
  padding: 10px 0 !important; /* Much less padding for static lyrics */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.lyrics-line {
  padding: 10px 4px;
  font-size: 1.1em;
  opacity: 0.5;
  transition: all 0.3s ease;
  margin: 8px 0;
  filter: blur(1px); /* Blur effect for inactive lyrics */
  text-shadow: 0 0 1px var(--text-color);
}

.lyrics-line.active {
  opacity: 1;
  font-size: 1.4em;
  font-weight: bold;
  color: v-bind(textColor);
  filter: blur(0); /* No blur effect for active lyric */
  text-shadow: none;
}
</style>
