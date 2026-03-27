<template>
  <Dialog
    :open="store.showFullscreenPlayer"
    @update:open="(v: boolean) => { store.showFullscreenPlayer = v; }"
  >
    <DialogContent
      :show-close-button="false"
      class="fullscreen-dialog-content"
      :style="{ background: backgroundColor }"
      @escape-key-down.prevent
    >
      <!-- visually hidden title for accessibility -->
      <DialogTitle class="sr-only">{{ $t('now_playing') || 'Now Playing' }}</DialogTitle>
      <DialogDescription class="sr-only">{{ $t('aria.fullscreen_player') }}</DialogDescription>

      <!-- toolbar -->
      <div class="fullscreen-toolbar">
        <Button variant="ghost" size="icon" @click="store.showFullscreenPlayer = false">
          <ChevronDown class="h-6 w-6" />
        </Button>

        <div class="flex-1" />

        <!-- radio source menu -->
        <div v-if="store.activePlayerQueue?.radio_source.length" class="relative">
          <Button
            variant="ghost"
            size="icon"
            @click="showRadioMenu = !showRadioMenu"
          >
            <Radio class="h-5 w-5 text-accent" />
          </Button>
          <Teleport to="body">
            <div v-if="showRadioMenu" class="radio-menu-scrim" @click="showRadioMenu = false" />
            <div v-if="showRadioMenu" class="radio-menu-card">
              <div class="font-semibold text-sm px-4 pt-3 pb-1">{{ $t('queue_radio_enabled') }}</div>
              <div class="text-xs text-muted-foreground px-4 pb-2">{{ $t('queue_radio_based_on') }}</div>
              <div class="px-4 pb-3">
                <div
                  v-for="source in store.activePlayerQueue?.radio_source"
                  :key="source.uri"
                >
                  <a class="text-sm cursor-pointer hover:underline" @click="itemClick(source)">{{ source.name }}</a>
                </div>
              </div>
            </div>
          </Teleport>
        </div>

        <SpeakerBtn
          v-if="!showExpandedPlayerSelectButton"
          @click="
            () => {
              store.showFullscreenPlayer = false;
            }
          "
        />

        <Button variant="ghost" size="icon" @click.stop="openQueueMenu">
          <EllipsisVertical class="h-5 w-5" />
        </Button>
      </div>

      <!-- content -->
      <div class="main">
        <!-- left column: media thumb + details-->
        <div
          v-if="getBreakpointValue('bp7') || !store.showQueueItems"
          class="main-media-details"
        >
          <div
            v-if="windowHeight > 600"
            class="main-media-details-image"
          >
            <!-- current media image -->
            <img
              v-if="
                store.activePlayer?.powered != false &&
                store.activePlayer?.current_media?.image_url
              "
              class="media-cover-img"
              :src="
                getMediaImageUrl(store.activePlayer.current_media.image_url)
              "
            />
            <!-- fallback: display player icon in box -->
            <div v-else class="icon-thumb-large">
              <span
                class="mdi"
                :class="
                  store.activePlayer?.type == PlayerType.PLAYER &&
                  store.activePlayer?.group_members.length
                    ? 'mdi-speaker-multiple'
                    : store.activePlayer?.icon || 'mdi-speaker'
                "
                style="font-size: 128px;"
              />
            </div>
          </div>
          <div class="main-media-details-track-info">
            <!-- player name as title if its powered off-->
            <div
              v-if="store.activePlayer?.powered == false"
              class="track-title"
              :style="`font-size: ${titleFontSize};`"
            >
              {{ store.activePlayer?.name }}
            </div>
            <!-- current media title -->
            <div
              v-else-if="store.activePlayer?.current_media?.title"
              class="track-title"
              :style="`font-size: ${titleFontSize};cursor:pointer;`"
              @click="onTitleClick"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer.current_media.title }}
              </MarqueeText>
            </div>
            <!-- no player selected message -->
            <div
              v-else
              class="track-title"
              :style="`font-size: ${titleFontSize};cursor:pointer;`"
              @click="store.showPlayersMenu = true"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer?.name || $t("no_player") }}
              </MarqueeText>
            </div>

            <!-- SUBTITLE -->

            <!-- SUBTITLE: player powered off -->
            <div
              v-if="store.activePlayer?.powered == false"
              class="track-subtitle"
            >
              {{ $t("off") }}
            </div>

            <!-- subtitle: album -->
            <div
              v-else-if="
                store.activePlayer?.current_media?.album && showAlbumSubtitle
              "
              class="track-subtitle"
              :style="`font-size: ${subTitleFontSize};cursor:pointer;`"
              @click="onAlbumClick"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer.current_media.album }}
              </MarqueeText>
            </div>

            <!-- subtitle: artist -->
            <div
              v-if="store.activePlayer?.current_media?.artist"
              class="track-subtitle"
              :style="`font-size: ${subTitleFontSize};cursor:pointer;`"
              @click="onArtistClick"
            >
              <MarqueeText :sync="playerMarqueeSync">
                {{ store.activePlayer.current_media.artist }}
              </MarqueeText>
            </div>

            <!-- subtitle: queue empty or other source active -->
            <!-- 3rd party source active -->
            <div
              v-if="
                !store.activePlayerQueue && store.activePlayer?.active_source
              "
              class="track-subtitle caption"
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
              class="track-subtitle caption"
            >
              {{ $t("queue_empty") }}
            </div>

            <!-- streamdetails/contenttype button-->
            <div
              v-if="
                store.activePlayer?.powered != false &&
                store.curQueueItem?.streamdetails
              "
              style="padding-top: min(10px, 1vh)"
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
          <Tabs
            :model-value="activeQueuePanelStr"
            @update:model-value="onTabChange"
          >
            <TabsList>
              <TabsTrigger value="queue" class="queue-tab">
                {{ $t("queue") }}
                <Badge variant="secondary" class="ml-1">
                  {{
                    (store.activePlayerQueue?.items || 0) -
                    (store.activePlayerQueue?.current_index || 0)
                  }}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="played" class="queue-tab">
                {{ $t("played") }}
                <Badge variant="secondary" class="ml-1">
                  {{ store.activePlayerQueue?.current_index }}
                </Badge>
              </TabsTrigger>
              <TabsTrigger v-if="hasLyrics" value="lyrics" class="queue-tab">
                {{ $t("lyrics") }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div
            class="queue-items-scroll-box"
            :style="`--queue-title-size: ${queueTitleFontSize}; --queue-subtitle-size: ${queueSubtitleFontSize}; ${activeQueuePanel === 2 ? 'overflow: hidden;' : ''}`"
          >
            <div
              v-if="!tempHide && activeQueuePanel !== 2"
              class="queue-items-list"
              style="height: 100%; overflow-y: auto;"
            >
              <!-- list view -->
              <template
                v-for="(item, index) in activeQueuePanel == 0 ? nextItems : previousItems"
                :key="item.queue_item_id"
              >
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
                      <div class="flex">
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
                          store.activePlayer?.playback_state !=
                            PlaybackState.IDLE
                        "
                        :show-badge="getBreakpointValue('bp4')"
                      />
                      <AlertTriangle v-if="!item.available" class="h-5 w-5" />
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
                    <Item
                      v-for="chapter in item.media_item.metadata?.chapters"
                      :key="chapter.position"
                      size="sm"
                      class="cursor-pointer"
                      @click.stop="chapterClicked(item.media_item, chapter)"
                    >
                      <ItemContent>
                        <ItemTitle>{{ chapter.name }}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <span v-if="chapter.end" class="text-xs text-muted-foreground"
                          >{{ formatDuration(chapter.end - chapter.start) }}
                        </span>
                      </ItemActions>
                    </Item>
                  </div>
              </template>
              <!-- IntersectionObserver sentinel for infinite scroll -->
              <div ref="infiniteScrollSentinel" class="h-1" />
            </div>
            <!-- Lyrics view -->
            <div v-if="activeQueuePanel === 2" class="lyrics-wrapper">
              <LyricsViewer
                :media-item="store.curQueueItem?.media_item"
                :position="lyricsElapsedTime"
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
          v-if="!store.showQueueItems && windowHeight <= 600"
          class="main-queue-items"
        >
          <div class="main-media-details-image main-media-details-image-alt">
            <img
              v-if="store.activePlayer?.current_media?.image_url"
              class="media-cover-img"
              :src="
                getMediaImageUrl(store.activePlayer.current_media.image_url)
              "
            />
            <!-- fallback: display player icon in box -->
            <div v-else class="icon-thumb-large">
              <span
                class="mdi"
                :class="
                  store.activePlayer?.type == PlayerType.PLAYER &&
                  store.activePlayer?.group_members.length
                    ? 'mdi-speaker-multiple'
                    : store.activePlayer?.icon || 'mdi-speaker'
                "
                style="font-size: 128px;"
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
            v-if="mdAndUp"
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
            v-if="mdAndUp"
            :player-queue="store.activePlayerQueue"
            class="media-controls-item"
            max-height="35px"
          />
          <QueueBtn
            v-if="store.activePlayerQueue"
            class="media-controls-item"
            max-height="30px"
            :size="18"
          />
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
          <Button
            variant="outline"
            class="responsive-icon-holder-btn"
            @click="
              () => {
                store.showPlayersMenu = true;
                store.showFullscreenPlayer = false;
              }
            "
          >
            <span class="mdi" :class="store.activePlayer?.icon || 'mdi-speaker'" style="font-size: 20px;" />
            {{ store.activePlayer ? getPlayerName(store.activePlayer) : "" }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import Icon from "@/components/Icon.vue";
import ListItem from "@/components/ListItem.vue";
import LyricsViewer from "@/components/LyricsViewer.vue";
import MarqueeText from "@/components/MarqueeText.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import PartyPlayerBadge from "@/components/party/PartyPlayerBadge.vue";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBreakpoint } from "@/composables/useBreakpoint";
import { useIsDark } from "@/composables/useIsDark";
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
import Color from "color";
import { AlertTriangle, ChevronDown, EllipsisVertical, Heart, Radio } from "lucide-vue-next";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import { ContextMenuItem } from "../ItemContextMenu.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import SpeakerBtn from "./PlayerControlBtn/SpeakerBtn.vue";
import PlayerTimeline from "./PlayerTimeline.vue";

const { mdAndUp, mobile, height: windowHeight } = useBreakpoint();
const { isDark } = useIsDark();

const showRadioMenu = ref(false);
const infiniteScrollSentinel = ref<HTMLElement>();

const MIN_HEIGHT_SHOW_FULL_DETAILS = 750;
const showAlbumSubtitle = computed(
  () => windowHeight.value > MIN_HEIGHT_SHOW_FULL_DETAILS,
);

interface Props {
  colorPalette: ImageColorPalette;
}
const compProps = defineProps<Props>();

const playBtnStyle = computed(() => {
  const dark = isDark.value;
  const color = dark
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

const lyricsEnabled = computed(() => activeQueuePanel.value === 2);
const { elapsedTime: lyricsElapsedTime } = useLyricsElapsedTime(lyricsEnabled);

// Map between numeric panel index and string tab values
const activeQueuePanelStr = computed(() => {
  switch (activeQueuePanel.value) {
    case 0: return "queue";
    case 1: return "played";
    case 2: return "lyrics";
    default: return "queue";
  }
});

const onTabChange = (value: string | number) => {
  const strVal = String(value);
  switch (strVal) {
    case "queue": activeQueuePanel.value = 0; break;
    case "played": activeQueuePanel.value = 1; break;
    case "lyrics": activeQueuePanel.value = 2; break;
  }
  activeQueuePanelClick();
};

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

const fetchLyrics = async () => {
  // Clear lyrics immediately
  currentLyrics.value = { plain: null, synced: null };

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

// Breakpoint name for font size calculations
const breakpointName = computed(() => {
  if (!mobile.value && windowHeight.value >= 1280) return "xxl";
  if (!mobile.value && windowHeight.value >= 800) return "xl";
  if (mdAndUp.value) return "lg";
  if (!mobile.value) return "md";
  return "sm";
});

const titleFontSize = computed(() => {
  switch (breakpointName.value) {
    case "sm":
      return "1.3em";
    case "md":
      return "1.6em";
    case "lg":
      return "1.8em";
    case "xl":
      return store.showQueueItems ? "1.7em" : "2.1em";
    case "xxl":
      return store.showQueueItems ? "1.8em" : "2.3em";
    default:
      return "1.0em";
  }
});

const subTitleFontSize = computed(() => {
  switch (breakpointName.value) {
    case "sm":
      return "0.95em";
    case "md":
      return "1.15em";
    case "lg":
      return "1.3em";
    case "xl":
      return store.showQueueItems ? "1.2em" : "1.5em";
    case "xxl":
      return store.showQueueItems ? "1.3em" : "1.65em";
    default:
      return "1.0em";
  }
});

const queueTitleFontSize = computed(() => {
  switch (breakpointName.value) {
    case "sm":
      return "0.875rem";
    case "md":
      return "0.875rem";
    case "lg":
      return "0.925rem";
    case "xl":
      return "0.9rem";
    case "xxl":
      return "0.925rem";
    default:
      return "0.875rem";
  }
});

const queueSubtitleFontSize = computed(() => {
  switch (breakpointName.value) {
    case "sm":
      return "0.775rem";
    case "md":
      return "0.775rem";
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
  return windowHeight.value > MIN_HEIGHT_SHOW_FULL_DETAILS;
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
  allLoaded.value = false;
  await sleep(100);
  tempHide.value = false;
};

const isLoadingMore = ref(false);
const allLoaded = ref(false);

const loadNextPage = async function () {
  if (isLoadingMore.value || allLoaded.value) return;
  if (!store.activePlayerQueue || store.activePlayerQueue.items == 0) {
    allLoaded.value = true;
    return;
  }
  if (queueItems.value.length >= store.activePlayerQueue?.items) {
    allLoaded.value = true;
    return;
  }
  isLoadingMore.value = true;
  const offset = queueItems.value.length;
  const limit = (store.activePlayerQueue.current_index || 0) + 50;
  const result = await api.getPlayerQueueItems(
    store.activePlayerQueue.queue_id,
    limit,
    offset,
  );
  queueItems.value.push(...result);
  if (result.length < 50) {
    allLoaded.value = true;
  }
  isLoadingMore.value = false;
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

// IntersectionObserver for infinite scroll
let infiniteScrollObserver: IntersectionObserver | null = null;
onMounted(() => {
  watch(infiniteScrollSentinel, (el) => {
    if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
    if (!el) return;
    infiniteScrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    infiniteScrollObserver.observe(el);
  }, { immediate: true });
  onBeforeUnmount(() => {
    infiniteScrollObserver?.disconnect();
  });
});

// Handle Escape key to close fullscreen player (since persistent disables default behavior)
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && !store.dialogActive) {
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
  const coverImageColorCode = isDark.value
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
  document.documentElement.style.setProperty(
    "--text-color-inverse",
    isLight ? DARK_TEXT_COLOR.hex() : LIGHT_TEXT_COLOR.hex(),
  );
  sliderColor.value = textColor.hex();
  const topColor = bgColor.lighten(0.25);
  const bottomColor = bgColor.darken(0.25);
  backgroundColor.value = `linear-gradient(to bottom, ${topColor.hex()}, ${bottomColor.hex()})`;
});
</script>

<style scoped>
:global(.fullscreen-dialog-content) {
  position: fixed !important;
  inset: 0 !important;
  top: 0 !important;
  left: 0 !important;
  max-width: 100% !important;
  width: 100% !important;
  height: 100% !important;
  border-radius: 0 !important;
  border: none !important;
  padding: 0 !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  z-index: 9000 !important;
  /* Reset Tailwind translate so centering offset doesn't apply */
  --tw-translate-x: 0 !important;
  --tw-translate-y: 0 !important;
}

/* Slide up from bottom — matches original Vuetify dialog-bottom-transition */
:global(.fullscreen-dialog-content[data-state="open"]) {
  animation: fullscreen-slide-up 300ms ease-out !important;
}

:global(.fullscreen-dialog-content[data-state="closed"]) {
  animation: fullscreen-slide-down 200ms ease-in !important;
}

@keyframes fullscreen-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fullscreen-slide-down {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

/* Hide overlay — original Vuetify dialog used scrim="false" */
:global(.fullscreen-dialog-content ~ [data-slot="dialog-overlay"]),
:global([data-slot="dialog-overlay"]:has(~ .fullscreen-dialog-content)) {
  display: none !important;
}

.fullscreen-toolbar {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 8px;
  flex-shrink: 0;
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

.queue-items-scroll-box [data-slot="item-title"] {
  font-size: var(--queue-title-size, 1rem);
}

.queue-items-scroll-box [data-slot="item-description"] {
  font-size: var(--queue-subtitle-size, 0.875rem);
}

.queue-items-list {
  overflow-y: auto;
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

.media-cover-img {
  width: min(100cqi, 100cqh);
  height: min(100cqi, 100cqh);
  flex: 0 0 auto;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  object-fit: cover;
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

.track-title {
  font-weight: bold;
  line-height: 1.2;
}

.track-subtitle {
  opacity: 0.7;
  line-height: 1.3;
}

.player-bottom {
  flex-shrink: 0;
  position: unset !important;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), min(3%, 3vh));
  width: 100%;
}

.main-queue-items :deep([data-slot="tabs-list"]) {
  background: color-mix(in srgb, var(--text-color, #fff) 10%, transparent);
  height: auto;
  padding: 3px;
  border-radius: 10px;
  gap: 0;
  width: auto;
}

.queue-tab {
  opacity: 0.5;
  font-size: 0.8rem;
  text-transform: none !important;
  letter-spacing: normal;
  padding: 4px 14px !important;
  height: 32px !important;
  min-height: 0 !important;
  flex: 0 0 auto !important;
  border-radius: 8px !important;
  color: var(--text-color, inherit);
  background: color-mix(in srgb, var(--text-color, #fff) 6%, transparent) !important;
  border: 1px solid color-mix(in srgb, var(--text-color, #fff) 10%, transparent) !important;
  box-shadow: none !important;
}

.queue-tab[data-state="active"] {
  opacity: 1;
  background: color-mix(in srgb, var(--text-color, #fff) 14%, transparent) !important;
  border-color: color-mix(in srgb, var(--text-color, #fff) 18%, transparent) !important;
}

.queue-tab :deep([data-slot="badge"]) {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0 5px;
  height: 16px;
  min-width: 16px;
  line-height: 16px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-color, #888) 40%, transparent);
  color: inherit;
  border: none;
  margin-left: 4px;
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
  background-color: var(--muted);
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

.radio-menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 999998;
}

.radio-menu-card {
  position: fixed;
  top: 56px;
  right: 60px;
  z-index: 999999;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 38px -10px rgba(0, 0, 0, 0.35), 0 10px 20px -15px rgba(0, 0, 0, 0.2);
  min-width: 250px;
}
</style>
