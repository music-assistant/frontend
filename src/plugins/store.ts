import type { Player } from './api/interfaces';
import { reactive } from 'vue';
import type { LocationQuery, RouteParams, RouteMeta } from 'vue-router';

interface Store {
  selectedPlayer?: Player;
  isInStandaloneMode: boolean;
  showPlayersMenu: boolean;
  navigationMenuSize: number;
  showFullscreenPlayer: boolean;
  apiInitialized: boolean;
  apiBaseUrl: string;
  dialogActive: boolean;
  prevRoutes: Array<{
    name: string;
    path: string;
    params: RouteParams;
    query: LocationQuery;
    meta: RouteMeta;
  }>;
}

export const store: Store = reactive({
  selectedPlayer: undefined,
  isInStandaloneMode: false,
  showPlayersMenu: false,
  navigationMenuSize: 300,
  showFullscreenPlayer: false,
  apiInitialized: false,
  apiBaseUrl: '',
  dialogActive: false,
  prevRoutes: [],
});
