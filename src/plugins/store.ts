import { computed, reactive } from "vue";
import { MediaType, Player, PlayerQueue, QueueItem } from "./api/interfaces";

import api from "./api";
import { StoredState } from "@/components/ItemsListing.vue";
import { isTouchscreenDevice } from "@/helpers/utils";

import MobileDetect from "mobile-detect";

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
  navigationMenuStyle: string;
  showFullscreenPlayer: boolean;
  frameless: boolean;
  showQueueItems: boolean;
  apiInitialized: boolean;
  apiBaseUrl: string;
  dialogActive: boolean;
  activePlayer?: Player;
  activePlayerQueue?: PlayerQueue;
  curQueueItem?: QueueItem;
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
}

export const store: Store = reactive({
  activePlayerId: undefined,
  isInStandaloneMode: false,
  showPlayersMenu: false,
  navigationMenuStyle: "horizontal",
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
});
