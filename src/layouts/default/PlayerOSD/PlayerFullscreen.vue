<template>
  <v-dialog
    v-model="store.showFullscreenPlayer"
    fullscreen
    :scrim="false"
    transition="dialog-bottom-transition"
    z-index="9000"
    :retain-focus="false"
    persistent
    no-click-animation
  >
    <v-card
      class="fullscreen-player-card"
      :style="{ background: backgroundColor }"
    >
      <v-toolbar class="v-toolbar-default" color="transparent">
        <template #prepend>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('tooltip.close_fullscreen')"
            @click="store.showFullscreenPlayer = false"
          >
            <ChevronDownIcon class="size-5" />
          </Button>
        </template>
        <template #append>
          <PlayerFullscreenHeaderControls
            :lyrics-state="lyricsState"
            :lyrics-active="lyricsActive"
            @toggle-lyrics="toggleLyrics"
          />

          <Button
            variant="outline"
            size="icon-xs"
            class="ml-2 size-7 bg-background/40 backdrop-blur-md hover:bg-background/60"
            :aria-label="$t('tooltip.more_options')"
            @click.stop="openQueueMenu"
          >
            <EllipsisVerticalIcon :size="16" />
          </Button>
        </template>
      </v-toolbar>

      <!-- content -->
      <div class="main">
        <!-- left column: media thumb + details-->
        <div
          v-if="getBreakpointValue('bp7') || !showRightColumn"
          class="main-media-details"
        >
          <div
            v-if="$vuetify.display.height > 600"
            class="main-media-details-image"
          >
            <!-- current media image -->
            <v-img
              v-if="
                store.activePlayer?.powered != false &&
                store.activePlayer?.current_media?.image_url
              "
              :src="
                getMediaImageUrl(store.activePlayer.current_media.image_url)
              "
              :alt="$t('tooltip.artwork')"
            />
            <!-- fallback: display player icon in box -->
            <div v-else class="icon-thumb-large">
              <PlayerIcon
                :icon="store.activePlayer?.icon"
                :grouped="
                  store.activePlayer?.type == PlayerType.PLAYER &&
                  !!store.activePlayer?.group_members.length
                "
                :size="128"
              />
            </div>
          </div>
          <div class="main-media-details-track-info">
            <!-- player name as title if its powered off-->
            <v-card-title
              v-if="store.activePlayer?.powered == false"
              :style="`font-size: ${titleFontSize};font-weight:600;`"
            >
              {{ store.activePlayer?.name }}
            </v-card-title>
            <!-- current media title -->
            <v-card-title
              v-else-if="store.activePlayer?.current_media?.title"
              :style="`font-size: ${titleFontSize};font-weight:600;cursor:pointer;`"
              @click="onTitleClick"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer.current_media.title }}
              </MarqueeText>
            </v-card-title>
            <!-- no player selected message -->
            <v-card-title
              v-else
              :style="`font-size: ${titleFontSize};font-weight:600;cursor:pointer;`"
              @click="store.showPlayersMenu = true"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer?.name || $t("no_player") }}
              </MarqueeText>
            </v-card-title>

            <!-- SUBTITLE -->

            <!-- SUBTITLE: player powered off -->
            <v-card-subtitle
              v-if="store.activePlayer?.powered == false"
              class="text-h6 text-md-h5 text-lg-h4"
            >
              {{ $t("off") }}
            </v-card-subtitle>

            <!-- subtitle: album -->
            <v-card-subtitle
              v-else-if="
                store.activePlayer?.current_media?.album && showAlbumSubtitle
              "
              :style="`font-size: ${subTitleFontSize};cursor:pointer;`"
              @click="onAlbumClick"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer.current_media.album }}
              </MarqueeText>
            </v-card-subtitle>

            <!-- subtitle: artist -->
            <v-card-subtitle
              v-if="store.activePlayer?.current_media?.artist"
              :style="`font-size: ${subTitleFontSize};cursor:pointer;`"
              @click="onArtistClick"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer.current_media.artist }}
              </MarqueeText>
            </v-card-subtitle>

            <!-- subtitle: queue empty or other source active -->
            <!-- 3rd party source active -->
            <v-card-subtitle
              v-if="
                !store.activePlayerQueue && store.activePlayer?.active_source
              "
              class="caption"
            >
              {{
                $t("external_source_active", [
                  getSourceName(store.activePlayer),
                ])
              }}
            </v-card-subtitle>
            <v-card-subtitle
              v-else-if="
                store.activePlayerQueue && store.activePlayerQueue.items == 0
              "
              class="caption"
            >
              {{ $t("queue_empty") }}
            </v-card-subtitle>
          </div>
        </div>

        <!-- right column: queue items or lyrics-->
        <div
          v-if="showRightColumn && store.activePlayerQueue"
          class="main-queue-items"
        >
          <!-- Lyrics view -->
          <div v-if="showLyrics" class="lyrics-wrapper">
            <LyricsViewer
              :media-item="store.curQueueItem?.media_item"
              :position="lyricsElapsedTime"
              :stream-details="store.curQueueItem?.streamdetails"
              :text-color="sliderColor"
              :lyrics="currentLyrics.plain"
              :lrc-lyrics="currentLyrics.synced"
              :offset="lyricsOffset"
            />
          </div>
          <!-- Unified queue list: played → now playing → up next (virtualized) -->
          <div
            v-else
            ref="queueScrollRef"
            class="queue-items-scroll-box"
            :style="`--queue-title-size: ${queueTitleFontSize}; --queue-subtitle-size: ${queueSubtitleFontSize};`"
          >
            <!-- empty state -->
            <div v-if="!totalItems" class="queue-empty">
              {{ $t("queue_empty") }}
            </div>
            <!-- virtual spacer sized to the whole queue; only visible rows render -->
            <div
              v-else
              class="queue-virt"
              :class="{ 'queue-virt--dragging': isDragging }"
              :style="{ height: `${totalSize}px` }"
            >
              <div
                v-for="row in virtualRows"
                :key="row.index"
                :ref="measureRow"
                :data-index="row.index"
                class="queue-virt-row"
                :style="{
                  transform: `translateY(${row.vItem.start + rowOffset(row.index)}px)`,
                }"
              >
                <!-- section divider (Now playing / Up next) -->
                <div v-if="row.divider" class="queue-divider">
                  <span class="queue-divider__label">{{
                    $t(row.divider)
                  }}</span>
                  <span
                    v-if="row.divider === 'up_next' && upNextCount"
                    class="queue-divider__count"
                  >
                    {{ upNextCount }}
                  </span>
                  <span class="queue-divider__line"></span>
                </div>
                <!-- queue mode banner (radio mix / autoplay state) under Up next -->
                <QueueModeBanner v-if="row.divider === 'up_next'" />
                <!-- loaded item -->
                <QueueListItem
                  v-if="row.item"
                  :item="row.item"
                  :state="row.state"
                  :is-playing="playerActive"
                  :dragging="draggingIndex === row.index"
                  :marquee-sync="
                    row.state === 'playing'
                      ? playerMarqueeSync
                      : hoveredMarqueeSync
                  "
                  :request-badge-color="requestBadgeColor"
                  :boost-badge-color="boostBadgeColor"
                  @menu="(e: Event) => openQueueItemMenu(e, row.index)"
                  @dragstart="(e: PointerEvent) => startItemDrag(e, row.index)"
                />
                <!-- placeholder while the page loads -->
                <div v-else class="queue-skeleton">
                  <div class="queue-skeleton__thumb"></div>
                  <div class="queue-skeleton__lines">
                    <div class="queue-skeleton__line"></div>
                    <div
                      class="queue-skeleton__line queue-skeleton__line--sub"
                    ></div>
                  </div>
                </div>
                <!-- chapters for the current audiobook item -->
                <div
                  v-if="
                    row.state === 'playing' &&
                    row.item?.media_item?.metadata?.chapters?.length
                  "
                  class="queue-chapters"
                >
                  <button
                    v-for="chapter in row.item.media_item.metadata.chapters"
                    :key="chapter.position"
                    type="button"
                    class="queue-chapter"
                    @click.stop="chapterClicked(row.item.media_item, chapter)"
                  >
                    <span class="queue-chapter__name">{{ chapter.name }}</span>
                    <span v-if="chapter.end" class="queue-chapter__time">
                      {{ formatDuration(chapter.end - chapter.start) }}
                    </span>
                  </button>
                </div>
              </div>
              <!-- floating ghost of the dragged item; tracks the pointer -->
              <div
                v-if="isDragging && draggedItem"
                class="queue-ghost"
                :style="{ transform: `translateY(${ghostY}px)` }"
              >
                <QueueListItem
                  :item="draggedItem"
                  state="upcoming"
                  ghost
                  :request-badge-color="requestBadgeColor"
                  :boost-badge-color="boostBadgeColor"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- right column: media image (on small but wide screens)-->
        <div
          v-if="!showRightColumn && $vuetify.display.height <= 600"
          class="main-queue-items"
        >
          <div class="main-media-details-image main-media-details-image-alt">
            <v-img
              v-if="store.activePlayer?.current_media?.image_url"
              :src="
                getMediaImageUrl(store.activePlayer.current_media.image_url)
              "
              :alt="$t('tooltip.artwork')"
            />
            <!-- fallback: display player icon in box -->
            <div v-else class="icon-thumb-large">
              <PlayerIcon
                :icon="store.activePlayer?.icon"
                :grouped="
                  store.activePlayer?.type == PlayerType.PLAYER &&
                  !!store.activePlayer?.group_members.length
                "
                :size="128"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- player controls (always at bottom)-->
      <div class="player-bottom">
        <!-- timeline / progressbar-->
        <div class="row" style="margin-left: 5%; margin-right: 5%">
          <PlayerTimeline
            :show-labels="true"
            :color="sliderColor"
            :waveform="waveformData"
          />
        </div>

        <!-- main media control buttons (play, next, previous etc.)-->
        <div class="media-controls">
          <Icon
            :disabled="!store.curQueueItem?.media_item"
            :title="$t('tooltip.favorite')"
            variant="button"
            class="media-controls-item"
            max-height="30px"
            @click="onHeartBtnClick"
          >
            <Heart
              :size="18"
              :fill="currentItemFavorite ? 'currentColor' : 'none'"
            />
          </Icon>
          <ShuffleBtn
            v-if="$vuetify.display.mdAndUp"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="30px"
          />
          <PreviousBtn
            :player="store.activePlayer"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="45px"
            :size="28"
          />
          <div class="play-btn-wrapper" :style="playBtnStyle">
            <PlayBtn
              :player="store.activePlayer"
              :player-queue="store.activePlayerQueue"
              class="media-controls-item"
              :icon="{ staticWidth: '60px', staticHeight: '60px' }"
              :spinner-size="73"
              :size="30"
              :play-offset="2"
            />
          </div>
          <NextBtn
            :player="store.activePlayer"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="45px"
            :size="28"
          />
          <RepeatBtn
            v-if="$vuetify.display.mdAndUp"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="35px"
          />
          <div class="media-controls-item queue-btn-wrapper">
            <QueueBtn
              style="max-height: 30px; min-height: 0; min-width: 0"
              :size="18"
            />
          </div>
        </div>

        <!-- volume control -->
        <div
          v-if="store.activePlayer"
          class="row"
          style="margin-left: 5%; margin-right: 5%"
        >
          <PlayerVolume
            :player="store.activePlayer"
            width="100%"
            :color="sliderColor"
            :allow-wheel="true"
            :prefer-group-volume="true"
          />
        </div>

        <!-- player select button (compact, Spotify-style) -->
        <div
          v-if="showExpandedPlayerSelectButton"
          class="row"
          style="
            display: flex;
            justify-content: center;
            align-items: center;
            padding-bottom: 8px;
            padding-top: 4px;
          "
        >
          <Button
            variant="outline"
            size="xs"
            class="bg-background/40 backdrop-blur-md hover:bg-background/60"
            @click="
              () => {
                store.showPlayersMenu = true;
                store.showFullscreenPlayer = false;
              }
            "
          >
            <PlayerIcon
              :icon="store.activePlayer?.icon"
              :size="20"
              class="mr-1"
            />
            {{ store.activePlayer ? getPlayerName(store.activePlayer) : "" }}
          </Button>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import LyricsViewer from "@/components/LyricsViewer.vue";
