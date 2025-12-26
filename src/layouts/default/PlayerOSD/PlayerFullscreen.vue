<template>
  <v-dialog
    v-model="store.showFullscreenPlayer"
    class="fullscreen-player-dialog"
    fullscreen
    :scrim="false"
    transition="dialog-bottom-transition"
    z-index="9999"
    persistent
  >
    <v-card theme="dark" class="player-card">
      <!-- background image -->
      <div class="player-background">
        <v-img
          v-if="store.activePlayer?.current_media?.image_url"
          :src="getMediaImageUrl(store.activePlayer.current_media.image_url)"
          cover
          class="player-background-image"
        />
        <div class="player-background-overlay"></div>
      </div>
      <div class="player-layout">
        <v-toolbar
          class="v-toolbar-default"
          color="transparent"
          density="comfortable"
        >
          <template #prepend>
            <Button icon @click="store.showFullscreenPlayer = false">
              <v-icon icon="mdi-chevron-down" />
            </Button>

            <!-- Meta Info (Source/Quality) moved to toolbar -->
            <div class="toolbar-meta-info ml-4 d-flex align-center">
              <div
                v-if="
                  !store.activePlayerQueue && store.activePlayer?.active_source
                "
                class="text-caption opacity-70"
              >
                {{
                  $t("external_source_active", [
                    getSourceName(store.activePlayer),
                  ])
                }}
              </div>
              <div
                v-else-if="
                  store.activePlayerQueue && store.activePlayerQueue.items == 0
                "
                class="text-caption opacity-70"
              >
                {{ $t("queue_empty") }}
              </div>

              <div
                v-if="
                  store.activePlayer?.powered != false &&
                  store.curQueueItem?.streamdetails
                "
                class="quality-badge ml-2"
              >
                <QualityDetailsBtn />
              </div>
            </div>
          </template>
          <template #append>
            <v-menu v-if="store.activePlayerQueue?.radio_source.length" scrim>
              <template #activator="{ props }">
                <Button v-bind="props" icon>
                  <v-icon color="accent" icon="mdi-radio-tower" />
                </Button>
              </template>

              <v-card
                :title="$t('queue_radio_enabled')"
                :subtitle="$t('queue_radio_based_on')"
              >
                <template #text>
                  <div
                    v-for="source in store.activePlayerQueue?.radio_source"
                    :key="source.uri"
                  >
                    <a @click="itemClick(source)">{{ source.name }}</a>
                  </div>
                </template>
              </v-card>
            </v-menu>

            <SpeakerBtn v-if="!showExpandedPlayerSelectButton" />

            <Button icon @click.stop="openQueueMenu">
              <v-icon icon="mdi-dots-vertical" />
            </Button>
          </template>
        </v-toolbar>

        <div class="player-content">
          <!-- LEFT PANEL: NOW PLAYING -->
          <div
            v-if="getBreakpointValue('bp7') || !store.showQueueItems"
            class="player-panel-left"
          >
            <div class="artwork-container">
              <div class="artwork-wrapper">
                <v-img
                  v-if="
                    store.activePlayer?.powered != false &&
                    store.activePlayer?.current_media?.image_url
                  "
                  :src="
                    getMediaImageUrl(store.activePlayer.current_media.image_url)
                  "
                  cover
                  class="artwork-image"
                />
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

            <div class="track-info-container">
              <!-- Title -->
              <v-card-title
                v-if="store.activePlayer?.powered == false"
                class="text-h4 font-weight-bold"
              >
                {{ store.activePlayer?.name }}
              </v-card-title>
              <v-card-title
                v-else-if="store.activePlayer?.current_media?.title"
                class="text-h4 font-weight-bold"
                style="cursor: pointer"
                @click="onTitleClick"
              >
                <MarqueeText :sync="playerMarqueeSync">
                  {{ store.activePlayer.current_media.title }}
                </MarqueeText>
              </v-card-title>
              <v-card-title
                v-else
                class="text-h4 font-weight-bold"
                style="cursor: pointer"
                @click="store.showPlayersMenu = true"
              >
                <MarqueeText :sync="playerMarqueeSync">
                  {{ store.activePlayer?.name || $t("no_player") }}
                </MarqueeText>
              </v-card-title>

              <!-- Subtitles -->
              <v-card-subtitle
                v-if="store.activePlayer?.powered == false"
                class="text-h6"
              >
                {{ $t("off") }}
              </v-card-subtitle>
              <v-card-subtitle
                v-else-if="
                  store.activePlayer?.current_media?.album &&
                  store.activePlayer?.current_media?.album !==
                    store.activePlayer?.current_media?.title
                "
                class="text-h6"
                style="cursor: pointer"
                @click="onAlbumClick"
              >
                <MarqueeText :sync="playerMarqueeSync">
                  {{ store.activePlayer.current_media.album }}
                </MarqueeText>
              </v-card-subtitle>
              <v-card-subtitle
                v-if="store.activePlayer?.current_media?.artist"
                class="text-h6"
                style="cursor: pointer"
                @click="onArtistClick"
              >
                <MarqueeText :sync="playerMarqueeSync">
                  {{ store.activePlayer.current_media.artist }}
                </MarqueeText>
              </v-card-subtitle>

              <!-- Quality / Source -->
              <!-- Moved to toolbar -->
            </div>

            <div class="controls-container">
              <div class="timeline-wrapper">
                <PlayerTimeline :show-labels="true" :color="sliderColor" />
              </div>

              <div class="media-controls-wrapper">
                <Icon
                  v-if="store.activePlayerQueue"
                  :disabled="!store.curQueueItem?.media_item"
                  :icon="
                    store.curQueueItem?.media_item?.favorite
                      ? 'mdi-heart'
                      : 'mdi-heart-outline'
                  "
                  :title="$t('tooltip.favorite')"
                  variant="button"
                  class="media-control-btn"
                  @click="onHeartBtnClick"
                />
                <ShuffleBtn
                  v-if="$vuetify.display.mdAndUp"
                  :player-queue="store.activePlayerQueue"
                  class="media-control-btn"
                />
                <PreviousBtn
                  :player="store.activePlayer"
                  :player-queue="store.activePlayerQueue"
                  class="media-control-btn prev-next-btn"
                />
                <PlayBtn
                  :player="store.activePlayer"
                  :player-queue="store.activePlayerQueue"
                  class="media-control-btn play-btn"
                />
                <NextBtn
                  :player="store.activePlayer"
                  :player-queue="store.activePlayerQueue"
                  class="media-control-btn prev-next-btn"
                />
                <RepeatBtn
                  v-if="$vuetify.display.mdAndUp"
                  :player-queue="store.activePlayerQueue"
                  class="media-control-btn"
                />
                <QueueBtn
                  v-if="store.activePlayerQueue"
                  class="media-control-btn"
                />
              </div>

              <div v-if="store.activePlayer" class="volume-wrapper">
                <PlayerVolume
                  width="100%"
                  :is-powered="store.activePlayer?.powered != false"
                  :disabled="
                    !store.activePlayer ||
                    !store.activePlayer?.available ||
                    store.activePlayer.powered == false ||
                    !store.activePlayer.supported_features.includes(
                      PlayerFeature.VOLUME_SET,
                    )
                  "
                  :model-value="
                    Math.round(
                      store.activePlayer.group_members.length > 0
                        ? store.activePlayer.group_volume
                        : store.activePlayer.volume_level || 0,
                    )
                  "
                  prepend-icon="mdi-volume-minus"
                  append-icon="mdi-volume-plus"
                  :color="sliderColor"
                  :allow-wheel="true"
                  @update:model-value="
                    store.activePlayer!.group_members.length > 0
                      ? api.playerCommandGroupVolume(
                          store.activePlayerId!,
                          $event,
                        )
                      : api.playerCommandVolumeSet(
                          store.activePlayerId!,
                          $event,
                        )
                  "
                  @click:prepend="
                    store.activePlayer!.group_members.length > 0
                      ? api.playerCommandGroupVolumeDown(store.activePlayerId!)
                      : api.playerCommandVolumeDown(store.activePlayerId!)
                  "
                  @click:append="
                    store.activePlayer!.group_members.length > 0
                      ? api.playerCommandGroupVolumeUp(store.activePlayerId!)
                      : api.playerCommandVolumeUp(store.activePlayerId!)
                  "
                />
              </div>

              <div
                v-if="showExpandedPlayerSelectButton"
                class="player-select-wrapper"
              >
                <v-btn
                  class="player-select-btn"
                  variant="outlined"
                  @click="store.showPlayersMenu = true"
                >
                  <v-icon
                    :icon="store.activePlayer?.icon || 'mdi-speaker'"
                    class="mr-2"
                  />
                  {{
                    store.activePlayer ? getPlayerName(store.activePlayer) : ""
                  }}
                </v-btn>
              </div>
            </div>
          </div>

          <!-- RIGHT PANEL: QUEUE -->
          <div
            v-if="store.showQueueItems && store.activePlayerQueue"
            class="player-panel-right"
          >
            <div class="queue-header">
              <v-tabs
                v-model="activeQueuePanel"
                hide-slider
                density="compact"
                class="queue-tabs"
                bg-color="transparent"
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
                <v-tab v-if="hasLyrics" :value="2">
                  {{ $t("lyrics") }}
                </v-tab>
              </v-tabs>
              <v-btn
                v-if="!getBreakpointValue('bp7')"
                icon
                variant="text"
                @click="store.showQueueItems = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>

            <div
              ref="queueContainerRef"
              class="queue-list-container"
              :style="scrollMaskStyle"
            >
              <v-infinite-scroll
                v-if="!tempHide && activeQueuePanel !== 2"
                :onLoad="loadNextPage"
                :empty-text="''"
                height="100%"
              >
                <v-virtual-scroll
                  :item-height="70"
                  max-height="100%"
                  :items="activeQueuePanel == 0 ? nextItems : previousItems"
                >
                  <template #default="{ item, index }">
                    <ListItem
                      link
                      :show-menu-btn="true"
                      :disabled="!item.available"
                      class="queue-list-item"
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
                        <NowPlayingBadge
                          v-if="
                            item.queue_item_id ===
                              store.curQueueItem?.queue_item_id &&
                            store.activePlayer?.playback_state !=
                              PlaybackState.IDLE
                          "
                          :show-badge="getBreakpointValue('bp4')"
                        />
                        <v-icon v-if="!item.available">mdi-alert</v-icon>
                      </template>
                    </ListItem>
                    <!-- Chapters -->
                    <div
                      v-if="
                        item.queue_item_id ==
                          store.curQueueItem?.queue_item_id &&
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
                          <span v-if="chapter.end" class="text-caption">{{
                            formatDuration(chapter.end - chapter.start)
                          }}</span>
                        </template>
                      </v-list-item>
                    </div>
                  </template>
                </v-virtual-scroll>
              </v-infinite-scroll>

              <div v-if="activeQueuePanel === 2" class="lyrics-wrapper">
                <LyricsViewer
                  :media-item="store.curQueueItem?.media_item"
                  :position="lyricsElapsedTime"
                  :duration="store.curQueueItem?.duration"
                  :stream-details="store.curQueueItem?.streamdetails"
                  :text-color="sliderColor"
                  :lyrics="currentLyrics.plain"
                  :lrc-lyrics="currentLyrics.synced"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import Icon from "@/components/Icon.vue";
