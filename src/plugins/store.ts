import type { Player, QueueItem } from './api/interfaces';
import { reactive } from 'vue';
import type { LocationQuery, RouteParams, RouteMeta } from 'vue-router';

import type { ContextMenuItem } from '@/helpers/contextmenu';
import { ColorCoverPalette } from '@/helpers/utils';

interface Store {
  selectedPlayer?: Player;
  currentItemType?: string;
  isInStandaloneMode: boolean;
  showPlayersMenu: boolean;
  showNavigationMenu: boolean;
  sizeNavigationMenu: number;
  showFullscreenPlayer: boolean;
  coverImageColorCode: ColorCoverPalette;
  alwaysShowMenuButton: boolean;
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
  currentItemType: undefined,
  isInStandaloneMode: false,
  showPlayersMenu: false,
  showNavigationMenu: true,
  sizeNavigationMenu: 300,
  showFullscreenPlayer: false,
  coverImageColorCode: {
    '0': '',
    '1': '',
    '2': '',
    '3': '',
    '4': '',
    '5': '',
    lightColor: '',
    darkColor: '',
  },
  alwaysShowMenuButton: false,
  apiInitialized: false,
  apiBaseUrl: '',
  dialogActive: false,
  prevRoutes: [],
});