import MarqueeText from "@/components/MarqueeText.vue";
import { Button } from "@/components/ui/button";
import { useLyricsElapsedTime } from "@/composables/useLyricsElapsedTime";
import { useLyricsOffset } from "@/composables/useLyricsOffset";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import PlayerIcon from "@/components/PlayerIcon.vue";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import {
  ImageColorPalette,
  formatDuration,
  getMediaImageUrl,
  getPlayerName,
} from "@/helpers/utils";
import NextBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/NextBtn.vue";
import PlayBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/PlayBtn.vue";
import PreviousBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/PreviousBtn.vue";
import RepeatBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue";
import ShuffleBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleBtn.vue";
import LyricsOffsetMenuControl from "@/layouts/default/PlayerOSD/LyricsOffsetMenuControl.vue";
import PlayerFullscreenHeaderControls from "@/layouts/default/PlayerOSD/PlayerFullscreenHeaderControls.vue";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import QueueListItem from "@/layouts/default/PlayerOSD/QueueListItem.vue";
import QueueModeBanner from "@/layouts/default/PlayerOSD/QueueModeBanner.vue";
import { useFullscreenQueue } from "@/layouts/default/PlayerOSD/useFullscreenQueue";
import { useUserPreferences } from "@/composables/userPreferences";
import api from "@/plugins/api";
import { getSourceName } from "@/plugins/api/helpers";
import {
  EventMessage,
  EventType,
  MediaItemType,
  MediaType,
  PlayerType,
  Track,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import vuetify from "@/plugins/vuetify";
import { ChevronDownIcon, EllipsisVerticalIcon, Heart } from "@lucide/vue";
import Color from "color";
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import { useDisplay } from "vuetify";
import { ContextMenuItem } from "../ItemContextMenu.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import PlayerTimeline from "./PlayerTimeline.vue";

const { name, mdAndUp } = useDisplay();

const MIN_HEIGHT_SHOW_FULL_DETAILS = 750;
// The player select button is important enough to keep pinned at the bottom in
// (almost) all cases. Only on very short screens is it hidden entirely — it is
// never moved up into the header.
const MIN_HEIGHT_SHOW_PLAYER_SELECT_BUTTON = 480;
const showAlbumSubtitle = computed(
  () => vuetify.display.height.value > MIN_HEIGHT_SHOW_FULL_DETAILS,
);

interface Props {
  colorPalette: ImageColorPalette;
}
const compProps = defineProps<Props>();

const playBtnStyle = computed(() => {
  const isDark = vuetify.theme.current.value.dark;
  const color = isDark
    ? compProps.colorPalette.darkColor
    : compProps.colorPalette.lightColor;
  if (!color) return {};
  return { "--play-icon-color": color };
});

const playerMarqueeSync = new MarqueeTextSync();

// Track the favorite state of the current queue item independently from
// media_item.favorite so optimistic updates survive server-side queue refreshes
// (which replace the whole current_item object and would reset the field).
const currentItemFavorite = ref(false);
watch(
  () => store.curQueueItem?.queue_item_id,
  () => {
    currentItemFavorite.value =
      store.curQueueItem?.media_item?.favorite ?? false;
  },
  { immediate: true },
);

const { elapsedTime: lyricsElapsedTime } = useLyricsElapsedTime();

// Local reactive state for lyrics
const currentLyrics = ref<{ plain: string | null; synced: string | null }>({
  plain: null,
  synced: null,
});

const hasLyrics = computed(() => {
  const plain = currentLyrics.value.plain;
  const synced = currentLyrics.value.synced;
  return (
    (!!plain && plain.trim().length > 0) ||
    (!!synced && synced.trim().length > 0)
  );
});

// True while we're fetching lyrics for the current track.
const lyricsLoading = ref(false);

// Drives the lyrics header button: whether lyrics can be shown, are loading,
// or are unavailable (and why).
const lyricsState = computed<
  "available" | "loading" | "unavailable-song" | "none"
>(() => {
  if (!store.curQueueItem) return "none";
  // Lyrics only make sense for tracks; hide the button entirely otherwise.
  if (store.curQueueItem.media_item?.media_type !== MediaType.TRACK)
    return "none";
  if (lyricsLoading.value) return "loading";
  if (hasLyrics.value) return "available";
  return "unavailable-song";
});

// Lyrics are reached through a dedicated button in the header and shown in
// their own panel, independent of the queue list (which has its own toggle).
const showLyrics = ref(false);
const lyricsActive = computed(() => showLyrics.value);

const toggleLyrics = () => {
  showLyrics.value = !showLyrics.value;
};

// If the panel was opened optimistically while lyrics were still loading but
// the track turns out to have none, close it again so we don't show an empty
// panel.
watch(lyricsState, (state) => {
  if (showLyrics.value && (state === "unavailable-song" || state === "none")) {
    showLyrics.value = false;
  }
});

// The right column shows either the queue or the lyrics, never both (lyrics
// render on top of the queue's slot). Keep the two toggles mutually exclusive
// so each button visibly swaps the panel instead of silently flipping a hidden
// state. Opening lyrics remembers whether the queue was showing so closing them
// returns there rather than to the bare artwork.
let queueVisibleBeforeLyrics = false;
watch(showLyrics, (active) => {
  if (active) {
    queueVisibleBeforeLyrics = store.showQueueItems;
    store.showQueueItems = false;
  } else if (queueVisibleBeforeLyrics) {
    store.showQueueItems = true;
    queueVisibleBeforeLyrics = false;
  }
});
watch(
  () => store.showQueueItems,
  (active) => {
    if (active) showLyrics.value = false;
  },
);

// Whether the right-hand column (queue list or lyrics) is visible. Used to
// collapse the media details column on small/narrow screens.
const showRightColumn = computed(
  () => store.showQueueItems || showLyrics.value,
);

// The unified queue list (virtualized rows, paging, now-playing focus, per-item
// menu and chapters) lives in its own composable to keep this component lean.
const {
  queueScrollRef,
  virtualRows,
  totalItems,
  upNextCount,
  totalSize,
  measureRow,
  playerActive,
  hoveredMarqueeSync,
  requestBadgeColor,
  boostBadgeColor,
  queueTitleFontSize,
  queueSubtitleFontSize,
  openQueueItemMenu,
  chapterClicked,
  startItemDrag,
  draggingIndex,
  isDragging,
  draggedItem,
  ghostY,
  rowOffset,
} = useFullscreenQueue(showLyrics);

// Protocols with accurate playback time reporting don't need a latency offset.
const ACCURATE_TIME_PROTOCOLS = ["airplay"];

const showLyricsOffset = computed(() => {
  const player = store.activePlayer;
  if (!player) return false;
  let domain: string | undefined;
  if (
    player.active_output_protocol &&
    player.active_output_protocol !== "native"
  ) {
    domain =
      player.output_protocols?.find(
        (p) => p.output_protocol_id === player.active_output_protocol,
      )?.protocol_domain ?? undefined;
  }
  if (!domain) {
    domain = player.provider.split("--")[0];
  }
  return !ACCURATE_TIME_PROTOCOLS.includes(domain);
});

// Shared lyrics sync offset; adjusted from the overflow menu while lyrics are
// open (see openQueueMenu) and fed to the lyrics viewer.
const { offset: lyricsOffset } = useLyricsOffset();

// Fetch lyrics for the current track (only when fullscreen player is open)
let lyricsLoadGeneration = 0;
const fetchLyrics = async () => {
  const generation = ++lyricsLoadGeneration;
  // Clear lyrics immediately
  currentLyrics.value = { plain: null, synced: null };

  const mediaItem = store.curQueueItem?.media_item;
  const isTrack = mediaItem?.media_type === MediaType.TRACK;

  // Show the loading state right away for tracks so the header button doesn't
  // flash "unavailable" before we've looked the lyrics up.
  lyricsLoading.value = isTrack === true && store.showFullscreenPlayer;

  // Only fetch lyrics when fullscreen player is open and the item is a track.
  if (!store.showFullscreenPlayer || !isTrack) {
    lyricsLoading.value = false;
    return;
  }

  const track = mediaItem as Track;

  // Check if lyrics are already in metadata
  const existingPlain = track.metadata?.lyrics?.trim() || null;
  const existingSynced = track.metadata?.lrc_lyrics?.trim() || null;

  if (existingPlain || existingSynced) {
    currentLyrics.value = { plain: existingPlain, synced: existingSynced };
    lyricsLoading.value = false;
    return;
  }

  // Fetch lyrics from API
  try {
    const [lyrics, lrcLyrics] = await api.getTrackLyrics(track);
    // a newer track change started while awaiting; this result is stale
    if (generation !== lyricsLoadGeneration) return;
    currentLyrics.value = { plain: lyrics, synced: lrcLyrics };

    // Also update the media item's metadata for future reference
    if (lyrics || lrcLyrics) {
      track.metadata = {
        ...track.metadata,
        ...(lyrics && { lyrics }),
        ...(lrcLyrics && { lrc_lyrics: lrcLyrics }),
      };
    }
  } catch (error) {
    if (generation !== lyricsLoadGeneration) return;
    console.error("Failed to fetch track lyrics:", error);
  } finally {
    if (generation === lyricsLoadGeneration) lyricsLoading.value = false;
  }
};

// Watch for track changes and handle lyrics
watch(() => store.curQueueItem?.media_item?.item_id, fetchLyrics, {
  immediate: true,
});

// Also fetch lyrics when fullscreen player is opened
watch(
  () => store.showFullscreenPlayer,
  (isOpen) => {
    if (isOpen) {
      fetchLyrics();
    }
  },
);

// Waveform for the current track, rendered by PlayerTimeline instead of the flat bar.
const waveformData = ref<number[] | null>(null);
const showWaveformPref = useUserPreferences().getPreference(
  "show_waveform",
  true,
);
let waveformLoadGeneration = 0;
const fetchWaveform = async () => {
  const generation = ++waveformLoadGeneration;
  waveformData.value = null;

  const mediaItem = store.curQueueItem?.media_item;
  // Analysis is keyed by the provider-native (streaming) item id, not the library id.
  const streamDetails = store.curQueueItem?.streamdetails;
  if (
    !showWaveformPref.value ||
    !store.showFullscreenPlayer ||
    mediaItem?.media_type !== MediaType.TRACK ||
    !streamDetails
  ) {
    return;
  }

  try {
    const waveform = await api.getWaveForm(
      streamDetails.item_id,
      streamDetails.provider,
    );
    // a newer track change started while awaiting; this result is stale
    if (generation !== waveformLoadGeneration) return;
    waveformData.value = waveform?.length ? waveform : null;
  } catch {
    // No analysis available; PlayerTimeline falls back to the flat progress bar.
    if (generation !== waveformLoadGeneration) return;
    waveformData.value = null;
  }
};

// Streamdetails can arrive after the queue item switches, so watch both ids.
watch(
  () => [
    store.curQueueItem?.queue_item_id,
    store.curQueueItem?.streamdetails?.item_id,
  ],
  fetchWaveform,
  { immediate: true },
);

// FrontendConfig reloads the app on save, but react to live changes anyway (multi-tab sync).
watch(showWaveformPref, fetchWaveform);

watch(
  () => store.showFullscreenPlayer,
  (isOpen) => {
    if (isOpen) fetchWaveform();
  },
);

const titleFontSize = computed(() => {
  switch (name.value) {
    case "xs":
      return "1.3em";
    case "sm":
      return "1.6em";
    case "md":
      return "1.8em";
    case "lg":
      return store.showQueueItems ? "1.7em" : "2.1em";
    case "xl":
      return store.showQueueItems ? "1.8em" : "2.3em";
    case "xxl":
      return store.showQueueItems ? "1.9em" : "2.5em";
    default:
      return "1.0em";
  }
});

const subTitleFontSize = computed(() => {
  // Anchor album/artist size to the track title using the EditorialMediaCard
  // tile ratio (subtitle 12px / title 14px).
  return `${(parseFloat(titleFontSize.value) * (12 / 14)).toFixed(3)}em`;
});

const showExpandedPlayerSelectButton = computed(() => {
  // Always show the player select button at the bottom; only hide it on very
  // short screens (never relocate it to the header).
  return vuetify.display.height.value > MIN_HEIGHT_SHOW_PLAYER_SELECT_BUTTON;
});

// methods

// Helper to parse a Music Assistant URI
// Supports both formats:
// - MA style: <provider>://<mediaType>/<itemId>
// - Spotify style: <provider>:<mediaType>:<itemId>
const parseUri = function (uri: string | undefined) {
  if (!uri) return null;

  // Valid media types
  const validTypes = [
    MediaType.ALBUM,
    MediaType.ARTIST,
    MediaType.TRACK,
    MediaType.PLAYLIST,
    MediaType.RADIO,
    MediaType.PODCAST,
    MediaType.AUDIOBOOK,
    MediaType.PODCAST_EPISODE,
  ];

  // Try MA style: provider://mediaType/itemId
  let match = uri.match(/^([^:]+):\/\/([^/]+)\/(.+)$/);
  if (match) {
    const [, provider, mediaType, itemId] = match;
    if (validTypes.includes(mediaType as MediaType)) {
      return { provider, mediaType: mediaType as MediaType, itemId };
    }
  }

  // Try Spotify style: provider:mediaType:itemId
  match = uri.match(/^([^:]+):([^:]+):(.+)$/);
  if (match) {
    const [, provider, mediaType, itemId] = match;
    if (validTypes.includes(mediaType as MediaType)) {
      return { provider, mediaType: mediaType as MediaType, itemId };
    }
  }

  return null;
};

const navigateOrSearch = function (searchTerm: string, uri?: string) {
  const parsed = parseUri(uri);
  if (parsed && api.getProvider(parsed.provider)) {
    // Valid URI - navigate to item details
    store.showFullscreenPlayer = false;
    router.push({
      name: parsed.mediaType,
      params: {
        itemId: parsed.itemId,
        provider: parsed.provider,
      },
    });
  } else {
    // No valid URI - open global search
    store.globalSearchTerm = searchTerm;
    router.push({ name: "search" });
    store.showFullscreenPlayer = false;
  }
};

const onTitleClick = async function () {
  const currentMedia = store.activePlayer?.current_media;
  if (!currentMedia) return;

  // Try to get the track from the full media item (for library items)
  const mediaItem = store.curQueueItem?.media_item;

  if (mediaItem && mediaItem.media_type === MediaType.TRACK) {
    // Navigate directly to track detail page
    store.showFullscreenPlayer = false;
    router.push({
      name: "track",
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
      },
    });
  } else {
    // Radio or non-library item - try to find in library first
    const searchTerm = currentMedia.artist
      ? `${currentMedia.artist} - ${currentMedia.title}`
      : currentMedia.title || "";

    try {
      // Call with positional parameters: (favorite, search, limit, offset, order_by, provider)
      const results = await api.getLibraryTracks(
        undefined, // favorite
        searchTerm, // search
        5, // limit - get a few results to find best match
        undefined,
        undefined,
        undefined,
        undefined, // genre_ids
      );

      if (results.length > 0) {
        // Try to find best match by comparing artist and title
        let bestMatch = results[0];

        if (currentMedia.artist && currentMedia.title) {
          const exactMatch = results.find(
            (track) =>
              track.name.toLowerCase() === currentMedia.title!.toLowerCase() &&
              track.artists?.some(
                (artist) =>
                  artist.name.toLowerCase() ===
                  currentMedia.artist!.toLowerCase(),
              ),
          );
          if (exactMatch) {
            bestMatch = exactMatch;
          }
        }

        // Found in library! Navigate to it
        store.showFullscreenPlayer = false;
        router.push({
          name: "track",
          params: {
            itemId: bestMatch.item_id,
            provider: bestMatch.provider,
          },
        });
        return;
      }
    } catch (error) {
      console.error("Error searching library for track:", error);
    }

    // Not found in library - fall back to global search
    store.globalSearchTerm = searchTerm;
    router.push({ name: "search" });
    store.showFullscreenPlayer = false;
  }
};

