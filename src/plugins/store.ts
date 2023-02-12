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
  showSettings: boolean;
  showTabsNav: boolean;
  getDisplaySize: { height: number; width: number };
  darkTheme: boolean;
  topBarTitle?: string;
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
  showSettings: true,
  showTabsNav: true,
  getDisplaySize: { height: 0, width: 0 },
  darkTheme: false,
  defaultTopBarTitle: 'Music Assistant',
  topBarContextMenuItems: [],
  blockGlobalPlayMenu: false,
  alwaysShowMenuButton: false,
  apiInitialized: false,
  apiBaseUrl: '',
  prevRoutes: [],
  prevVolume: [],
});
