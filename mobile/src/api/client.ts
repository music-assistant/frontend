import {
  ConnectionState,
  type CommandMessage,
  type EventMessage,
  type Player,
  type ProviderInstance,
  type RecommendationFolder,
  type Artist,
  type Album,
  type Track,
  type Playlist,
  type Podcast,
  type Audiobook,
  type Radio,
  type SearchResults,
  type MediaType,
  EventType,
} from '../shared/types';

type EventListener = (...args: any[]) => void;

class SimpleEventEmitter {
  private events: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
      return true;
    }
    return false;
  }
}

export interface Transport extends SimpleEventEmitter {
  connect(): Promise<void>;
  disconnect(): void;
  send(data: string): void;
  isConnected(): boolean;
}

export class WebSocketTransport extends SimpleEventEmitter implements Transport {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string) {
    super();
    this.url = url;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.emit('open');
          resolve();
        };

        ws.onmessage = (event) => {
          this.emit('message', event.data);
        };

        ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

        ws.onclose = () => {
          this.ws = null;
          this.emit('close');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect().catch(() => {
          // Reconnection failed, will retry
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      this.emit('stateChange', 'failed');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export class MusicAssistantApi {
  private transport: Transport | null = null;
  private baseUrl: string = '';
  private commands: Map<
    string,
    {
      resolve: (result?: any) => void;
      reject: (err: any) => void;
    }
  > = new Map();
  public state: ConnectionState = ConnectionState.DISCONNECTED;
  public serverInfo: any = null;

  constructor() {}

  async initialize(serverAddress: string): Promise<void> {
    let wsUrl = serverAddress;
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = wsUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    }
    if (!wsUrl.endsWith('/ws')) {
      wsUrl += '/ws';
    }

    this.baseUrl = serverAddress.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '');

    const transport = new WebSocketTransport(wsUrl);
    this.transport = transport;

    transport.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        this.handleMessage(msg);
      } catch (error) {
        console.error('[API] Failed to parse message:', error);
      }
    });

    transport.on('open', () => {
      this.state = ConnectionState.CONNECTING;
    });

    transport.on('close', () => {
      this.state = ConnectionState.DISCONNECTED;
    });

    transport.on('error', (error) => {
      console.error('[API] Transport error:', error);
      this.state = ConnectionState.FAILED;
    });

    await transport.connect();
  }

  private handleMessage(msg: any): void {
    // Handle ServerInfo message
    if ('server_version' in msg && 'server_id' in msg && !('event' in msg)) {
      this.serverInfo = msg;
      this.state = ConnectionState.CONNECTED;
      this.emit('serverInfo', msg);
      return;
    }

    // Handle event messages
    if ('event' in msg) {
      const eventMsg = msg as EventMessage;
      this.emit('event', eventMsg);
      // Also emit specific event types for easier listening
      if (eventMsg.event) {
        this.emit(eventMsg.event, eventMsg);
      }
      return;
    }

    // Handle result messages
    if ('message_id' in msg) {
      this.handleResultMessage(msg);
      return;
    }

    console.error('[API] received unknown message', msg);
  }

  private handleResultMessage(msg: any): void {
    const resultPromise = this.commands.get(msg.message_id);

    if (!resultPromise) {return;}

    this.commands.delete(msg.message_id);

    if ('error_code' in msg) {
      resultPromise.reject(new Error(msg.details || msg.error_code));
    } else {
      resultPromise.resolve(msg.result);
    }
  }

  sendCommand<Result>(command: string, args?: Record<string, any>): Promise<Result> {
    const cmdId = this.generateCommandId();
    return new Promise((resolve, reject) => {
      this.commands.set(cmdId, {resolve, reject});

      const msg: CommandMessage = {
        command,
        message_id: cmdId,
        args,
      };

      if (!this.transport) {
        reject(new Error('No connection available'));
        return;
      }

      try {
        this.transport.send(JSON.stringify(msg));
      } catch (error) {
        this.commands.delete(cmdId);
        reject(error);
      }
    });
  }

  async loginWithCredentials(
    username: string,
    password: string,
    deviceName?: string,
  ): Promise<{token: string; user: any}> {
    this.state = ConnectionState.AUTHENTICATING;
    const result = await this.sendCommand<{
      access_token?: string;
      token?: string;
      user?: any;
      success?: boolean;
      error?: string;
    }>('auth/login', {
      username,
      password,
      device_name: deviceName || 'Music Assistant Mobile',
    });

    if (result.success === false || result.error) {
      this.state = ConnectionState.AUTH_REQUIRED;
      throw new Error(result.error || 'Invalid credentials');
    }

    const token = result.access_token || result.token;
    if (token) {
      await this.sendCommand('auth', {token});
      this.state = ConnectionState.AUTHENTICATED;
    }

    return {token: token || '', user: result.user!};
  }

  async authenticateWithToken(token: string): Promise<{user: any}> {
    this.state = ConnectionState.AUTHENTICATING;
    try {
      const result = await this.sendCommand<{user: any}>('auth', {
        token,
        device_name: 'Music Assistant Mobile',
      });

      if (result.user) {
        this.state = ConnectionState.AUTHENTICATED;
      }

      return result;
    } catch (error) {
      this.state = ConnectionState.AUTH_REQUIRED;
      throw error;
    }
  }

  async getPlayers(): Promise<Player[]> {
    return this.sendCommand<Player[]>('players/all');
  }

  async getProviders(): Promise<ProviderInstance[]> {
    return this.sendCommand<ProviderInstance[]>('providers');
  }

  async getRecommendations(): Promise<RecommendationFolder[]> {
    return this.sendCommand<RecommendationFolder[]>('music/recommendations');
  }

  async getLibraryArtists(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    album_artists_only?: boolean,
    provider?: string | string[],
  ): Promise<Artist[]> {
    return this.sendCommand<Artist[]>('music/artists/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
      album_artists_only,
      provider,
    });
  }

  async getLibraryAlbums(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    album_type?: string,
    provider?: string | string[],
  ): Promise<Album[]> {
    return this.sendCommand<Album[]>('music/albums/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
      album_type,
      provider,
    });
  }

  async getLibraryTracks(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
  ): Promise<Track[]> {
    return this.sendCommand<Track[]>('music/tracks/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
    });
  }

  async getLibraryPlaylists(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
  ): Promise<Playlist[]> {
    return this.sendCommand<Playlist[]>('music/playlists/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
    });
  }

  async getLibraryPodcasts(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
  ): Promise<Podcast[]> {
    return this.sendCommand<Podcast[]>('music/podcasts/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
    });
  }

  async getLibraryAudiobooks(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
  ): Promise<Audiobook[]> {
    return this.sendCommand<Audiobook[]>('music/audiobooks/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
    });
  }

  async getLibraryRadios(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
  ): Promise<Radio[]> {
    return this.sendCommand<Radio[]>('music/radios/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
    });
  }

  async search(
    search_query: string,
    media_types?: MediaType[],
    limit?: number,
  ): Promise<SearchResults> {
    return this.sendCommand<SearchResults>('music/search', {
      search_query,
      media_types,
      limit,
    });
  }

  async browse(path?: string): Promise<MediaItem[]> {
    return this.sendCommand<MediaItem[]>('music/browse', {path});
  }

  async fetchState(): Promise<void> {
    try {
      // Fetch providers
      const providers = await this.getProviders();
      console.log('[API] Fetched providers:', providers.length);
      this.emit('event', {
        event: EventType.PROVIDERS_UPDATED,
        data: providers,
      });

      // Fetch players
      const players = await this.getPlayers();
      console.log('[API] Fetched players:', players.length);
      for (const player of players) {
        this.emit('event', {
          event: EventType.PLAYER_ADDED,
          data: player,
        });
      }
    } catch (error) {
      console.error('[API] Failed to fetch state:', error);
    }
  }

  disconnect(): void {
    if (this.transport) {
      this.transport.disconnect();
      this.transport = null;
    }
    this.state = ConnectionState.DISCONNECTED;
  }

  private generateCommandId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // EventEmitter methods - delegate to transport
  on(event: string, listener: (...args: any[]) => void): this {
    if (this.transport) {
      this.transport.on(event, listener);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (this.transport) {
      return this.transport.emit(event, ...args);
    }
    return false;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    if (this.transport) {
      this.transport.off(event, listener);
    }
    return this;
  }
}

export const api = new MusicAssistantApi();