const onAlbumClick = async function () {
  const currentMedia = store.activePlayer?.current_media;
  if (!currentMedia?.album) return;

  // Try to get the album from the full media item (for library items)
  const mediaItem = store.curQueueItem?.media_item;

  // Check if "album" is actually the radio station name - if so, do nothing
  if (mediaItem && currentMedia.album === mediaItem.name) {
    // Album field contains the station name, not a real album - ignore click
    return;
  }

  if (mediaItem && "album" in mediaItem && mediaItem.album) {
    // Navigate directly to album detail page
    store.showFullscreenPlayer = false;
    router.push({
      name: "album",
      params: {
        itemId: mediaItem.album.item_id,
        provider: mediaItem.album.provider,
      },
    });
  } else {
    // Radio or non-library item - try to find in library first
    try {
      // Call with positional parameters: (favorite, search, limit, offset, order_by, album_types, provider)
      const results = await api.getLibraryAlbums(
        undefined, // favorite
        currentMedia.album, // search
        5, // limit - get a few results to find best match
        undefined,
        undefined,
        undefined,
        undefined, // genre_ids
      );

      if (results.length > 0) {
        let bestMatch = results[0];

        // If we have artist info, try to find album by same artist
        if (currentMedia.artist) {
          const matchWithArtist = results.find((album) =>
            album.artists?.some(
              (artist) =>
                artist.name.toLowerCase() ===
                  currentMedia.artist!.toLowerCase() ||
                artist.name
                  .toLowerCase()
                  .includes(currentMedia.artist!.toLowerCase()) ||
                currentMedia
                  .artist!.toLowerCase()
                  .includes(artist.name.toLowerCase()),
            ),
          );
          if (matchWithArtist) {
            bestMatch = matchWithArtist;
          }
        }

        // Found in library! Navigate to it
        store.showFullscreenPlayer = false;
        router.push({
          name: "album",
          params: {
            itemId: bestMatch.item_id,
            provider: bestMatch.provider,
          },
        });
        return;
      }
    } catch (error) {
      console.error("Error searching library for album:", error);
    }

    // Not found in library - fall back to global search
    const searchTerm = currentMedia.artist
      ? `${currentMedia.artist} - ${currentMedia.album}`
      : currentMedia.album || "";
    store.globalSearchTerm = searchTerm;
    router.push({ name: "search" });
    store.showFullscreenPlayer = false;
  }
};

