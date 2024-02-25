import { computed, reactive, ref } from 'vue';
import { Player } from './api/interfaces';
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
});
