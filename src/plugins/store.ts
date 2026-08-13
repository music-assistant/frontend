import { computed, reactive } from "vue";
import {
  MediaType,
  Player,
  PlayerQueue,
  QueueItem,
  ServerInfoMessage,
  User,
} from "./api/interfaces";

import type { StoredState } from "@/components/ItemsListing.vue";
import {
  DEVICE_TYPE,
  isTouchscreenDevice,
  type DeviceType,
} from "@/helpers/device";
import { isHomeAssistantIngressSession } from "@/helpers/ingress";
import { parseBool } from "@/helpers/parse";
import api from "./api";
import { resolvePlayerQueue } from "./api/helpers";

import { getBreakpointValue, isPhoneSizedScreen } from "./breakpoint";

interface Store {
  activePlayerId?: string;
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
  // media type filter for the global search; empty means all media types
  globalSearchMediaTypes: MediaType[];
  prevState?: StoredState;
  libraryArtistsCount?: number;
  libraryAlbumsCount?: number;
  libraryTracksCount?: number;
  libraryPlaylistsCount?: number;
  libraryRadiosCount?: number;
  libraryPodcastsCount?: number;
  libraryAudiobooksCount?: number;
  libraryGenresCount?: number;
  isTouchscreen: boolean;
  deviceType: DeviceType;
  forceMobileLayout?: boolean;
  mobileLayout: boolean;
  currentUser?: User;
  serverInfo?: ServerInfoMessage;
  isIngressSession: boolean;
  isOnboarding: boolean;
  enabledPlugins: Set<string>;
  isPartyGuest: boolean;
  companionPlayerId?: string;
  navMenuEditMode: boolean;
}

export const store: Store = reactive({
  activePlayerId: undefined,
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
  activePlayerQueue: computed(() => resolvePlayerQueue(store.activePlayer)),
  curQueueItem: computed(() => {
    if (store.activePlayerQueue && store.activePlayerQueue.active)
      return store.activePlayerQueue.current_item ?? undefined;
    return undefined;
  }),
  globalSearchTerm: undefined,
  globalSearchMediaTypes: [],
  prevState: undefined,
  libraryArtistsCount: undefined,
  libraryAlbumsCount: undefined,
  libraryTracksCount: undefined,
  libraryPlaylistsCount: undefined,
  libraryRadiosCount: undefined,
  libraryGenresCount: undefined,
  isTouchscreen: isTouchscreenDevice(),
  playMenuShown: false,
  deviceType: DEVICE_TYPE,
  mobileLayout: computed(() => {
    const isTablet = getBreakpointValue({ breakpoint: "tablet" });

    return (
      isPhoneSizedScreen() || isTablet || parseBool(store.forceMobileLayout)
    );
  }),
  currentUser: undefined,
  serverInfo: undefined,
  isIngressSession: computed(() =>
    isHomeAssistantIngressSession(api.serverInfo.value),
  ),
  isOnboarding: false,
  enabledPlugins: new Set(),
  isPartyGuest: false,
  navMenuEditMode: false,
});
