<template>
  <v-dialog
    v-model="store.showFullscreenPlayer"
    fullscreen
    :scrim="false"
    transition="dialog-bottom-transition"
    z-index="9999"
    persistent
  >
    <v-card :color="backgroundColor">
      <v-toolbar class="v-toolbar-default" color="transparent">
        <template #prepend>
          <Button icon @click="store.showFullscreenPlayer = false">
            <v-icon icon="mdi-chevron-down" />
          </Button>
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

      <!-- content -->
      <div class="main">
        <!-- left column: media thumb + details-->
        <div
          v-if="getBreakpointValue('bp7') || !store.showQueueItems"
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
              style="max-width: 100%; width: auto; border-radius: 4px"
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
              :style="`font-size: ${titleFontSize};`"
            >
              {{ store.activePlayer?.name }}
            </v-card-title>
            <!-- current media title -->
            <v-card-title
              v-else-if="store.activePlayer?.current_media?.title"
              :style="`font-size: ${titleFontSize};cursor:pointer;`"
              @click="onTitleClick"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer.current_media.title }}
              </MarqueeText>
            </v-card-title>
            <!-- no player selected message -->
            <v-card-title
              v-else
              :style="`font-size: ${titleFontSize};cursor:pointer;`"
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
              v-else-if="store.activePlayer?.current_media?.album"
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

            <!-- streamdetails/contenttype button-->
            <div
              v-if="
                store.activePlayer?.powered != false &&
                store.curQueueItem?.streamdetails
              "
              style="margin: auto; padding-top: 20px"
            >
              <QualityDetailsBtn />
            </div>
          </div>
        </div>

        <!-- right column: queue items-->
        <div
          v-if="store.showQueueItems && store.activePlayerQueue"
          class="main-queue-items"
        >
          <v-tabs
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
            <v-tab v-if="hasLyrics" :value="2">
              {{ $t("lyrics") }}
            </v-tab>
          </v-tabs>
          <div class="queue-items-scroll-box">
            <v-infinite-scroll
              v-if="!tempHide && activeQueuePanel !== 2"
              :onLoad="loadNextPage"
              :empty-text="''"
              height="100%"
            >
              <!-- list view -->
              <v-virtual-scroll
                :item-height="70"
                max-height="90%"
                :items="activeQueuePanel == 0 ? nextItems : previousItems"
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
            </v-infinite-scroll>
            <!-- Lyrics view -->
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

        <!-- right column: media image (on small but wide screens)-->
        <div
          v-if="!store.showQueueItems && $vuetify.display.height <= 600"
          class="main-queue-items"
        >
          <div class="main-media-details-image main-media-details-image-alt">
            <v-img
              v-if="store.activePlayer?.current_media?.image_url"
              style="max-width: 100%; width: auto; border-radius: 4px"
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
            :icon="
              store.curQueueItem?.media_item?.favorite
                ? 'mdi-heart'
                : 'mdi-heart-outline'
            "
            :title="$t('tooltip.favorite')"
            variant="button"
            class="media-controls-item"
            max-height="30px"
            @click="onHeartBtnClick"
          />
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
          />
          <PlayBtn
            :player="store.activePlayer"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="70px"
          />
          <NextBtn
            :player="store.activePlayer"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="45px"
          />
          <RepeatBtn
            v-if="$vuetify.display.mdAndUp"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="35px"
          />
          <QueueBtn
            v-if="store.activePlayerQueue"
            class="media-controls-item"
            max-height="30px"
          />
        </div>

        <!-- volume control -->
        <div
          v-if="store.activePlayer"
          class="row"
          style="margin-left: 5%; margin-right: 5%"
        >
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
                ? api.playerCommandGroupVolume(store.activePlayerId!, $event)
                : api.playerCommandVolumeSet(store.activePlayerId!, $event)
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

        <!-- player select button -->
        <div
          v-if="showExpandedPlayerSelectButton"
          class="row"
          style="
            height: 70px;
            display: flex;
            justify-content: center;
            align-items: center;
            padding-bottom: 15px;
            padding-top: 15px;
          "
        >
          <v-btn
            class="responsive-icon-holder-btn"
            variant="outlined"
            @click="store.showPlayersMenu = true"
          >
            <v-icon :icon="store.activePlayer?.icon || 'mdi-speaker'" />
            {{ store.activePlayer ? getPlayerName(store.activePlayer) : "" }}
          </v-btn>
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
.main {
  display: flex;
  min-height: 50% !important;
  height: 50% !important;
  max-height: 65% !important;
  padding-bottom: 5px;
}

.main-media-details {
  flex: 50%;
  max-width: 100%;
  width: 50%;
}

.main-queue-items {
  flex: 50%;
  height: 100%;
  max-width: 100%;
  padding-right: 10px;
  padding-left: 15px;
}

.queue-items-scroll-box {
  max-height: 100%;
  overflow-y: scroll;
}

.queue-items-scroll-box::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}

.v-infinite-scroll--vertical {
  overflow-y: unset;
}

.main-media-details-image {
  min-height: 50%;
  max-height: 80%;
  height: 60%;
  align-content: center;
  padding-left: 20px;
  padding-right: 20px;
}
.main-media-details-image.v-img {
  width: auto;
}

.main-media-details-image-alt {
  height: 100% !important;
  max-height: 100% !important;
  align-content: center;
  padding: 0px !important;
}

.main-media-details-track-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 20px;
}

.player-bottom {
  max-height: 35% !important;
  min-height: 25% !important;
  height: 30% !important;
  margin-top: auto;
  bottom: 0;
  position: unset !important;
  padding-bottom: 5%;
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

.responsive-icon-holder-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.62;
  cursor: pointer !important;
}

.responsive-icon-holder-btn:focus,
.responsive-icon-holder-btn:hover {
  opacity: 1;
}

div,
button {
  color: var(--text-color);
}

.lyrics-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
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
  border-radius: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
