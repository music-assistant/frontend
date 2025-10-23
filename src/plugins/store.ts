import { computed, reactive } from "vue";
import { MediaType, Player, PlayerQueue, QueueItem, MediaItemChapter } from "./api/interfaces";

import api from "./api";
import { StoredState } from "@/components/ItemsListing.vue";
import { isTouchscreenDevice, parseBool } from "@/helpers/utils";

import MobileDetect from "mobile-detect";
import { getBreakpointValue } from "./breakpoint";

type DeviceType = "desktop" | "phone" | "tablet";
const md = new MobileDetect(window.navigator.userAgent);

const DEVICE_TYPE: DeviceType = md.tablet()
  ? "tablet"
  : md.phone() || md.mobile()
    ? "phone"
    : "desktop";

export enum AlertType {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
  SUCCESS = "success",
}

interface Alert {
  type: AlertType;
  message: string;
  persistent: boolean;
}

interface Store {
  activePlayerId?: string;
  isInStandaloneMode: boolean;
  showPlayersMenu: boolean;
  showFullscreenPlayer: boolean;
  frameless: boolean;
  showQueueItems: boolean;
  apiInitialized: boolean;
  apiBaseUrl: string;
  dialogActive: boolean;
  activePlayer?: Player;
  activePlayerQueue?: PlayerQueue;
  curQueueItem?: QueueItem;
  curChapter?: MediaItemChapter;
  globalSearchTerm?: string;
  globalSearchType?: MediaType;
  prevState?: StoredState;
  activeAlert?: Alert;
  prevRoute?: string;
  libraryArtistsCount?: number;
  libraryAlbumsCount?: number;
  libraryTracksCount?: number;
  libraryPlaylistsCount?: number;
  libraryRadiosCount?: number;
  libraryPodcastsCount?: number;
  libraryAudiobooksCount?: number;
  connected?: boolean;
  isTouchscreen: boolean;
  playMenuShown: boolean;
  playActionInProgress: boolean;
  deviceType: DeviceType;
  forceMobileLayout?: boolean;
  mobileLayout: boolean;
}

export const store: Store = reactive({
  activePlayerId: undefined,
  isInStandaloneMode: false,
  showPlayersMenu: false,
  showFullscreenPlayer: false,
  frameless: false,
  showQueueItems: false,
  apiInitialized: false,
  apiBaseUrl: "",
  dialogActive: false,
  activePlayer: computed(() => {
    if (store.activePlayerId && store.activePlayerId in api.players) {
      return api.players[store.activePlayerId];
    }
    return undefined;
  }),
  activePlayerQueue: computed(() => {
    if (
      store.activePlayer?.active_source &&
      store.activePlayer.active_source in api.queues
    ) {
      return api.queues[store.activePlayer.active_source];
    }
    if (
      store.activePlayer &&
      !store.activePlayer.active_source &&
      store.activePlayer.player_id in api.queues &&
      api.queues[store.activePlayer.player_id].active
    ) {
      return api.queues[store.activePlayer.player_id];
    }
    return undefined;
  }),
  curQueueItem: computed(() => {
    if (store.activePlayerQueue && store.activePlayerQueue.active)
      return store.activePlayerQueue.current_item;
    return undefined;
  }),
  curChapter: computed(() => {
    if (store.curQueueItem?.media_item?.metadata?.chapters) {
      return store.curQueueItem.media_item.metadata.chapters.find((chapter) => {
        if (!store.activePlayerQueue?.elapsed_time) return undefined;
        if (!chapter.end) return undefined;
        return (
          chapter.start < store.activePlayerQueue?.elapsed_time &&
          chapter.end > store.activePlayerQueue?.elapsed_time
        );
      });
    }
    return undefined;
  }),
  globalSearchTerm: undefined,
  globalSearchType: undefined,
  prevState: undefined,
  activeAlert: undefined,
  prevRoute: undefined,
  libraryArtistsCount: undefined,
  libraryAlbumsCount: undefined,
  libraryTracksCount: undefined,
  libraryPlaylistsCount: undefined,
  libraryRadiosCount: undefined,
  connected: false,
  isTouchscreen: isTouchscreenDevice(),
  playMenuShown: false,
  playActionInProgress: false,
  deviceType: DEVICE_TYPE,
  mobileLayout: computed(() => {
    return (
      getBreakpointValue({ breakpoint: "tablet" }) ||
      parseBool(store.forceMobileLayout)
    );
  }),
});