import ListItem from "@/components/ListItem.vue";
import LyricsViewer from "@/components/LyricsViewer.vue";
import MarqueeText from "@/components/MarqueeText.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
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
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaItemChapter,
  MediaItemType,
  MediaType,
  PlaybackState,
  PlayerFeature,
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
import SpeakerBtn from "./PlayerControlBtn/SpeakerBtn.vue";
import PlayerTimeline from "./PlayerTimeline.vue";
import { getSourceName } from "@/plugins/api/helpers";
import computeElapsedTime from "@/helpers/elapsed";

const { name } = useDisplay();

interface Props {
  colorPalette: ImageColorPalette;
}
const compProps = defineProps<Props>();

const playerMarqueeSync = new MarqueeTextSync();
const hoveredQueueIndex = ref(-1);
const hoveredMarqueeSync = new MarqueeTextSync();

// Local refs
const queueItems = ref<QueueItem[]>([]);
const activeQueuePanel = ref(0);
const tempHide = ref(false);

// Lyrics elapsed time computation (similar to PlayerTimeline)
const nowTick = ref(0);
let tickTimer: ReturnType<typeof setInterval> | null = null;

const startTick = (interval = 250) => {
  if (!tickTimer) {
    tickTimer = setInterval(() => (nowTick.value = Date.now()), interval);
  }
};

