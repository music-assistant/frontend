import type { Player } from './api';
import { reactive } from 'vue';
import type { LocationQuery, RouteParams, RouteMeta } from 'vue-router';

import type { ContextMenuItem } from '../components/MediaItemContextMenu.vue';

interface Store {
  selectedPlayer?: Player;
  isInStandaloneMode: boolean;
  showPlayersMenu: boolean;
  showFullscreenPlayer: boolean;
  showContextMenu: boolean;
  showBackgroundJobs: boolean;
  darkTheme: boolean;
  topBarTitle?: string;
  topBarHeight: number;
  defaultTopBarTitle: string;
  topBarContextMenuItems: ContextMenuItem[];
  blockGlobalPlayMenu: boolean;
  alwaysShowMenuButton: boolean;
  apiInitialized: boolean;
  apiBaseUrl: string;
  prevRoutes: Array<{
    name: string;
    params: RouteParams;
    query: LocationQuery;
    meta: RouteMeta;
  }>;
  prevVolume: Array<{
    playerId: string;
    playerVolume: number;
  }>;
}

export const store: Store = reactive({
  selectedPlayer: undefined,
  isInStandaloneMode: false,
  showPlayersMenu: false,
  showFullscreenPlayer: false,
  showContextMenu: false,
  showBackgroundJobs: false,
  darkTheme: false,
  topBarHeight: 55,
  defaultTopBarTitle: 'Music Assistant',
  topBarContextMenuItems: [],
  blockGlobalPlayMenu: false,
  alwaysShowMenuButton: false,
  apiInitialized: false,
  apiBaseUrl: '',
  prevRoutes: [],
  prevVolume: [],
});
