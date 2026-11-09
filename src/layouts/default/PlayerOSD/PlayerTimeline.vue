<template>
  <div class="w-auto" :class="hasWaveform ? 'h-8 md:h-10 lg:h-12' : 'h-6'">
    <div v-if="store.activePlayer">
      <SliderRoot
        v-model="wrappedCurTimeValue"
        data-slot="slider"
        class="relative flex items-center select-none touch-none w-full"
        :class="[
          hasWaveform ? 'h-11 md:h-12 lg:h-14' : 'h-8',
          hasWaveform && canSeek ? 'cursor-pointer' : '',
        ]"
        :disabled="!canSeek"
        :min="0"
        :max="timelineDuration"
        :step="0.1"
        thumb-alignment="overflow"
        @value-commit="stopDragging"
        @pointerdown="pointerFocus = true"
        @keydown="pointerFocus = false"
        @pointerenter="isThumbHidden = !canSeek"
        @pointermove="onTrackPointerMove"
        @pointerleave="
          isThumbHidden = true;
          hoverPercent = null;
        "
      >
        <TooltipProvider>
          <Tooltip :open="!!hoverLabel">
            <TooltipContent
              v-if="hoverLabel"
              side="top"
              :side-offset="HOVER_LABEL_OFFSET_PX"
              :collision-padding="8"
              :reference="hoverLabel.reference"
              class="pointer-events-none z-[100001] max-w-[320px] truncate text-nowrap"
              data-testid="timeline-hover-label"
            >
              <span class="opacity-70">{{ hoverLabel.time }}</span>
              <template v-if="hoverLabel.chapter">
                · {{ hoverLabel.chapter }}</template
              >
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <SliderTrack
          ref="trackRef"
          data-slot="slider-track"
          class="relative grow rounded-full"
          :class="hasWaveform ? 'h-8 md:h-10 lg:h-12' : 'h-1'"
        >
          <template v-if="!hasWaveform && chapterSegments.length">
            <div
              v-for="(segment, index) in chapterSegments"
              :key="segment.start"
              class="absolute inset-y-0 overflow-hidden transition-transform duration-100"
              :class="{
                'scale-y-[2]': segment === hoveredSegment,
                'rounded-l-full': index === 0,
                'rounded-r-full': index === chapterSegments.length - 1,
              }"
              :style="segmentStyle(segment)"
              data-testid="chapter-segment"
            >
              <div class="absolute inset-0" :style="trackBackgroundStyle"></div>
              <div
                class="absolute inset-y-0 left-0"
                :style="{
                  width: `${segmentFillPercent(segment)}%`,
                  backgroundColor: color,
                }"
              ></div>
            </div>
          </template>
          <div
            v-else-if="!hasWaveform"
            class="absolute inset-0 rounded-full"
            :style="trackBackgroundStyle"
          ></div>
          <WaveformTrack
            v-else
            :data="waveform!"
            :color="color"
            :progress-percent="progressPercent"
            :hover-percent="hoverPercent"
          />
          <!-- Tailwind's translate utilities emit the standalone `translate`
               property, which Android TV's Chrome ignores. Everything below
               centres via the track box or an explicit transform instead. -->
          <SliderRange
            v-if="!hasWaveform && !hidesRadioPosition"
            v-show="!chapterSegments.length"
            data-slot="slider-range"
            class="absolute inset-y-0 rounded-full"
            :style="{ 'background-color': color }"
          />
          <!-- the bookmark icon, so a bookmark does not read as a chapter tick -->
          <TooltipProvider :delay-duration="150">
            <Tooltip
              v-for="tick in bookmarkTicks"
              :key="`bookmark-${tick.start}`"
              @update:open="(open) => bookmarkTooltipToggled(tick.start, open)"
            >
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="absolute top-1/2 flex h-4 w-4 items-center justify-center"
                  :style="{
                    left: `${tick.percent}%`,
                    transform: 'translate(-50%, -50%)',
                  }"
                  :aria-label="`${tick.name}, ${tick.details}`"
                  :disabled="!canSeek"
                  data-testid="bookmark-tick"
                  @pointerdown.stop
                  @click.stop="bookmarkClicked(tick)"
                >
                  <Bookmark
                    :size="14"
                    :color="color"
                    class="fill-background"
                    aria-hidden="true"
                  />
                </button>
              </TooltipTrigger>
              <!-- above the full screen dialog -->
              <TooltipContent
                side="top"
                class="z-[100001] flex max-w-[260px] flex-col gap-0.5"
              >
                <span class="truncate font-medium">{{ tick.name }}</span>
                <span class="opacity-80 tabular-nums">{{ tick.details }}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SliderTrack>
        <!-- lets clicks through to the bookmarks below -->
        <SliderThumb
          data-slot="slider-thumb"
          :style="{ 'background-color': color }"
          :class="
            cn(
              'pointer-events-none w-2.5 h-2.5 rounded-full shadow-sm',
              pointerFocus && 'outline-none',
              !hasWaveform && (!isThumbHidden || isDragging)
                ? 'block'
                : 'hidden',
            )
          "
        />
      </SliderRoot>

      <div v-if="showLabels" class="time-text-row">
        <!-- current time detail -->
        <div
          class="text-caption time-text-left"
          @click="
            showRemainingTime
              ? (showRemainingTime = false)
              : (showRemainingTime = true)
          "
        >
          {{ playerCurTimeStr }}
        </div>

        <TooltipProvider v-if="chapterLabel" :delay-duration="400">
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="text-caption relative z-[1] -mb-2.5 min-w-0 self-start truncate px-3 pb-2.5 text-center hover:underline"
                :aria-label="chapterToggleLabel"
                data-testid="timeline-chapter-name"
                @click="toggleChapterProgress"
              >
                {{ chapterLabel }}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" class="z-[100001]">
              {{ chapterToggleLabel }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <!-- end time detail -->
        <div class="text-caption time-text-right">
          {{ playerTotalTimeStr }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import {
  MediaType,
  PlaybackState,
  type MediaItemBookmark,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { useActiveAudioSource } from "@/composables/activeAudioSource";
import { useActiveSource } from "@/composables/activeSource";
import {
  isChapteredMediaType,
  resolveCurrentChapter,
  computeChapterSegments,
  segmentAt,
  type ChapterSegment,
  type ResolvedChapter,
} from "@/helpers/chapters";
import { formatDuration } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { useUserPreferences } from "@/composables/userPreferences";
import { ref, computed, watch, toRef, onUnmounted } from "vue";
import {
  hasRadioSongTiming,
  resolveActiveElapsedTime,
  resolveQueueElapsedTime,
  resolveActiveTiming,
} from "@/helpers/activeElapsedTime";
import { Bookmark } from "@lucide/vue";
import { useElementSize } from "@vueuse/core";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui";
import { cn } from "@/lib/utils";
import WaveformTrack from "./WaveformTrack.vue";

// properties
export interface Props {
  showLabels?: boolean;
  color?: string;
  // Precomputed waveform bins (0.0-1.0); when set, replaces the flat track.
  waveform?: number[] | null;
  // Bookmarks of the copy that is playing, marked on the track.
  bookmarks?: MediaItemBookmark[];
}

const props = withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: "var(--foreground)",
  waveform: null,
  bookmarks: () => [],
});

const { activeSource } = useActiveSource(toRef(store, "activePlayer"));
const { activeAudioSource } = useActiveAudioSource(
  toRef(store, "activePlayer"),
);
const { getPreference, setPreference } = useUserPreferences();
const showChapterProgress = getPreference("audiobook_chapter_progress", true);

// local refs
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);
const isDragging = ref(false);
const curTimeValue = ref(0);
const tempTime = ref(0);
const dragChapter = ref<ResolvedChapter | null>(null);
const pendingSeek = ref<{ position: number; origin: number } | null>(null);
// ticking ref to force recompute of elapsed time (Date.now() is non-reactive)
// rAF drives smooth 60fps slider movement; a 1s interval keeps text
// labels up-to-date when the tab is backgrounded (rAF pauses).
const nowTick = ref(0);
let rafId: number | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let pendingSeekTimer: ReturnType<typeof setTimeout> | null = null;
const SEEK_CONFIRM_TOLERANCE_SECONDS = 1;
const SEEK_CONFIRM_TIMEOUT_MS = 5000;