const onArtistClick = async function () {
  const currentMedia = store.activePlayer?.current_media;
  if (!currentMedia?.artist) return;

  // Try to get the artist from the full media item (for library items)
  const mediaItem = store.curQueueItem?.media_item;

  if (
    mediaItem &&
    "artists" in mediaItem &&
    mediaItem.artists &&
    mediaItem.artists.length > 0
  ) {
    // Navigate directly to artist detail page
    store.showFullscreenPlayer = false;
    router.push({
      name: "artist",
      params: {
        itemId: mediaItem.artists[0].item_id,
        provider: mediaItem.artists[0].provider,
      },
    });
  } else {
    // Radio or non-library item - try to find in library first
    try {
      // Call with positional parameters: (favorite, search, limit, offset, order_by, album_artists_only, provider)
      const results = await api.getLibraryArtists(
        undefined, // favorite
        currentMedia.artist, // search
        5, // limit
        undefined,
        undefined,
        undefined,
        undefined, // genre_ids
      );

      if (results.length > 0) {
        // Try to find exact match by name
        let bestMatch = results[0];

        const exactMatch = results.find(
          (artist) =>
            artist.name.toLowerCase() === currentMedia.artist!.toLowerCase(),
        );
        if (exactMatch) {
          bestMatch = exactMatch;
        }

        // Found in library! Navigate to it
        store.showFullscreenPlayer = false;
        router.push({
          name: "artist",
          params: {
            itemId: bestMatch.item_id,
            provider: bestMatch.provider,
          },
        });
        return;
      }
    } catch (error) {
      console.error("Error searching library for artist:", error);
    }

    // Not found in library - fall back to global search
    store.globalSearchTerm = currentMedia.artist;
    router.push({ name: "search" });
    store.showFullscreenPlayer = false;
  }
};

