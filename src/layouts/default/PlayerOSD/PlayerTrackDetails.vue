<template>
  <!-- now playing media -->
  <v-list-item
    class="player-track-details"
    :class="{ 'player-track-details--compact': props.compact }"
    style="height: auto; margin: 0px; padding: 0px"
    lines="two"
  >
    <template #prepend>
      <div
        class="media-thumb player-media-thumb"
        :style="`cursor: pointer; height: ${outerThumbSizePx}px; width: ${outerThumbSizePx}px;`"
        @click.stop="openPlayer"
      >
        <!-- player.current_media has content loaded (will work for all sources)  -->
        <div
          v-if="
            store.activePlayer?.powered != false &&
            store.activePlayer?.current_media?.image_url
          "
          class="w-full h-full"
        >
          <v-img
            class="media-thumb"
            style="border-radius: 4px"
            :src="getMediaImageUrl(store.activePlayer.current_media.image_url)"
            :alt="$t('tooltip.artwork')"
          />
        </div>
        <!-- fallback: display player icon -->
        <div
          v-else
          class="icon-thumb"
          :style="`height: ${fallbackThumbSizePx}px; width: ${fallbackThumbSizePx}px;`"
        >
          <PlayerIcon
            :icon="store.activePlayer?.icon"
            :grouped="
              store.activePlayer?.type == PlayerType.PLAYER &&
              !!store.activePlayer?.group_members.length
            "
            :size="props.compact ? 22 : 32"
          />
        </div>
      </div>
    </template>

    <!-- title -->
    <template #title>
      <div
        :style="{
          cursor: 'pointer',
          color: primaryColor,
        }"
        class="d-flex align-center"
        @click.stop="openPlayer"
      >
        <!-- no player selected message -->
        <div v-if="!store.activePlayer">
          {{ $t("no_player") }}
        </div>
        <!-- player powered off: show the name so it's clear which player is off -->
        <div
          v-else-if="store.activePlayer.powered == false"
          class="ma-line-clamp-1"
        >
          {{ store.activePlayer.name }}
        </div>
        <!-- track title -->
        <div
          v-else-if="store.activePlayer.current_media?.title"
          class="ma-line-clamp-1"
          style="min-width: 0"
          @click.stop="onTitleClick"
        >
          <MarqueeText :sync="marqueeSync">
            {{ store.activePlayer.current_media.title }}
          </MarqueeText>
        </div>
        <!-- queue ended message: the queue is still there, it just finished -->
        <div v-else-if="queueEnded" class="ma-line-clamp-1">
          {{ $t("queue_ended") }}
        </div>
        <!-- queue empty message -->
        <div
          v-else-if="
            store.activePlayerQueue && store.activePlayerQueue.items == 0
          "
          class="ma-line-clamp-1"
        >
          {{ $t("queue_empty") }}
        </div>
        <!-- fallback: player name, so the title never renders blank -->
        <div v-else class="ma-line-clamp-1">
          {{ store.activePlayer.name }}
        </div>
      </div>
    </template>
    <!-- append chip(s): quality -->
    <template #append>
      <!-- format -->
      <div
        v-if="
          streamDetails?.audio_format.content_type &&
          !getBreakpointValue({ breakpoint: 'phone' }) &&
          showQualityDetailsBtn
        "
        class="pl-4"
      >
        <QualityDetailsBtn />
      </div>
    </template>
    <!-- subtitle: off state or artist(s) + album, led by the active source -->
    <template #subtitle>
      <div class="player-track-subtitle" :style="{ color: primaryColor }">
        <!-- the source the audio comes from, when the line beside it describes
             the track that source is streaming -->
        <NowPlayingSourceBadge class="player-track-source" />
        <!-- player powered off -->
        <div
          v-if="store.activePlayer?.powered == false"
          style="cursor: pointer"
          @click.stop="store.showPlayersMenu = true"
        >
          {{ $t("off") }}
        </div>
        <button
          v-else-if="currentChapter"
          type="button"
          class="player-track-chapter-button"
          @click.stop="store.showFullscreenPlayer = true"
        >
          <div class="ma-line-clamp-1">
            <MarqueeText :sync="marqueeSync">
              {{ currentChapter.chapter.name }}
            </MarqueeText>
          </div>
        </button>
        <div
          v-else-if="
            store.activePlayer?.current_media?.title &&
            (store.activePlayer?.current_media?.artist || albumSubtitle)
          "
          class="player-track-subtitle-text"
          style="cursor: pointer"
          @click.stop="store.showFullscreenPlayer = true"
        >
          <div class="ma-line-clamp-1">
            <MarqueeText :sync="marqueeSync">
              <!-- artists(s) + album -->
              <span
                v-if="
                  store.activePlayer?.current_media?.artist &&
                  albumSubtitle &&
                  !props.showOnlyArtist
                "
              >
                {{ store.activePlayer?.current_media?.artist }} •
                {{ albumSubtitle }}
              </span>
              <!-- artists(s) only -->
              <span v-else-if="store.activePlayer?.current_media?.artist">
                {{ store.activePlayer?.current_media?.artist }}
              </span>
              <!-- album only -->
              <span v-else-if="albumSubtitle">
                {{ albumSubtitle }}
              </span>
            </MarqueeText>
          </div>
        </div>
      </div>
    </template>
  </v-list-item>
  <PlayerFullscreen :color-palette="colorPalette" />