const stopTick = () => {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
};

const lyricsElapsedTime = computed(() => {
  // Include nowTick.value so this computed re-evaluates periodically
  void nowTick.value;

  const isPlaying =
    store.activePlayer?.playback_state === PlaybackState.PLAYING;
  const queue = store.activePlayerQueue;

  // Start/stop tick based on playback state
  if (isPlaying && queue?.active) {
    startTick();
  } else {
    stopTick();
  }

  // Compute elapsed time from queue
  if (queue?.elapsed_time != null && queue?.elapsed_time_last_updated != null) {
    return (
      computeElapsedTime(
        queue.elapsed_time,
        queue.elapsed_time_last_updated,
        store.activePlayer?.playback_state,
      ) ?? 0
    );
  }

  return 0;
});

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

// Fetch lyrics for the current track (only when fullscreen player is open)
const fetchLyrics = async () => {
  // Clear lyrics immediately
  currentLyrics.value = { plain: null, synced: null };

  // Only fetch lyrics when fullscreen player is open
  if (!store.showFullscreenPlayer) {
    return;
  }

  const mediaItem = store.curQueueItem?.media_item;

  // Only proceed if we have a track media item
  if (!mediaItem || mediaItem.media_type !== MediaType.TRACK) {
    return;
  }

  const track = mediaItem as Track;

  // Check if lyrics are already in metadata
  const existingPlain = track.metadata?.lyrics?.trim() || null;
  const existingSynced = track.metadata?.lrc_lyrics?.trim() || null;

  if (existingPlain || existingSynced) {
    currentLyrics.value = { plain: existingPlain, synced: existingSynced };
    return;
  }

  // Fetch lyrics from API
  try {
    const [lyrics, lrcLyrics] = await api.getTrackLyrics(track);
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
    console.error("Failed to fetch track lyrics:", error);
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
      return "1.2em";
    case "sm":
      return "1.6em";
    case "md":
      return "2em";
    case "lg":
      return store.showQueueItems ? "1.5em" : "2.5em";
    case "xl":
      return store.showQueueItems ? "1.6em" : "3em";
    case "xxl":
      return store.showQueueItems ? "1.7em" : "3.2em";
    default:
      return "1.0em.";
  }
});

