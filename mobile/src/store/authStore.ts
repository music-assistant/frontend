import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {api} from '../api/client';
import {useApiStore} from './apiStore';
import type {User} from '../shared/types';

interface AuthState {
  user: User | null;
  token: string | null;
  serverAddress: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setServerAddress: (address: string | null) => void;
  login: (username: string, password: string, serverAddress: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

const TOKEN_KEY = '@music_assistant:token';
const SERVER_KEY = '@music_assistant:server';
const USER_KEY = '@music_assistant:user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  serverAddress: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    set({user, isAuthenticated: !!user});
    if (user) {
      AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      AsyncStorage.removeItem(USER_KEY);
    }
  },

  setToken: (token) => {
    set({token});
    if (token) {
      AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      AsyncStorage.removeItem(TOKEN_KEY);
    }
  },

  setServerAddress: (address) => {
    set({serverAddress: address});
    if (address) {
      AsyncStorage.setItem(SERVER_KEY, address);
    } else {
      AsyncStorage.removeItem(SERVER_KEY);
    }
  },

  login: async (username, password, serverAddress) => {
    try {
      set({isLoading: true});
      await api.initialize(serverAddress);
      const {token, user} = await api.loginWithCredentials(username, password);
      get().setToken(token);
      get().setUser(user);
      get().setServerAddress(serverAddress);
      // Initialize API store to listen for events
      useApiStore.getState().initialize();
      // Fetch initial state (providers and players)
      await api.fetchState();
    } catch (error) {
      set({isLoading: false});
      throw error;
    } finally {
      set({isLoading: false});
    }
  },

  logout: async () => {
    api.disconnect();
    get().setToken(null);
    get().setUser(null);
    get().setServerAddress(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, SERVER_KEY, USER_KEY]);
  },

  loadStoredAuth: async () => {
    try {
      set({isLoading: true});
      const [token, serverAddress, _userStr] = await AsyncStorage.multiGet([
        TOKEN_KEY,
        SERVER_KEY,
        USER_KEY,
      ]);

      if (token[1] && serverAddress[1]) {
        await api.initialize(serverAddress[1]);
        const {user} = await api.authenticateWithToken(token[1]);
        get().setToken(token[1]);
        get().setUser(user);
        get().setServerAddress(serverAddress[1]);
        // Initialize API store to listen for events
        useApiStore.getState().initialize();
        // Fetch initial state (providers and players)
        await api.fetchState();
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
      await get().logout();
    } finally {
      set({isLoading: false});
    }
  },
}));
