import { computed, reactive } from "vue";
import {
  MediaType,
  Player,
  PlayerQueue,
  QueueItem,
  ServerInfoMessage,
  User,
} from "./api/interfaces";

import { StoredState } from "@/components/ItemsListing.vue";
import { isTouchscreenDevice, parseBool } from "@/helpers/utils";
import api from "./api";

import MobileDetect from "mobile-detect";
import { getBreakpointValue } from "./breakpoint";

type DeviceType = "desktop" | "phone" | "tablet";
const md = new MobileDetect(window.navigator.userAgent);

const DEVICE_TYPE: DeviceType = md.tablet()
  ? "tablet"
  : md.phone() || md.mobile()
    ? "phone"
    : "desktop";

interface Store {
  activePlayerId?: string;
  isInPWAMode: boolean;
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
  globalSearchTerm?: string;
  globalSearchType?: MediaType;
  prevState?: StoredState;
  prevRoute?: string;
  libraryArtistsCount?: number;
  libraryAlbumsCount?: number;
  libraryTracksCount?: number;
  libraryPlaylistsCount?: number;
  libraryRadiosCount?: number;
  libraryPodcastsCount?: number;
  libraryAudiobooksCount?: number;
  libraryGenresCount?: number;
  isTouchscreen: boolean;
  playerTipShown: boolean;
  playActionInProgress: boolean;
  deviceType: DeviceType;
  forceMobileLayout?: boolean;
  mobileLayout: boolean;
  currentUser?: User;
  serverInfo?: ServerInfoMessage;
  isIngressSession: boolean;
  isOnboarding: boolean;
  companionPlayerId?: string;
}

export const store: Store = reactive({
  activePlayerId: undefined,
  isInPWAMode: false,
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
  globalSearchTerm: undefined,
  globalSearchType: undefined,
  prevState: undefined,
  prevRoute: undefined,
  libraryArtistsCount: undefined,
  libraryAlbumsCount: undefined,
  libraryTracksCount: undefined,
  libraryPlaylistsCount: undefined,
  libraryRadiosCount: undefined,
  libraryGenresCount: undefined,
  isTouchscreen: isTouchscreenDevice(),
  playMenuShown: false,
  playerTipShown: false,
  playActionInProgress: false,
  deviceType: DEVICE_TYPE,
  mobileLayout: computed(() => {
    const isMobileDevice = getBreakpointValue({ breakpoint: "tablet" });
    const isNarrowScreen = getBreakpointValue({
      breakpoint: "bp5",
      condition: "lt",
      offset: -31, // bp5 (800px) - 31 ≈ 769px
    });

    return (
      isMobileDevice || isNarrowScreen || parseBool(store.forceMobileLayout)
    );
  }),
  currentUser: undefined,
  serverInfo: undefined,
  isIngressSession: window.location.pathname.includes("/hassio_ingress/"),
  isOnboarding: false,
});
