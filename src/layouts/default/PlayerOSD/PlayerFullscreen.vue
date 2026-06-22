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
            @click="store.showFullscreenPlayer = false"
          >
            <ChevronDownIcon class="size-5" />
          </Button>
        </template>
        <template #append>
          <PlayerFullscreenHeaderControls
            :lyrics-state="lyricsState"
            :lyrics-active="lyricsActive"
            :show-lyrics-offset="showLyricsOffset"
            :lyrics-offset-display="lyricsOffsetDisplay"
            @toggle-lyrics="toggleLyrics"
            @offset-press="startRepeatingOffset"
          />

          <Button variant="ghost" size="icon-sm" @click.stop="openQueueMenu">
            <EllipsisVerticalIcon class="size-5" />
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
            />
            <!-- fallback: display player icon in box -->
            <div v-else class="icon-thumb-large">
              <v-icon
                size="128"
                :icon="
                  store.activePlayer?.type == PlayerType.PLAYER &&
                  store.activePlayer?.group_members.length
                    ? 'mdi-speaker-multiple'
                    : store.activePlayer?.icon || 'mdi-speaker'
                "
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
          <v-tabs
            v-if="!showLyrics"
            v-model="activeQueuePanel"
            hide-slider
            density="compact"
            @click="activeQueuePanelClick"
          >
            <v-tab :value="0">
              {{ $t("queue") }}
              <v-badge
                color="grey"
                :content="
                  (store.activePlayerQueue?.items || 0) -
                  (store.activePlayerQueue?.current_index || 0)
                "
                inline
              />
            </v-tab>
            <v-tab :value="1">
              {{ $t("played") }}
              <v-badge
                color="grey"
                :content="store.activePlayerQueue?.current_index"
                inline
              />
            </v-tab>
          </v-tabs>
          <div
            class="queue-items-scroll-box"
            :style="`--queue-title-size: ${queueTitleFontSize}; --queue-subtitle-size: ${queueSubtitleFontSize};`"
          >
            <v-virtual-scroll
              v-if="!tempHide && !showLyrics"
              ref="virtualScrollRef"
              :item-height="70"
              height="100%"
              :items="activeQueuePanel == 0 ? nextItems : previousItems"
              @scroll="onQueueScroll"
            >
              <template #default="{ item, index }">
                <ListItem
                  link
                  :show-menu-btn="true"
                  :disabled="!item.available"
                  @click.stop="(e: Event) => openQueueItemMenu(e, item)"
                  @menu.stop="(e: Event) => openQueueItemMenu(e, item)"
                  @mouseenter="hoveredQueueIndex = index"
                  @mouseleave="hoveredQueueIndex = -1"
                >
                  <template #prepend>
                    <div class="media-thumb listitem-media-thumb">
                      <MediaItemThumb size="50" :item="item" />
                    </div>
                  </template>
                  <template #title>
                    <div class="title-row">
                      <!-- only scroll the currently playing track, or when hovered with a separate sync group -->
                      <MarqueeText
                        :sync="
                          index == 0 && activeQueuePanel == 0
                            ? playerMarqueeSync
                            : hoveredMarqueeSync
                        "
                        :disabled="
                          !(
                            (index == 0 && activeQueuePanel == 0) ||
                            hoveredQueueIndex == index
                          )
                        "
                      >
                        <span
                          :class="{
                            'is-playing':
                              item.queue_item_id ===
                              store.curQueueItem?.queue_item_id,
                          }"
                        >
                          {{ item.name }}
                        </span>
                      </MarqueeText>
                    </div>
                  </template>
                  <template #subtitle>
                    <div class="d-flex">
                      <span style="white-space: nowrap" class="pr-1">
                        {{ formatDuration(item.duration) }} |
                      </span>
                      <MarqueeText
                        :sync="
                          index == 0 && activeQueuePanel == 0
                            ? playerMarqueeSync
                            : hoveredMarqueeSync
                        "
                        :disabled="
                          !(
                            (index == 0 && activeQueuePanel == 0) ||
                            hoveredQueueIndex == index
                          )
                        "
                      >
                        <span
                          v-if="
                            item.media_item &&
                            'album' in item.media_item &&
                            item.media_item.album
                          "
                        >
                          {{ item.media_item.album.name }}
                        </span>
                      </MarqueeText>
                    </div>
                  </template>
                  <template #append>
                    <PartyPlayerBadge
                      v-if="item.extra_attributes?.party_guest === true"
                      :type="
                        item.extra_attributes?.party_boosted === true
                          ? 'boost'
                          : 'request'
                      "
                      :badge-color="
                        item.extra_attributes?.party_boosted === true
                          ? boostBadgeColor
                          : requestBadgeColor
                      "
                    />
                    <NowPlayingBadge
                      v-if="
                        item.queue_item_id ===
                          store.curQueueItem?.queue_item_id &&
                        store.activePlayer?.playback_state != PlaybackState.IDLE
                      "
                      :show-badge="getBreakpointValue('bp4')"
                    />
                    <v-icon v-if="!item.available">mdi-alert</v-icon>
                  </template>
                </ListItem>
                <!-- Show chapters -->
                <div
                  v-if="
                    item.queue_item_id == store.curQueueItem?.queue_item_id &&
                    item.media_item?.metadata?.chapters?.length
                  "
                  style="margin-left: 50px"
                >
                  <v-list-item
                    v-for="chapter in item.media_item.metadata?.chapters"
                    :key="chapter.position"
                    @click.stop="chapterClicked(item.media_item, chapter)"
                  >
                    <template #title>
                      <div>{{ chapter.name }}</div>
                    </template>
                    <template #append>
                      <span v-if="chapter.end" class="text-caption"
                        >{{ formatDuration(chapter.end - chapter.start) }}
                      </span>
                    </template>
                  </v-list-item>
                </div>
              </template>
            </v-virtual-scroll>
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
            />
            <!-- fallback: display player icon in box -->
            <div v-else class="icon-thumb-large">
              <v-icon
                size="128"
                :icon="
                  store.activePlayer?.type == PlayerType.PLAYER &&
                  store.activePlayer?.group_members.length
                    ? 'mdi-speaker-multiple'
                    : store.activePlayer?.icon || 'mdi-speaker'
                "
              />
            </div>
          </div>
        </div>
      </div>

      <!-- player controls (always at bottom)-->
      <div class="player-bottom">
        <!-- timeline / progressbar-->
        <div class="row" style="margin-left: 5%; margin-right: 5%">
          <PlayerTimeline :show-labels="true" :color="sliderColor" />
        </div>

        <!-- main media control buttons (play, next, previous etc.)-->
        <div class="media-controls">
          <Icon
            v-if="store.activePlayerQueue"
            :disabled="!store.curQueueItem?.media_item"
            :title="$t('tooltip.favorite')"
            variant="button"
            class="media-controls-item"
            max-height="30px"
            @click="onHeartBtnClick"
          >
            <Heart
              :size="18"
              :fill="
                store.curQueueItem?.media_item?.favorite
                  ? 'currentColor'
                  : 'none'
              "
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
              v-if="store.activePlayerQueue"
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
            class="gap-1.5 rounded-full text-xs font-medium"
            variant="outline"
            size="sm"
            @click="
              () => {
                store.showPlayersMenu = true;
                store.showFullscreenPlayer = false;
              }
            "
          >
            <v-icon
              :icon="store.activePlayer?.icon || 'mdi-speaker'"
              size="16"
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
import ListItem from "@/components/ListItem.vue";
import LyricsViewer from "@/components/LyricsViewer.vue";
import MarqueeText from "@/components/MarqueeText.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import PartyPlayerBadge from "@/components/party/PartyPlayerBadge.vue";
import { Button } from "@/components/ui/button";
import { useLyricsElapsedTime } from "@/composables/useLyricsElapsedTime";
import { usePartyConfig } from "@/composables/usePartyConfig";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import {
  ImageColorPalette,
  formatDuration,
  getMediaImageUrl,
  getPlayerName,
  sleep,
} from "@/helpers/utils";
import NextBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/NextBtn.vue";
import PlayBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/PlayBtn.vue";
import PreviousBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/PreviousBtn.vue";
import RepeatBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue";
import ShuffleBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleBtn.vue";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import PlayerFullscreenHeaderControls from "@/layouts/default/PlayerOSD/PlayerFullscreenHeaderControls.vue";
import api from "@/plugins/api";
import { getSourceName } from "@/plugins/api/helpers";
import {
  EventMessage,
  EventType,
  MediaItemChapter,
  MediaItemType,
  MediaType,
  PlaybackState,
  PlayerQueue,
  PlayerType,
  QueueItem,
  QueueOption,
  Track,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import vuetify from "@/plugins/vuetify";
import Color from "color";
import { ChevronDownIcon, EllipsisVerticalIcon, Heart } from "lucide-vue-next";
import {
  computed,
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

const { name } = useDisplay();

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
const hoveredQueueIndex = ref(-1);
const hoveredMarqueeSync = new MarqueeTextSync();

// Local refs
const queueItems = ref<QueueItem[]>([]);
const activeQueuePanel = ref(0);
const tempHide = ref(false);

// Badge colors for guest request badges (loaded from party/config)
const requestBadgeColor = ref("#2196f3");
const boostBadgeColor = ref("#ff5722");

const { elapsedTime: lyricsElapsedTime } = useLyricsElapsedTime();

// Computed properties

const nextItems = computed(() => {
  if (store.activePlayerQueue) {
    return queueItems.value.slice(store.activePlayerQueue.current_index);
  } else return [];
});
const previousItems = computed(() => {
  if (store.activePlayerQueue) {
    return queueItems.value
      .slice(0, store.activePlayerQueue.current_index)
      .reverse();
  } else return [];
});
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
  "available" | "loading" | "unavailable-song" | "unavailable-content" | "none"
>(() => {
  if (!store.curQueueItem) return "none";
  if (store.curQueueItem.media_item?.media_type !== MediaType.TRACK)
    return "unavailable-content";
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
  if (
    showLyrics.value &&
    (state === "unavailable-song" ||
      state === "unavailable-content" ||
      state === "none")
  ) {
    showLyrics.value = false;
  }
});

// Whether the right-hand column (queue list or lyrics) is visible. Used to
// collapse the media details column on small/narrow screens.
const showRightColumn = computed(
  () => store.showQueueItems || showLyrics.value,
);

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

// Lyrics latency offset, in seconds. Adjustable via the lyrics sync pill in
// the header; persists across tracks within the session.
const lyricsOffset = ref(0);

const lyricsOffsetDisplay = computed(() => {
  const val = lyricsOffset.value;
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}`;
});

const adjustLyricsOffset = (delta: number) => {
  const next = Math.round((lyricsOffset.value + delta) * 10) / 10;
  lyricsOffset.value = Math.max(-9.9, Math.min(9.9, next));
};

// Press-and-hold: first step on press, then accelerate after a short delay.
let offsetHoldDelay: number | null = null;
let offsetHoldInterval: number | null = null;

const stopRepeatingOffset = () => {
  if (offsetHoldDelay !== null) {
    clearTimeout(offsetHoldDelay);
    offsetHoldDelay = null;
  }
  if (offsetHoldInterval !== null) {
    clearInterval(offsetHoldInterval);
    offsetHoldInterval = null;
  }
  window.removeEventListener("mouseup", stopRepeatingOffset);
  window.removeEventListener("touchend", stopRepeatingOffset);
  window.removeEventListener("touchcancel", stopRepeatingOffset);
};

const startRepeatingOffset = (delta: number) => {
  stopRepeatingOffset();
  adjustLyricsOffset(delta);
  offsetHoldDelay = window.setTimeout(() => {
    offsetHoldInterval = window.setInterval(
      () => adjustLyricsOffset(delta),
      80,
    );
  }, 400);
  window.addEventListener("mouseup", stopRepeatingOffset);
  window.addEventListener("touchend", stopRepeatingOffset);
  window.addEventListener("touchcancel", stopRepeatingOffset);
};

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

const queueTitleFontSize = computed(() => {
  switch (name.value) {
    case "xs":
      return "0.875rem";
    case "sm":
      return "0.875rem";
    case "md":
      return "0.925rem";
    case "lg":
      return "0.9rem";
    case "xl":
      return "0.925rem";
    case "xxl":
      return "0.975rem";
    default:
      return "0.875rem";
  }
});

const queueSubtitleFontSize = computed(() => {
  switch (name.value) {
    case "xs":
      return "0.775rem";
    case "sm":
      return "0.775rem";
    case "md":
      return "0.8rem";
    case "lg":
      return "0.8rem";
    case "xl":
      return "0.8rem";
    case "xxl":
      return "0.85rem";
    default:
      return "0.775rem";
  }
});

const showExpandedPlayerSelectButton = computed(() => {
  // Always show the player select button at the bottom; only hide it on very
  // short screens (never relocate it to the header).
  return vuetify.display.height.value > MIN_HEIGHT_SHOW_PLAYER_SELECT_BUTTON;
});

// methods

const itemClick = function (item: MediaItemType) {
  // mediaItem in the list is clicked
  store.showFullscreenPlayer = false;
  router.push({
    name: item.media_type,
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};

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

const openQueueItemMenu = function (evt: Event, item: QueueItem) {
  const itemIndex = queueItems.value.indexOf(item);
  const menuItems = [
    {
      label: "play_now",
      labelArgs: [],
      action: () => {
        queueCommand(item, "play_now");
      },
      icon: "mdi-play-circle-outline",
      disabled:
        itemIndex === store.activePlayerQueue?.current_index ||
        itemIndex === store.activePlayerQueue?.index_in_buffer,
    },
    {
      label: "play_next",
      labelArgs: [],
      action: () => {
        queueCommand(item, "move_next");
      },
      icon: "mdi-skip-next-circle-outline",
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: "queue_move_up",
      labelArgs: [],
      action: () => {
        queueCommand(item, "up");
      },
      icon: "mdi-arrow-up",
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: "queue_move_down",
      labelArgs: [],
      action: () => {
        queueCommand(item, "down");
      },
      icon: "mdi-arrow-down",
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: "queue_move_end",
      labelArgs: [],
      action: () => {
        queueCommand(item, "end");
      },
      icon: "mdi-arrow-collapse-down",
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: "queue_delete",
      labelArgs: [],
      action: () => {
        queueCommand(item, "delete");
      },
      icon: "mdi-delete",
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
  ];
  if (item?.media_item?.media_type == MediaType.TRACK) {
    menuItems.push({
      label: "show_info",
      labelArgs: [],
      action: () => {
        itemClick(item.media_item as Track);
      },
      icon: "mdi-information-outline",
      disabled: false,
    });
  }
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

const openQueueMenu = function (evt: Event) {
  if (!store.activePlayer) return;
  eventbus.emit("contextmenu", {
    items: getPlayerMenuItems(store.activePlayer, store.activePlayerQueue, {
      hideItemsWithDedicatedControls: true,
    }),
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

const queueCommand = function (item: QueueItem | undefined, command: string) {
  if (!item || !store.activePlayerQueue) return;
  if (command == "play_now") {
    api.queueCommandPlayIndex(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == "move_next") {
    api.queueCommandMoveNext(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == "up") {
    api.queueCommandMoveUp(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == "down") {
    api.queueCommandMoveDown(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == "end") {
    api.queueCommandMoveItemEnd(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == "delete") {
    api.queueCommandDelete(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  }
};

const virtualScrollRef = ref<InstanceType<
  typeof import("vuetify/components").VVirtualScroll
> | null>(null);
const loadingMore = ref(false);
const allItemsLoaded = ref(false);
// Number of queue items fetched per page, and the distance we keep loaded past
// the current index so the "queue" tab (sliced from current_index) never empties.
const QUEUE_PAGE_SIZE = 50;
// Bumped on every reset; an in-flight page load compares against it to detect it
// belongs to an outdated queue state and must discard its result.
let loadGeneration = 0;

const resetItems = async function () {
  // invalidate any in-flight load and release the loading guard, so a fetch that
  // errored (e.g. on a dropped remote connection) cannot wedge later loads.
  loadGeneration += 1;
  loadingMore.value = false;
  tempHide.value = true;
  queueItems.value = [];
  allItemsLoaded.value = false;
  await sleep(100);
  tempHide.value = false;
  if (store.showFullscreenPlayer && store.showQueueItems) {
    loadNextPage();
  }
};

const loadNextPage = async function () {
  if (loadingMore.value || allItemsLoaded.value) return;
  if (!store.activePlayerQueue || store.activePlayerQueue.items == 0) return;
  if (queueItems.value.length >= store.activePlayerQueue.items) {
    allItemsLoaded.value = true;
    return;
  }
  loadingMore.value = true;
  const generation = loadGeneration;
  const offset = queueItems.value.length;
  // On first load, ensure we fetch enough items to cover past the current
  // index so that nextItems (which slices from current_index) has data.
  const minNeeded =
    (store.activePlayerQueue.current_index || 0) + QUEUE_PAGE_SIZE;
  const limit =
    offset === 0
      ? Math.max(QUEUE_PAGE_SIZE, minNeeded - offset)
      : QUEUE_PAGE_SIZE;
  try {
    const result = await api.getPlayerQueueItems(
      store.activePlayerQueue.queue_id,
      limit,
      offset,
    );
    // a reset happened while awaiting; this page is stale, so drop it
    if (generation !== loadGeneration) return;
    queueItems.value.push(...result);
    if (result.length < limit) {
      allItemsLoaded.value = true;
    }
  } finally {
    // leave the guard untouched if a reset already started a newer load
    if (generation === loadGeneration) {
      loadingMore.value = false;
    }
  }
};

// fetch another page when the loaded window no longer extends a full page past
// the current index, which it is sliced from to build the "queue" tab
const ensureWindowAheadOfIndex = function () {
  if (!store.showFullscreenPlayer || !store.showQueueItems) return;
  const index = store.activePlayerQueue?.current_index ?? 0;
  if (queueItems.value.length - index < QUEUE_PAGE_SIZE) {
    loadNextPage();
  }
};

const onQueueScroll = function (e: Event) {
  const target = e.target as HTMLElement;
  if (!target) return;
  const threshold = 500;
  if (
    target.scrollTop + target.clientHeight >=
    target.scrollHeight - threshold
  ) {
    loadNextPage();
  }
};

// Fetch badge colors from party config
const { config: partyConfig, fetchConfig: fetchPartyConfig } = usePartyConfig();

// React to party config changes (e.g., admin changes badge colors)
watch(partyConfig, (newConfig) => {
  if (newConfig) {
    requestBadgeColor.value = newConfig.request_badge_color ?? "#2196F3";
    boostBadgeColor.value = newConfig.boost_badge_color ?? "#FF5722";
  }
});

onMounted(async () => {
  // Only fetch badge colors if party provider is loaded
  if (Object.values(api.providers).some((p) => p.domain === "party")) {
    await fetchPartyConfig();
  }
});

// load the initial page (or top up a window that went stale while hidden) when
// the queue items become visible
watch(
  [() => store.showFullscreenPlayer, () => store.showQueueItems],
  ensureWindowAheadOfIndex,
  { immediate: true },
);

// keep extending the window as playback advances so the "queue" tab, which
// slices nextItems from current_index, keeps showing the upcoming items
watch(() => store.activePlayerQueue?.current_index, ensureWindowAheadOfIndex);

// listen for item updates to refresh items when that happens
onMounted(() => {
  const unsub = api.subscribe(
    EventType.QUEUE_ITEMS_UPDATED,
    (evt: EventMessage) => {
      if (evt.object_id != store.activePlayerQueue?.queue_id) return;
      const queue = evt.data as PlayerQueue;
      resetItems();
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
    stopRepeatingOffset();
  });
});

const onHeartBtnClick = async function (evt: PointerEvent | MouseEvent) {
  // the heart icon/button was clicked
  if (!store.curQueueItem?.media_item) return;
  if (!store.curQueueItem.media_item.favorite) {
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

const activeQueuePanelClick = function () {
  // this hack is needed in order to force refresh the infinite scroller
  // otherwise it will not attempt to load more items if the end was reached
  // and then we load new items with a different size
  tempHide.value = true;
  sleep(100).then(() => {
    tempHide.value = false;
  });
};

const chapterClicked = function (
  item: MediaItemType,
  chapter: MediaItemChapter,
) {
  api.playMedia(
    item.uri,
    QueueOption.PLAY,
    undefined,
    chapter.position.toString(),
  );
};

// watchers
watch(
  () => store.activePlayerId,
  (val) => {
    resetItems();
  },
  { immediate: true },
);
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
  overflow-y: scroll;
}

.queue-items-scroll-box :deep(.v-list-item-title) {
  font-size: var(--queue-title-size, 1rem);
}

.queue-items-scroll-box :deep(.v-list-item-subtitle) {
  font-size: var(--queue-subtitle-size, 0.875rem);
}

.v-infinite-scroll--vertical {
  overflow-y: unset;
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

.v-tab {
  opacity: 0.5;
}
.v-tab-item--selected {
  opacity: 1;
}

.media-controls {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 15px;
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

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
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
