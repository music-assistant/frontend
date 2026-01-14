import {create} from 'zustand';
import {api} from '../api/client';
import type {EventMessage, Player, ProviderInstance} from '../shared/types';
import {EventType} from '../shared/types';

interface ApiState {
  players: Record<string, Player>;
  providers: Record<string, ProviderInstance>;
  initialized: boolean;
  playersList: Player[];
  providersList: ProviderInstance[];
  setPlayers: (players: Record<string, Player>) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setProviders: (providers: ProviderInstance[]) => void;
  initialize: () => void;
}

export const useApiStore = create<ApiState>((set, get) => ({
  players: {},
  providers: {},
  initialized: false,
  playersList: [],
  providersList: [],

  setPlayers: (players) =>
    set({
      players,
      playersList: Object.values(players),
    }),

  addPlayer: (player) =>
    set((state) => {
      const newPlayers = {...state.players, [player.player_id]: player};
      return {
        players: newPlayers,
        playersList: Object.values(newPlayers),
      };
    }),

  updatePlayer: (player) =>
    set((state) => {
      const newPlayers = {
        ...state.players,
        [player.player_id]: {...state.players[player.player_id], ...player},
      };
      return {
        players: newPlayers,
        playersList: Object.values(newPlayers),
      };
    }),

  removePlayer: (playerId) =>
    set((state) => {
      const players = Object.fromEntries(
        Object.entries(state.players).filter(([id]) => id !== playerId),
      );
      return {
        players,
        playersList: Object.values(players),
      };
    }),

  setProviders: (providers) =>
    set({
      providers: providers.reduce(
        (acc, provider) => {
          acc[provider.instance_id] = provider;
          return acc;
        },
        {} as Record<string, ProviderInstance>,
      ),
      providersList: providers,
    }),

  initialize: () => {
    if (get().initialized) {return;}

    // Listen to API events
    api.on('event', (msg: EventMessage) => {
      const {event, data, object_id} = msg;

      switch (event) {
        case EventType.PLAYER_ADDED:
          get().addPlayer(data as Player);
          break;
        case EventType.PLAYER_UPDATED:
          get().updatePlayer(data as Player);
          break;
        case EventType.PLAYER_REMOVED:
          get().removePlayer(object_id!);
          break;
        case EventType.PROVIDERS_UPDATED:
          get().setProviders(data as ProviderInstance[]);
          break;
      }
    });

    set({initialized: true});
  },
}));