const subTitleFontSize = computed(() => {
  switch (name.value) {
    case "xs":
      return "1.0em";
    case "sm":
      return "1.2em";
    case "md":
      return "1.7em";
    case "lg":
      return store.showQueueItems ? "1.0em" : "1.6em";
    case "xl":
      return store.showQueueItems ? "1.2em" : "2em";
    case "xxl":
      return store.showQueueItems ? "1.2em" : "2em";
    default:
      return "1.0em.";
  }
});

const showExpandedPlayerSelectButton = computed(() => {
  return vuetify.display.height.value > 800;
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

const onTitleClick = function () {
  const currentMedia = store.activePlayer?.current_media;
  if (!currentMedia) return;
  const searchTerm = currentMedia.artist
    ? `${currentMedia.artist} - ${currentMedia.title}`
    : currentMedia.title || "";
  navigateOrSearch(searchTerm, currentMedia.uri);
};

const onAlbumClick = function () {
  const currentMedia = store.activePlayer?.current_media;
  if (!currentMedia?.album) return;
  const searchTerm = currentMedia.artist
    ? `${currentMedia.artist} - ${currentMedia.album}`
    : currentMedia.title || "";
  navigateOrSearch(searchTerm, currentMedia.uri);
};

const onArtistClick = function () {
  const currentMedia = store.activePlayer?.current_media;
  if (!currentMedia?.artist) return;
  navigateOrSearch(currentMedia.artist, currentMedia.uri);
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
    items: getPlayerMenuItems(store.activePlayer, store.activePlayerQueue),
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
  } else if (command == "delete") {
    api.queueCommandDelete(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  }
};

const resetItems = async function () {
  tempHide.value = true;
  queueItems.value = [];
  await sleep(100);
  tempHide.value = false;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = async function ({ done }: { done: any }) {
  if (!store.activePlayerQueue || store.activePlayerQueue.items == 0) {
    done("empty");
    return;
  }
  if (queueItems.value.length >= store.activePlayerQueue?.items) {
    done("empty");
    return;
  }
  const offset = queueItems.value.length;
  const limit = (store.activePlayerQueue.current_index || 0) + 50;
  const result = await api.getPlayerQueueItems(
    store.activePlayerQueue.queue_id,
    limit,
    offset,
  );
  queueItems.value.push(...result);
  if (result.length < 50) {
    done("empty");
  } else {
    done("ok");
  }
};

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
    stopTick();
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

// Scroll mask logic
const canScrollUp = ref(false);
const canScrollDown = ref(false);

const scrollMaskStyle = computed(() => {
  if (canScrollUp.value && canScrollDown.value) {
    return {
      maskImage:
        "linear-gradient(to bottom, transparent 0%, black 40px, black calc(100% - 40px), transparent 100%)",
      WebkitMaskImage:
        "linear-gradient(to bottom, transparent 0%, black 40px, black calc(100% - 40px), transparent 100%)",
    };
  } else if (canScrollUp.value) {
    return {
      maskImage:
        "linear-gradient(to bottom, transparent 0%, black 40px, black 100%)",
      WebkitMaskImage:
        "linear-gradient(to bottom, transparent 0%, black 40px, black 100%)",
    };
  } else if (canScrollDown.value) {
    return {
      maskImage:
        "linear-gradient(to bottom, black 0%, black calc(100% - 40px), transparent 100%)",
      WebkitMaskImage:
        "linear-gradient(to bottom, black 0%, black calc(100% - 40px), transparent 100%)",
    };
  }
  return {};
});

const queueContainerRef = ref<HTMLElement | null>(null);

const updateScrollState = () => {
  const container = queueContainerRef.value;
  if (!container) return;

  // Find the element that actually has the scrollbar
  // We prioritize v-virtual-scroll as it's the inner container
  let scrollable = container.querySelector(".v-virtual-scroll") as HTMLElement;

  // If not found or not scrollable, try v-infinite-scroll
  if (!scrollable || getComputedStyle(scrollable).overflowY === "hidden") {
    scrollable = container.querySelector(".v-infinite-scroll") as HTMLElement;
  }

  // Fallback: find any scrolling child
  if (!scrollable || scrollable.scrollHeight <= scrollable.clientHeight) {
    const candidates = container.querySelectorAll("div");
    for (const el of candidates) {
      const style = getComputedStyle(el);
      if (
        el.scrollHeight > el.clientHeight &&
        (style.overflowY === "auto" || style.overflowY === "scroll")
      ) {
        scrollable = el as HTMLElement;
        break;
      }
    }
  }

  if (scrollable) {
    const checkScroll = () => {
      canScrollUp.value = scrollable.scrollTop > 0;
      canScrollDown.value =
        scrollable.scrollHeight > scrollable.clientHeight &&
        scrollable.scrollTop + scrollable.clientHeight <
          scrollable.scrollHeight - 10;
    };

    // Run immediately
    checkScroll();

    // Attach listener
    scrollable.onscroll = checkScroll;
  } else {
    // Reset if no scrollable element found
    canScrollUp.value = false;
    canScrollDown.value = false;
  }
};

// Check scroll state when items change or tab changes
watch(
  [queueItems, activeQueuePanel],
  async () => {
    await sleep(200); // Wait for render
    updateScrollState();
  },
  { deep: true },
);

// Also check on mount/resize
onMounted(async () => {
  await sleep(500);
  updateScrollState();
  window.addEventListener("resize", updateScrollState);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateScrollState);
});

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
  const LIGHT_TEXT_COLOR = Color("white");
  const DARK_TEXT_COLOR = Color("black");
  // Minimum WCAG contrast ration between the background and the text
  // W3C recommends at least 4.5
  const MIN_CONTRAST = 5;
  const ADJUSTMENT_INCREMENT = 0.05;

  // Determine the base color from palette or fallback to theme default
  const coverImageColorCode = vuetify.theme.current.value.dark
    ? compProps.colorPalette.darkColor || "#000"
    : compProps.colorPalette.lightColor || "#fff";

  // Start with the original cover color as background
  let bgColor = Color(coverImageColorCode);

  // Calculate contrast with white and black
  const lightContrast = LIGHT_TEXT_COLOR.contrast(bgColor);
  const darkContrast = DARK_TEXT_COLOR.contrast(bgColor);

  // Choose the color with higher contrast as starting value
  const isLight = lightContrast >= darkContrast;
  let textColor = isLight ? LIGHT_TEXT_COLOR : DARK_TEXT_COLOR;
  let contrast = Math.max(lightContrast, darkContrast);

  // If the best contrast still doesn't meet requirements, adjust background
  if (contrast < MIN_CONTRAST) {
    // Darken light bg or lighten dark bg until contrast is good
    let adjustment = ADJUSTMENT_INCREMENT;

    while (contrast < MIN_CONTRAST && adjustment <= 0.5) {
      if (isLight) {
        bgColor = bgColor.darken(ADJUSTMENT_INCREMENT);
      } else {
        bgColor = bgColor.lighten(ADJUSTMENT_INCREMENT);
      }

      contrast = Color(textColor).contrast(bgColor);
      adjustment += ADJUSTMENT_INCREMENT;
    }
  }

  // Keep color between text and sliders consistent.
  // Also, this text color has a better contrast than the automatically selected one
  document.documentElement.style.setProperty("--text-color", textColor.hex());
  sliderColor.value = textColor.hex();
  backgroundColor.value = bgColor.hex();
});
</script>