const openQueueMenu = function (evt: Event) {
  if (!store.activePlayer) return;
  const menuItems = getPlayerMenuItems(
    store.activePlayer,
    store.activePlayerQueue,
    {
      context: "queue",
      hideShuffleRepeat: mdAndUp.value,
    },
  );
  // While lyrics are open, surface the sync-offset stepper at the top of the
  // overflow menu (only for players that benefit from a latency offset).
  if (showLyrics.value && showLyricsOffset.value) {
    menuItems.unshift({
      label: "lyrics_offset",
      // markRaw: the menu items land in a reactive array; a bare component
      // definition there would be needlessly made reactive.
      component: markRaw(LyricsOffsetMenuControl),
    });
  }
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

// sync currentItemFavorite when the server confirms a favorite change
onMounted(() => {
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      if (
        "favorite" in updatedItem &&
        store.curQueueItem?.media_item?.uri === updatedItem.uri
      ) {
        currentItemFavorite.value = updatedItem.favorite;
      }
    },
  );
  onBeforeUnmount(unsub);
});

// Handle Escape key to close fullscreen player (since persistent disables default behavior)
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && store.showFullscreenPlayer && !store.dialogActive) {
    store.showFullscreenPlayer = false;
  }
};
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
  });
});

const onHeartBtnClick = async function (evt: PointerEvent | MouseEvent) {
  // the heart icon/button was clicked
  if (!store.curQueueItem?.media_item) return;
  if (!currentItemFavorite.value) {
    currentItemFavorite.value = true; // optimistic — survives server queue refresh
    api.toggleFavorite(store.curQueueItem.media_item);
    return;
  }
  //resolve media item into a library item
  let resolvedItem = store.curQueueItem!.media_item as MediaItemType;
  if (
    (resolvedItem.provider != "library" ||
      !("provider_mappings" in resolvedItem)) &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(resolvedItem.media_type)
  ) {
    // resolve itemmapping or non-library item
    resolvedItem =
      (await api.getLibraryItem(
        resolvedItem.media_type,
        resolvedItem.item_id,
        resolvedItem.provider,
      )) || resolvedItem;
  }

  const menuItems: ContextMenuItem[] = [];

  // remove from favorites
  if (
    "favorite" in resolvedItem &&
    resolvedItem.favorite &&
    resolvedItem.provider == "library" &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(resolvedItem.media_type)
  ) {
    menuItems.push({
      label: "favorites_remove",
      labelArgs: [],
      action: () => {
        api.removeItemFromFavorites(
          resolvedItem.media_type,
          resolvedItem.item_id,
        );
        resolvedItem.favorite = false;
        store.curQueueItem!.media_item!.favorite = false;
        currentItemFavorite.value = false;
      },
      icon: "mdi-heart",
    });
  }

  // add to playlist
  if (
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(resolvedItem.media_type)
  ) {
    menuItems.push({
      label: "add_playlist",
      labelArgs: [],
      action: () => {
        eventbus.emit("playlistdialog", {
          items: [store.curQueueItem!.media_item as MediaItemType],
        });
      },
      icon: "mdi-plus-circle-outline",
    });
  }

  // open the contextmenu by emitting the event
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: evt.clientX,
    posY: evt.clientY,
  });
};