// reka slider expects number[]
const wrappedCurTimeValue = computed<number[]>({
  get: () => [curTimeValue.value],
  set: (newValue: number[]) => {
    // reka emits update:modelValue on user interaction, drag or track click
    // a setter call means the user is seeking, must be marked as dragging to stop the playback
    // watcher from fighting the thumb, and stash the target for the commit seek
    if (!isDragging.value) dragChapter.value = currentChapter.value ?? null;
    isDragging.value = true;
    curTimeValue.value = newValue[0];
    tempTime.value = newValue[0];
  },
});

const startRaf = () => {
  if (rafId !== null) return;
  const tick = () => {
    const now = Date.now();
    if (now - nowTick.value >= 64) {
      nowTick.value = now;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
};

const stopRaf = () => {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
};

const startTick = () => {
  // The slider is scaled by the media duration, so without one (radio, or a
  // player that only reports a bare elapsed_time) it stays pinned and the time
  // label is the only thing that moves; the 1s interval alone keeps that fresh.
  // Reading the duration here also makes it a dependency of the computed that
  // drives the tick, so the rAF loop follows a duration arriving or going away.
  if (store.activePlayer?.current_media?.duration) startRaf();
  else stopRaf();

  if (fallbackTimer === null) {
    fallbackTimer = setInterval(() => (nowTick.value = Date.now()), 1000);
  }
};

const stopTick = () => {
  stopRaf();
  if (fallbackTimer !== null) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
};

onUnmounted(() => {
  stopTick();
  clearPendingSeek();
});

// computed properties
const canSeek = computed(() => {
  if (store.activePlayer?.powered === false) return false;
  const currentMediaDuration = store.activePlayer?.current_media?.duration;
  const currentMediaHasDuration = !!currentMediaDuration;

  // AudioSource queue items carry their own capability flags; defer to them
  // before falling back to the player's source-list source.
  if (activeAudioSource.value) {
    return activeAudioSource.value.can_seek && currentMediaHasDuration;
  }

  // Check if active source allows seeking
  if (activeSource.value) {
    // Disallow seeking for radio streams (or other duration-less streams)
    const isRadio =
      store.activePlayer?.current_media?.media_type == MediaType.RADIO ||
      store.activePlayer?.current_media?.duration == null;
    if (isRadio) return false;

    // If the active source reports can_seek, allow seeking when there is a
    // duration available.
    if (activeSource.value.can_seek && currentMediaHasDuration) return true;
  }
  return false;
});

const serverTiming = computed(() => resolveActiveTiming());

const absoluteElapsedTime = computed(() => {
  // include nowTick.value so this computed re-evaluates periodically while
  // mounted; the resolved position extrapolates from the current time, which is
  // not reactive by itself
  void nowTick.value;

  // Adaptive tick: the resolved position only advances on its own while the
  // source it came from is playing.
  if (serverTiming.value?.playbackState === PlaybackState.PLAYING) startTick();
  else stopTick();

  return resolveActiveElapsedTime() ?? 0;
});

const currentChapter = computed(() => {
  // Date.now() is non-reactive; re-evaluate chapter boundaries as playback advances.
  void nowTick.value;
  const media = store.activePlayer?.current_media;
  const queueItem = store.curQueueItem;
  if (
    !showChapterProgress.value ||
    !isChapteredMediaType(media?.media_type) ||
    (media.queue_item_id !== null &&
      media.queue_item_id !== queueItem?.queue_item_id)
  ) {
    return undefined;
  }
  const resolved = resolveCurrentChapter(
    queueItem?.media_item?.metadata?.chapters,
    pendingSeek.value?.position ??
      resolveQueueElapsedTime() ??
      absoluteElapsedTime.value,
    media.duration,
  );
  return resolved && Number.isFinite(resolved.duration) ? resolved : undefined;
});

// A radio stream resumes live, so a stopped one has no position to show.
const hidesRadioPosition = computed(
  () =>
    store.activePlayer?.current_media?.media_type == MediaType.RADIO &&
    serverTiming.value?.playbackState !== PlaybackState.PLAYING,
);

// Nothing reads the position behind the label, so the tick has to be released here.
watch(hidesRadioPosition, (hidden) => {
  if (hidden) stopTick();
});

const timelineDuration = computed(() => {
  if (hidesRadioPosition.value) return 0;
  // A radio stream's duration is its song's. Without the position in that song
  // the timeline only knows how long the station has played, which has no end.
  if (
    store.activePlayer?.current_media?.media_type == MediaType.RADIO &&
    !hasRadioSongTiming()
  ) {
    return 0;
  }
  return (
    currentChapter.value?.duration ??
    store.activePlayer?.current_media?.duration ??
    0
  );
});

const displayedAbsoluteTime = computed(() => {
  if (isDragging.value) return undefined;
  return pendingSeek.value?.position ?? absoluteElapsedTime.value;
});

const displayedTimelineTime = computed(() => {
  if (isDragging.value) return curTimeValue.value;
  if (hidesRadioPosition.value) return 0;
  const chapter = currentChapter.value;
  const absoluteTime = displayedAbsoluteTime.value ?? absoluteElapsedTime.value;
  // The position runs on until the source reports the next item, which for a
  // radio song can take a while; it never shows past the end.
  if (!chapter) {
    return timelineDuration.value
      ? Math.min(timelineDuration.value, absoluteTime)
      : absoluteTime;
  }
  return Math.max(0, Math.min(chapter.duration, absoluteTime - chapter.start));
});

const playerCurTimeStr = computed(() => {
  if (hidesRadioPosition.value) return $t("radio_live");
  if (showRemainingTime.value && timelineDuration.value) {
    return `-${formatDuration(timelineDuration.value - displayedTimelineTime.value)}`;
  }
  return formatDuration(displayedTimelineTime.value);
});

const playerTotalTimeStr = computed(() => {
  const duration = timelineDuration.value;
  // A stream of unknown duration (most radio) has no end to show
  if (!duration) return "";
  return formatDuration(duration);
});

const playingChapterName = computed(() => {
  if (hidesRadioPosition.value) return undefined;
  return resolveCurrentChapter(
    store.curQueueItem?.media_item?.metadata?.chapters,
    pendingSeek.value?.position ?? absoluteElapsedTime.value,
    store.activePlayer?.current_media?.duration,
  )?.chapter.name;
});

const chapterLabel = computed(() => {
  const chapter = currentChapter.value;
  if (!chapter) return playingChapterName.value;
  const starts = (store.curQueueItem?.media_item?.metadata?.chapters ?? [])
    .map((x) => x.start)
    .sort((a, b) => a - b);
  return $t("chapter_of", {
    current: starts.indexOf(chapter.start) + 1,
    total: starts.length,
  });
});
const chapterToggleLabel = computed(() => {
  if (!currentChapter.value) return $t("chapter_progress_show_chapter");
  return store.activePlayer?.current_media?.media_type ===
    MediaType.PODCAST_EPISODE
    ? $t("chapter_progress_show_episode")
    : $t("chapter_progress_show_audiobook");
});
const toggleChapterProgress = () =>
  setPreference("audiobook_chapter_progress", !showChapterProgress.value);

const displayedElapsedTime = computed(() => displayedTimelineTime.value);

const SEGMENT_GAP_PX = 2;
// tiny segments keep their full width instead of a gap
const MIN_SEGMENT_WITH_GAP_PX = 3;
const trackRef = ref<InstanceType<typeof SliderTrack>>();
const { width: trackWidth } = useElementSize(trackRef);

const segmentStyle = (segment: ChapterSegment) => {
  const roomy =
    (segment.widthPercent / 100) * trackWidth.value >= MIN_SEGMENT_WITH_GAP_PX;
  const half = roomy ? SEGMENT_GAP_PX / 2 : 0;
  return {
    left: `calc(${segment.startPercent}% + ${half}px)`,
    width: `calc(${segment.widthPercent}% - ${half * 2}px)`,
  };
};

const chapterSegments = computed(() => {
  if (currentChapter.value) return [];
  return computeChapterSegments(
    store.curQueueItem?.media_item?.metadata.chapters,
    store.activePlayer?.current_media?.duration,
  );
});

// With chapter progress the track spans the current chapter, so only its own
// bookmarks fit on it.
const bookmarkTicks = computed(() => {
  const chapter = currentChapter.value;
  const start = chapter?.start ?? 0;
  const duration =
    chapter?.duration ?? store.activePlayer?.current_media?.duration;
  if (!duration) return [];
  const chapters = store.curQueueItem?.media_item?.metadata.chapters;
  const mediaDuration = store.activePlayer?.current_media?.duration;
  return props.bookmarks
    .filter((x) => x.start >= start && x.start <= start + duration)
    .map((x) => ({
      ...x,
      percent: ((x.start - start) / duration) * 100,
      // e.g. "35:25 · Chapter 3", for the marker's tooltip
      details: [
        formatDuration(x.start - start),
        resolveCurrentChapter(chapters, x.start, mediaDuration)?.chapter.name,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
});

// Waveform bins cover the full audiobook, so they no longer line up with the
// slider when chapter-relative progress is enabled.
const hasWaveform = computed(
  () => !!props.waveform?.length && !currentChapter.value,
);
// Older Cast and Android TV runtimes need an opacity layer instead of color-mix().
const trackBackgroundStyle = computed(() => ({
  backgroundColor: props.color,
  opacity: 0.3,
}));

const progressPercent = computed(() => {
  if (!timelineDuration.value) return 0;
  return (curTimeValue.value / timelineDuration.value) * 100;
});

const segmentFillPercent = (segment: ChapterSegment) =>
  Math.min(
    100,
    Math.max(
      0,
      ((progressPercent.value - segment.startPercent) / segment.widthPercent) *
        100,
    ),
  );

// Hover position over a waveform or chapter segments, as 0-100 percent.
const hoverPercent = ref<number | null>(null);

// the focus ring is only for keyboard focus
const pointerFocus = ref(false);

const hoverPoint = ref<{ x: number; y: number }>();
const HOVER_LABEL_OFFSET_PX = 3;

const onTrackPointerMove = (evt: PointerEvent) => {
  if (!(hasWaveform.value || chapterSegments.value.length) || !canSeek.value)
    return;
  const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
  if (!rect.width) return;
  const x = Math.min(rect.right, Math.max(rect.left, evt.clientX));
  hoverPercent.value = ((x - rect.left) / rect.width) * 100;
  // a finger covers the point it drags, so the label stays over the middle
  const centered = evt.pointerType === "touch";
  hoverPoint.value = {
    x: centered ? rect.left + rect.width / 2 : x,
    y: rect.top + rect.height / 2,
  };
};

const hoveredSegment = computed(() => {
  if (hoverPercent.value === null || !chapterSegments.value.length)
    return undefined;
  const seconds = (hoverPercent.value / 100) * timelineDuration.value;
  return segmentAt(chapterSegments.value, seconds);
});

// keyed by start, as the next tooltip can open before the previous one closes
const openBookmarkTooltip = ref<number | null>(null);
const bookmarkTooltipToggled = (start: number, open: boolean) => {
  if (open) openBookmarkTooltip.value = start;
  else if (openBookmarkTooltip.value === start)
    openBookmarkTooltip.value = null;
};

const hoverLabel = computed(() => {
  const segment = hoveredSegment.value;
  const point = hoverPoint.value;
  if (
    !segment ||
    !point ||
    hoverPercent.value === null ||
    openBookmarkTooltip.value !== null
  )
    return undefined;
  const seconds = (hoverPercent.value / 100) * timelineDuration.value;
  return {
    reference: {
      getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0),
    },
    time: formatDuration(seconds),
    chapter: segment.chapter?.name,
  };
});

//watch
watch(serverTiming, (timing) => {
  const seek = pendingSeek.value;
  if (!seek || !timing) return;

  const difference = timing.elapsedTime - seek.position;
  const direction = Math.sign(seek.position - seek.origin);
  const reachedTarget =
    Math.abs(difference) <= SEEK_CONFIRM_TOLERANCE_SECONDS ||
    (direction > 0 && difference >= 0) ||
    (direction < 0 && difference <= 0);
  if (reachedTarget) {
    clearPendingSeek();
  }
});

// immediate, so a fresh mount adopts the position that is already playing or
// paused; a paused one never changes again to trigger the watcher
watch(
  displayedElapsedTime,
  (newTime) => {
    if (!isDragging.value) {
      curTimeValue.value = newTime;
    }
  },
  { immediate: true },
);

watch(
  () => store.curQueueItem?.queue_item_id,
  () => {
    clearPendingSeek();
    dragChapter.value = null;
    hoverPercent.value = null;
    openBookmarkTooltip.value = null;
  },
);

// methods
const stopDragging = () => {
  const chapter = dragChapter.value;
  const timelinePosition = Math.round(tempTime.value);
  const seekPosition = Math.round(
    chapter ? chapter.start + timelinePosition : timelinePosition,
  );
  setPendingSeek(seekPosition);
  curTimeValue.value = timelinePosition;
  isDragging.value = false;
  dragChapter.value = null;
  if (store.activePlayer) {
    api.playerCommandSeek(store.activePlayer.player_id, seekPosition);
  }
};

const bookmarkClicked = function (bookmark: MediaItemBookmark) {
  if (!canSeek.value || !store.activePlayer) return;
  api.playerCommandSeek(store.activePlayer.player_id, bookmark.start);
};

const setPendingSeek = (position: number) => {
  clearPendingSeek();
  pendingSeek.value = {
    position,
    origin: serverTiming.value?.elapsedTime ?? position,
  };
  pendingSeekTimer = setTimeout(clearPendingSeek, SEEK_CONFIRM_TIMEOUT_MS);
};

const clearPendingSeek = () => {
  pendingSeek.value = null;
  if (pendingSeekTimer !== null) {
    clearTimeout(pendingSeekTimer);
    pendingSeekTimer = null;
  }
};
</script>

<style scoped>
.time-text-left {
  text-align: left;
  display: table-cell;
}
.time-text-right {
  text-align: right;
  display: table-cell;
  right: 0;
}
.time-text-row {
  cursor: pointer;
  height: 8px;
  flex-basis: 0;
  flex-grow: 1;
  max-width: 100%;
  opacity: 0.6;
  display: flex;
  flex: 1 1 auto;
  margin-top: -6px;
  margin-bottom: 5px;
}
.time-text-left,
.time-text-right {
  flex: 1 0 0;
}
</style>