</template>

<script setup lang="ts">
import MarqueeText from "@/components/MarqueeText.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import { openCurrentTrackDetails } from "@/helpers/now_playing";
import { isQueueEnded } from "@/helpers/queue_position";
import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import { resolveCurrentChapter } from "@/helpers/chapters";
import { ImageColorPalette, getMediaImageUrl } from "@/helpers/utils";
import { MediaType, PlaybackState, PlayerType } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed, onUnmounted, ref, watch } from "vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { useNowPlayingSource } from "@/composables/nowPlayingSource";
import NowPlayingSourceBadge from "./NowPlayingSourceBadge.vue";
import PlayerFullscreen from "./PlayerFullscreen.vue";

const marqueeSync = new MarqueeTextSync();
const { getPreference } = useUserPreferences();
const showChapterProgress = getPreference("audiobook_chapter_progress", true);

const nowTick = ref(0);
let chapterTimer: ReturnType<typeof setInterval> | null = null;
const currentChapter = computed(() => {
  void nowTick.value;
  const media = store.activePlayer?.current_media;
  const queueItem = store.curQueueItem;
  if (
    !showChapterProgress.value ||
    media?.media_type !== MediaType.AUDIOBOOK ||
    (media.queue_item_id !== null &&
      media.queue_item_id !== queueItem?.queue_item_id)
  ) {
    return undefined;
  }
  return resolveCurrentChapter(
    queueItem?.media_item?.metadata?.chapters,
    resolveActiveElapsedTime(),
    media.duration,
  );
});

const chapterTimerNeeded = computed(
  () =>
    showChapterProgress.value &&
    store.activePlayer?.playback_state === PlaybackState.PLAYING &&
    !!currentChapter.value,
);

const updateChapterTimer = (needed: boolean) => {
  if (needed && chapterTimer === null) {
    chapterTimer = setInterval(() => {
      nowTick.value = Date.now();
    }, 1000);
  } else if (!needed && chapterTimer !== null) {
    clearInterval(chapterTimer);
    chapterTimer = null;
  }
};

watch(chapterTimerNeeded, updateChapterTimer, { immediate: true });

onUnmounted(() => updateChapterTimer(false));

const queueEnded = computed(() => isQueueEnded(store.activePlayerQueue));

const { albumSubtitle } = useNowPlayingSource();

// properties
interface Props {
  showOnlyArtist?: boolean;
  showQualityDetailsBtn?: boolean;
  colorPalette: ImageColorPalette;
  primaryColor?: string;
  /** Smaller artwork and a shallower row, for the floating mobile player. */
  compact?: boolean;
  /**
   * Send the track title to its detail page rather than to the full screen
   * player. The floating mobile bar leaves it off: the title is most of the
   * card there, and the card as a whole is what opens the player.
   */
  titleOpensDetails?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showOnlyArtist: false,
  showQualityDetailsBtn: true,
  primaryColor: "",
  compact: false,
  titleOpensDetails: false,
});

// computed properties
const streamDetails = computed(() => {
  return store.activePlayerQueue?.current_item?.streamdetails;
});

// size of the clickable artwork area; cover art fills this via its
// w-full h-full wrapper, so this is also the real artwork size
const outerThumbSizePx = computed(() => {
  if (props.compact) return 40;
  return getBreakpointValue({ breakpoint: "phone" }) ? 60 : 64;
});

// the icon fallback (no cover art) has its own fixed size, independent of
// the breakpoint-driven outer container
const fallbackThumbSizePx = computed(() => (props.compact ? 40 : 60));

function openPlayer() {
  if (!store.activePlayer || store.activePlayer.powered == false) {
    store.showPlayersMenu = true;
  } else {
    store.showFullscreenPlayer = true;
  }
}

function onTitleClick() {
  if (props.titleOpensDetails) {
    openCurrentTrackDetails();
    return;
  }
  openPlayer();
}
</script>

<style scoped>
.player-media-thumb {
  margin-right: 10px;
}

/* the source badge leads the line and keeps its width; the track metadata
   beside it is what gives way as the bar narrows */
.player-track-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.player-track-source {
  flex-shrink: 0;
  max-width: 50%;
}

.player-track-subtitle-text {
  min-width: 0;
}

/* the floating player keeps both text lines but drops below the two-line
   height Vuetify reserves, so the bar stays shallow */
.player-track-details.player-track-details--compact {
  min-height: 44px;
}

.player-track-chapter-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.player-track-content-type {
  height: 20px !important;
  padding: 5px !important;
  padding-right: 9px !important;
  padding-left: 9px !important;
  font-weight: 500;
  font-size: 10px !important;
  letter-spacing: 0.1em;
  border-radius: 2px;
  margin-right: 30px;
}

.icon-thumb {
  width: 60px;
  height: 60px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<style>
/* this fixes missing subtitle items on webkit*/
.player-track-details .v-list-item-subtitle {
  -webkit-line-clamp: unset !important;
  line-clamp: unset !important;
}
</style>