const sliderColor = ref<string | undefined>(undefined);
const backgroundColor = ref<string | undefined>(undefined);

watchEffect(() => {
  const isDarkTheme = vuetify.theme.current.value.dark;
  const bgHex = isDarkTheme
    ? compProps.colorPalette.darkColor || "#000"
    : compProps.colorPalette.lightColor || "#fff";

  const textHex = isDarkTheme ? "#ffffff" : "#000000";
  const inverseTextHex = isDarkTheme ? "#000000" : "#ffffff";

  document.documentElement.style.setProperty("--text-color", textHex);
  document.documentElement.style.setProperty(
    "--text-color-inverse",
    inverseTextHex,
  );
  sliderColor.value = textHex;

  const bgColor = Color(bgHex);
  const topColor = bgColor.lighten(0.25);
  const bottomColor = bgColor.darken(0.25);
  backgroundColor.value = `linear-gradient(to bottom, ${topColor.hex()}, ${bottomColor.hex()})`;
});
</script>

<style scoped>
.fullscreen-player-card {
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main {
  display: flex;
  flex: 1;
  min-height: 0;
}

.main .main-media-details {
  flex: 50%;
  max-width: 100%;
  width: 50%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-queue-items {
  flex: 50%;
  height: 100%;
  max-width: 100%;
  padding-right: 10px;
  padding-left: 15px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.queue-items-scroll-box {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 12px;
  /* Keep the list clear of the progress bar / controls below. */
  margin-bottom: 24px;
  scroll-behavior: auto;
}

/* Virtual list: a spacer sized to the whole queue, with only the visible rows
   rendered and absolutely positioned via an inline translateY. */
.queue-virt {
  position: relative;
  width: 100%;
}

.queue-virt-row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

/* While dragging, the rows slide smoothly as the landing gap opens/moves. */
.queue-virt--dragging .queue-virt-row {
  transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}

/* Floating clone of the dragged row; sits above the list and tracks the
   pointer. Positioned via an inline translateY in content space. */
.queue-ghost {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 3;
  pointer-events: none;
}

/* Placeholder shown while a page of items is still loading. */
.queue-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
  padding: 6px 8px;
}

.queue-skeleton__thumb {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 10%,
    transparent
  );
}

.queue-skeleton__lines {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-skeleton__line {
  width: 55%;
  height: 12px;
  border-radius: 4px;
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 10%,
    transparent
  );
}

.queue-skeleton__line--sub {
  width: 38%;
  height: 10px;
}

/* Section divider between played / now playing / up next. */
.queue-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 8px 6px;
}