<style scoped>
.player-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: black !important;
  overflow: hidden;
  --text-color: #ffffff;
  color: #ffffff;
}

.player-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.player-background-image {
  width: 100%;
  height: 100%;
  filter: blur(30px);
  transform: scale(1.2);
  opacity: 0.6;
}

.player-background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(60px);
  z-index: 1;
}

.player-layout {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.player-content {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  padding: 2rem;
  gap: 4rem;
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
}

/* LEFT PANEL */
.player-panel-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 0;
  height: 100%;
  max-width: 1000px;
  margin: 0 auto;
}

/* player-panel-left on mobile margin auto */
@media (max-width: 600px) {
  .player-panel-left {
    margin: 0;
  }
}

.artwork-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 0;
  margin-bottom: 2rem;
}

.artwork-wrapper {
  aspect-ratio: 1/1;
  height: 100%;
  max-height: 50vh;
  width: auto;
  position: relative;
}

.artwork-image {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  object-fit: cover;
}

.track-info-container {
  width: 100%;
  text-align: center;
  margin-bottom: 2rem;
}

.meta-info {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-meta-info {
  display: flex;
  align-items: center;
}

.opacity-70 {
  opacity: 0.7;
}

.controls-container {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline-wrapper {
  width: 100%;
  padding: 0 1rem;
}

.media-controls-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  margin: 1rem 0;
}

.media-control-btn {
  opacity: 0.8;
  transition: all 0.2s ease;
}

.media-control-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.play-btn {
  transform: scale(1.2);
}
.play-btn:hover {
  transform: scale(1.3);
}

.volume-wrapper {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.player-select-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

/* RIGHT PANEL */
.player-panel-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 16px;
  overflow: hidden;
  max-width: 600px;
  min-width: 350px;
}

.queue-tabs {
  flex: 1;
  background: transparent;
}

.queue-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.1);
  padding-right: 0.5rem;
}

