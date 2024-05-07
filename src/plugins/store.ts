import { computed, reactive, ref } from 'vue';
import { Player, PlayerQueue, QueueItem } from './api/interfaces';
import api from './api';

export enum AlertType {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  SUCCESS = 'success',
}

interface Alert {
  type: AlertType;
  message: string;
  persistent: boolean;
}

interface Store {
  selectedPlayerId?: string;
  isInStandaloneMode: boolean;
  showPlayersMenu: boolean;
  navigationMenuStyle: string;
  navigationMenuSize: number;
  showFullscreenPlayer: boolean;
  apiInitialized: boolean;
  apiBaseUrl: string;
  dialogActive: boolean;
  selectedPlayer?: Player;
  activePlayerQueue?: PlayerQueue;
  curQueueItem?: QueueItem;
  globalSearchTerm?: string;
  prevScrollPos: Record<string, number>;
  allowExternalImageRetrieval: boolean;
  activeAlert?: Alert;
}

export const store: Store = reactive({
  selectedPlayerId: undefined,
  isInStandaloneMode: false,
  showPlayersMenu: false,
  navigationMenuStyle: 'horizontal',
  navigationMenuSize: 300,
  showFullscreenPlayer: false,
  apiInitialized: false,
  apiBaseUrl: '',
  dialogActive: false,
  selectedPlayer: computed(() => {
    if (store.selectedPlayerId && store.selectedPlayerId in api.players) {
      return api.players[store.selectedPlayerId];
    }
    return undefined;
  }),
  activePlayerQueue: computed(() => {
    if (
      store.selectedPlayer &&
      store.selectedPlayer.active_source in api.queues
    ) {
      return api.queues[store.selectedPlayer.active_source];
    }
    if (store.selectedPlayer && store.selectedPlayer.player_id in api.queues) {
      return api.queues[store.selectedPlayer.player_id];
    }
    return undefined;
  }),
  curQueueItem: computed(() => {
    if (store.activePlayerQueue && store.activePlayerQueue.active)
      return store.activePlayerQueue.current_item;
    return undefined;
  }),
  globalSearchTerm: undefined,
  prevScrollPos: {},
  allowExternalImageRetrieval: true,
  activeAlert: undefined,
});