.queue-divider__label {
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-color, currentColor);
  opacity: 0.65;
}

.queue-divider__count {
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-color, currentColor);
  opacity: 0.4;
}

.queue-divider__line {
  flex: 1 1 auto;
  height: 1px;
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 18%,
    transparent
  );
}

/* Audiobook chapters under the current item. */
.queue-chapters {
  display: flex;
  flex-direction: column;
  margin: 2px 0 6px 60px;
}

.queue-chapter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  text-align: left;
  color: var(--text-color, currentColor);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.queue-chapter:hover {
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 8%,
    transparent
  );
}

.queue-chapter__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--queue-subtitle-size, 0.8rem);
}

.queue-chapter__time {
  flex: 0 0 auto;
  font-size: 0.72rem;
  opacity: 0.6;
}

.queue-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  text-align: center;
  opacity: 0.6;
}

.main-media-details-image {
  flex: 1;
  min-height: 0;
  max-height: 60%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-left: 20px;
  padding-right: 20px;
  container-type: size;
}
.main-media-details-image .v-img {
  width: min(100cqi, 100cqh);
  height: min(100cqi, 100cqh);
  flex: 0 0 auto;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.main-media-details-image-alt {
  height: 100% !important;
  max-height: 100% !important;
  padding: 10px !important;
}

.main-media-details-track-info {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  text-align: center;
  padding: min(5%, 5vh) 0 10px;
  overflow: hidden;
}

.main-media-details-track-info > * {
  max-width: 100%;
}

.player-bottom {
  flex-shrink: 0;
  position: unset !important;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), min(3%, 3vh));
  width: 100%;
}