.queue-list-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.queue-list-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.icon-thumb-large {
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.play-btn :deep(.v-icon) {
  font-size: 48px !important;
  width: 48px !important;
  height: 48px !important;
}

.prev-next-btn :deep(.v-icon) {
  font-size: 36px !important;
  width: 36px !important;
  height: 36px !important;
}

/* Responsive */
@media (max-width: 960px) {
  .player-content {
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }

  .player-panel-left {
    max-width: 100%;
    justify-content: space-evenly;
  }

  .artwork-container {
    margin-bottom: 1rem;
    flex: 0 1 auto;
    min-height: 0;
    width: 100%;
  }

  .artwork-wrapper {
    width: 100%;
    max-width: 40vh;
    aspect-ratio: 1/1;
    height: auto;
    margin: 0 auto;
  }

  .player-panel-right {
    max-width: 100%;
    height: 100%;
    min-width: 0;
  }
}

@media (max-width: 600px) {
  .player-content {
    padding: 1rem;
    gap: 0.5rem;
  }

  .artwork-wrapper {
    max-width: 35vh;
  }

  .track-info-container {
    margin-bottom: 1rem;
  }

  .media-controls-wrapper {
    gap: 1rem;
    margin: 0.5rem 0;
  }

  .media-control-btn {
    transform: scale(0.9);
  }

  .play-btn {
    transform: scale(1.1);
  }
}

/* Landscape mobile */
@media (max-width: 960px) and (orientation: landscape) {
  .player-content {
    flex-direction: row;
    align-items: center;
  }

  .player-panel-left {
    flex-direction: row;
    gap: 2rem;
  }

  .artwork-container {
    flex: 0 0 auto;
    width: 40%;
    height: 100%;
    margin-bottom: 0;
  }

  .artwork-wrapper {
    max-height: 80vh;
  }

  .controls-container {
    flex: 1;
    justify-content: center;
  }
}

/* Typography Overrides */
.v-card-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

div,
button {
  color: var(--text-color);
}
</style>

<style>
.fullscreen-player-dialog .v-overlay__content {
  overflow: hidden !important;
  max-height: 100vh !important;
  height: 100vh !important;
  width: 100vw !important;
  max-width: 100vw !important;
  display: flex !important;
  flex-direction: column !important;
}
</style>
