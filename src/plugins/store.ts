import { computed, reactive, ref } from 'vue';
import { Player, PlayerQueue, QueueItem } from './api/interfaces';
import api from './api';

interface Store {
  selectedPlayerId?: string;
  isInStandaloneMode: boolean;
  showPlayersMenu: boolean;
  navigationMenuSize: number;
  showFullscreenPlayer: boolean;
  apiInitialized: boolean;
  apiBaseUrl: string;
  dialogActive: boolean;
  prevScrollPos?: number;
  prevScrollName?: string;
  selectedPlayer?: Player;
  activePlayerQueue?: PlayerQueue;
  curQueueItem?: QueueItem;
}

export const store: Store = reactive({
  selectedPlayerId: undefined,
  isInStandaloneMode: false,
  showPlayersMenu: false,
  navigationMenuSize: 300,
  showFullscreenPlayer: false,
  apiInitialized: false,
  apiBaseUrl: '',
  dialogActive: false,
  prevScrollPos: undefined,
  prevScrollName: undefined,
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
    if (store.activePlayerQueue) return store.activePlayerQueue.current_item;
    return undefined;
  }),
});