.track-info {
  margin-top: 10px;
  margin-bottom: 10px;
  padding-top: 2vh;
  padding-bottom: 2vh;
  text-align: center;
  line-height: 10%;
}

.track-info-subtitle {
  opacity: 0.5;
}

.media-controls {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 15px;
  /* match the visual gap between the controls and the volume bar below */
  margin-top: 10px;
  height: 100px;
}

.media-controls-item {
  margin: 0 10px;
  width: 100%;
  height: 100%;
}

.queue-btn-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .media-controls-item {
    margin: 0 5px;
    width: 100%;
    height: 100%;
  }
}

.row {
  align-content: center;
}

.row-centered {
  justify-content: center;
  max-width: 100%;
  padding: 15px;
}

.media-controls > button {
  flex: 1 1 auto;
}

.media-controls-bottom {
  display: flex;
  flex: 0 1 auto;
  justify-content: center;
  align-items: center;
}

.media-controls-bottom > div {
  flex-basis: 0;
  flex-grow: 1;
  max-width: 100%;
}

.media-controls > div {
  width: calc(100% / 3);
}

/* Match the marginless transport icons so the play button stays centred. */
.media-controls > .queue-btn-wrapper {
  margin: 0;
}

.mediacontrols-right {
  display: table-cell;
  text-align: right;
  vertical-align: middle;
}

.mediacontrols-right > div {
  display: inline-flex;
  align-items: center;
}

.v-toolbar :deep(.v-toolbar-title) {
  text-align: center;
}

/* Line the trailing menu button up with the per-row menu buttons in the queue
   list below: those sit 18px from the column's right edge (10px column + 8px
   row padding) with a 32px button, so this 28px button needs a 20px end margin
   for the two to share a vertical centre. */
.v-toolbar :deep(.v-toolbar__append) {
  margin-inline-end: 20px;
}

div,
button {
  color: var(--text-color);
}

.play-btn-wrapper :deep(.play-btn-icon) {
  background-color: var(--text-color) !important;
}

.player-bottom :deep([data-slot="slider-range"]) {
  background-color: var(--text-color) !important;
}

.player-bottom :deep([data-slot="slider-thumb"])::before {
  background-color: var(--text-color) !important;
}

.player-bottom :deep([data-slot="slider-track"])::before {
  background-color: color-mix(
    in srgb,
    var(--text-color) 24%,
    transparent
  ) !important;
}

.lyrics-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lyrics-wrapper > :deep(.lyrics-container) {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
}

.lyrics-wrapper :deep(.lyrics-line),
.lyrics-wrapper :deep(.break-note) {
  font-size: clamp(1.3rem, 4.5vw, 1.9rem);
}

/* Tablet */
@media (min-width: 600px) {
  .lyrics-wrapper :deep(.lyrics-line),
  .lyrics-wrapper :deep(.break-note) {
    font-size: clamp(1.6rem, 3.5vw, 2.4rem);
  }
}

/* Desktop */
@media (min-width: 1280px) {
  .lyrics-wrapper :deep(.lyrics-line),
  .lyrics-wrapper :deep(.break-note) {
    font-size: clamp(1.4rem, 2vw, 2.2rem);
  }
}

.icon-thumb-large {
  width: 100%;
  aspect-ratio: 1;
  max-width: 400px;
  margin: 0 auto;
  border-radius: 10px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.guest-request-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background: color-mix(in srgb, var(--badge-color) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 35%, transparent);
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--badge-color);
  margin-right: 0.5rem;
}

@media (max-width: 540px) {
  .main-media-details-image {
    max-height: 75%;
    padding-left: 16px;
    padding-right: 16px;
  }

  .main-media-details-track-info {
    padding: 8px 0;
  }
}
</style>
