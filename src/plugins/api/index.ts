import { store } from "../store";
/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, reactive, ref } from "vue";
import { toast } from "vue-sonner";
import type { ITransport } from "../remote/transport";
import { WebSocketTransport } from "../remote/websocket-transport";
import { getDeviceName } from "./helpers";
import {
  type Album,
  type Artist,
  type AuthToken,
  type CommandMessage,
  type ErrorResultMessage,
  type EventMessage,
  type Genre,
  type MassEvent,
  type MediaItemType,
  type Player,
  type PlayerQueue,
  type Playlist,
  type ProviderInstance,
  type QueueItem,
  type Radio,
  type ServerInfoMessage,
  type SuccessResultMessage,
  type PlayerOptionValueType,
  type SyncTask,
  type Track,
  type User,
  AlbumType,
  Audiobook,
  AuthProvider,
  ConfigEntry,
  ConfigValueType,
  CoreConfig,
  DSPConfig,
  DSPConfigPreset,
  EventType,
  ItemMapping,
  MediaItemTypeOrItemMapping,
  MediaType,
  PlayableMediaItemType,
  PlayerConfig,
  Podcast,
  PodcastEpisode,
  ProviderConfig,
  ProviderManifest,
  ProviderType,
  QueueOption,
  RecommendationFolder,
  RemoteAccessInfo,
  RepeatMode,
  SearchResults,
  UserRole,
} from "./interfaces";

const DEBUG = process.env.NODE_ENV === "development";

export enum ConnectionState {
  DISCONNECTED = "disconnected", // Not connected
  CONNECTING = "connecting", // Establishing connection
  CONNECTED = "connected", // Transport connected, ServerInfo received
  AUTH_REQUIRED = "auth_required", // Connected but needs authentication (no stored token or auto-auth failed)
  AUTHENTICATING = "authenticating", // Authentication in progress
  AUTHENTICATED = "authenticated", // Fully authenticated, ready to fetch state
  INITIALIZED = "initialized", // Initial state sync completed
  RECONNECTING = "reconnecting", // Lost connection, attempting to reconnect
  FAILED = "failed", // Connection failed permanently
}

export class MusicAssistantApi {
  private transport?: ITransport;
  private _throttleId?: any;
  public baseUrl?: string; // HTTP base URL for image proxy etc.
  public isRemoteConnection = ref<boolean>(false);
  public state = ref<ConnectionState>(ConnectionState.DISCONNECTED);
  public transportState = ref<string>("disconnected");
  public serverInfo = ref<ServerInfoMessage>();
  public players = reactive<{ [player_id: string]: Player }>({});
  public queues = reactive<{ [queue_id: string]: PlayerQueue }>({});
  public providers = reactive<{ [instance_id: string]: ProviderInstance }>({});
  public providerManifests = reactive<{ [domain: string]: ProviderManifest }>(
    {},
  );
  public syncTasks = ref<SyncTask[]>([]);
  public hasStreamingProviders = computed(() => {
    return Object.values(this.providers).some((p) => p.is_streaming_provider);
  });
  private eventCallbacks: Array<[EventType, string, CallableFunction]>;
  private partialResult: { [msg_id: string]: Array<any> };
  private commands: Map<
    string,
    {
      resolve: (result?: any) => void;
      reject: (err: any) => void;
    }
  >;

  constructor() {
    this.eventCallbacks = [];
    this.commands = new Map();
    this.partialResult = {};
  }

  /**
   * Initialize the API with either a server address or a transport
   * @param transportOrAddress - Either an ITransport instance or a server address string
   * @param baseUrl - Optional HTTP base URL (required for WebRTC, derived automatically for server address)
   */
  public async initialize(
    transportOrAddress: ITransport | string,
    baseUrl?: string,
  ): Promise<void> {
    if (this.transport) throw new Error("already initialized");

    let transport: ITransport;
    let isRemote = false;

    // If string, create WebSocketTransport
    if (typeof transportOrAddress === "string") {
      let serverAddress = transportOrAddress;
      if (serverAddress.endsWith("/"))
        serverAddress = serverAddress.slice(0, -1);

      // Normalize the server address
      let httpBaseUrl: string;
      let wsUrl: string;

      if (
        serverAddress.startsWith("ws://") ||
        serverAddress.startsWith("wss://")
      ) {
        wsUrl = serverAddress;
        httpBaseUrl = serverAddress
          .replace("wss://", "https://")
          .replace("ws://", "http://");
        if (httpBaseUrl.endsWith("/ws")) {
          httpBaseUrl = httpBaseUrl.slice(0, -3);
        }
      } else {
        httpBaseUrl = serverAddress;
        wsUrl = serverAddress
          .replace("https://", "wss://")
          .replace("http://", "ws://");
      }

      if (!wsUrl.endsWith("/ws")) {
        wsUrl += "/ws";
      }

      transport = new WebSocketTransport({ url: wsUrl });
      await transport.connect();
      baseUrl = httpBaseUrl;
    } else {
      // Transport instance provided (WebRTC)
      transport = transportOrAddress;
      isRemote = true;
    }

    this.transport = transport;
    this.baseUrl = baseUrl || "";
    this.isRemoteConnection.value = isRemote;
    this.state.value = ConnectionState.CONNECTING;

    // Set up transport message handler
    transport.on("message", (data: string) => {
      try {
        const msg = JSON.parse(data);
        this.handleMessage(msg);
      } catch (error) {
        console.error("[API] Failed to parse message:", error);
      }
    });

    transport.on("close", () => {
      // Don't immediately emit DISCONNECTED - wait for stateChange
      // to see if we're reconnecting or truly disconnected
    });

    transport.on("error", (error: Error) => {
      console.error("[API] Transport error:", error);
    });

    // Listen for transport state changes (reconnecting, failed, etc.)
    transport.on("stateChange", (state) => {
      console.log("[API] Transport state changed to:", state);
      this.transportState.value = state;

      // Handle specific state transitions
      if (state === "reconnecting") {
        // Transport is attempting to reconnect
        this.state.value = ConnectionState.RECONNECTING;
        this.signalEvent({
          event: EventType.DISCONNECTED,
          object_id: "",
        });
      } else if (state === "failed") {
        // Failed could be transient (during reconnect) or permanent
        // Wait to see if it transitions to reconnecting or stays failed
        setTimeout(() => {
          if (this.transportState.value === "failed") {
            // Still failed after brief wait - this is permanent failure
            this.state.value = ConnectionState.FAILED;
            this.signalEvent({
              event: EventType.DISCONNECTED,
              object_id: "",
            });
          }
          // Otherwise it transitioned to reconnecting - ignore this transient failure
        }, 50);
      } else if (state === "disconnected") {
        // Check if this is an intentional disconnect (not followed by reconnecting)
        // Use nextTick to allow reconnecting state to be set first
        setTimeout(() => {
          if (this.transportState.value === "disconnected") {
            this.state.value = ConnectionState.DISCONNECTED;
            this.signalEvent({
              event: EventType.DISCONNECTED,
              object_id: "",
            });
          }
        }, 0);
      }
    });

    // Wait for initial ServerInfo message
    await this.waitForServerInfo();
  }

  /**
   * Handle incoming message from the transport
   */
  private handleMessage(msg: any): void {
    // Handle ServerInfo message (sent on connection and reconnection)
    if ("server_version" in msg && "server_id" in msg && !("event" in msg)) {
      this.handleServerInfoMessage(msg as ServerInfoMessage);
      return;
    }

    // Handle event messages
    if ("event" in msg) {
      this.handleEventMessage(msg as EventMessage);
      return;
    }

    // Handle result messages
    if ("message_id" in msg) {
      this.handleResultMessage(msg);
      return;
    }

    console.error("[API] received unknown message", msg);
  }

  /**
   * Wait for ServerInfo message with timeout
   */
  private waitForServerInfo(timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for ServerInfo"));
      }, timeoutMs);

      // Check if already have server info
      if (this.serverInfo.value) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      // Listen for server info via event
      const unsubscribe = this.subscribe(EventType.CONNECTED, () => {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });
    });
  }

  /**
   * Authenticate with username and password
   * Returns the auth token on success
   */
  public async loginWithCredentials(
    username: string,
    password: string,
    deviceName?: string,
  ): Promise<{ token: string; user: User }> {
    // Mark as authenticating
    this.state.value = ConnectionState.AUTHENTICATING;

    const result = await this.sendCommand<{
      access_token?: string;
      token?: string;
      user?: User;
      success?: boolean;
      error?: string;
    }>("auth/login", {
      username,
      password,
      device_name: deviceName || getDeviceName(),
    });

    // Check if login failed
    if (result.success === false || result.error) {
      // Login failed - require authentication again
      this.state.value = ConnectionState.AUTH_REQUIRED;
      throw new Error(result.error || "Invalid credentials");
    }

    // Server may return 'access_token' or 'token'
    const token = result.access_token || result.token;

    if (token) {
      await this.sendCommand("auth", { token });
      this.state.value = ConnectionState.AUTHENTICATED;
    }

    return { token: token || "", user: result.user! };
  }

  /**
   * Authenticate with an existing token
   */
  public async authenticateWithToken(
    token: string,
    deviceName?: string,
  ): Promise<{ user: User }> {
    // Mark as authenticating
    this.state.value = ConnectionState.AUTHENTICATING;

    try {
      const result = await this.sendCommand<{ user: User }>("auth", {
        token,
        device_name: deviceName || getDeviceName(),
      });

      if (result.user) {
        this.state.value = ConnectionState.AUTHENTICATED;
      }

      return result;
    } catch (error) {
      // Token is invalid - require user authentication
      this.state.value = ConnectionState.AUTH_REQUIRED;
      throw error;
    }
  }

  /**
   * Set state to AUTH_REQUIRED when no token is available for auto-authentication
   */
  public requireAuthentication(): void {
    if (this.state.value === ConnectionState.CONNECTED) {
      this.state.value = ConnectionState.AUTH_REQUIRED;
    }
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.transport) {
      this.transport.disconnect();
      this.transport = undefined;
    }
    this.state.value = ConnectionState.DISCONNECTED;
    this.isRemoteConnection.value = false;

    // Clear reactive state
    Object.keys(this.players).forEach((key) => delete this.players[key]);
    Object.keys(this.queues).forEach((key) => delete this.queues[key]);
    Object.keys(this.providers).forEach((key) => delete this.providers[key]);
    Object.keys(this.providerManifests).forEach(
      (key) => delete this.providerManifests[key],
    );
    this.syncTasks.value = [];
    this.serverInfo.value = undefined;
  }

  public subscribe(
    eventFilter: EventType,
    callback: CallableFunction,
    object_id: string = "*",
  ) {
    // subscribe a listener for events
    // returns handle to remove the listener
    const listener: [EventType, string, CallableFunction] = [
      eventFilter,
      object_id,
      callback,
    ];
    this.eventCallbacks.push(listener);
    const removeCallback = () => {
      const index = this.eventCallbacks.indexOf(listener);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
    return removeCallback;
  }

  public subscribe_multi(
    eventFilters: EventType[],
    callback: CallableFunction,
    object_id: string = "*",
  ) {
    // subscribe a listener for multiple events
    // returns handle to remove the listener
    const removeCallbacks: CallableFunction[] = [];
    for (const eventFilter of eventFilters) {
      removeCallbacks.push(this.subscribe(eventFilter, callback, object_id));
    }
    const removeCallback = () => {
      for (const cb of removeCallbacks) {
        cb();
      }
    };
    return removeCallback;
  }

  /**
   * Get Track listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of tracks
   */
  public getLibraryTracks(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
    genre?: number | number[],
  ): Promise<Track[]> {
    return this.sendCommand("music/tracks/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
      genre,
    });
  }

  public getTrack(
    item_id: string,
    provider_instance_id_or_domain: string,
    album_uri?: string,
  ): Promise<Track> {
    return this.sendCommand("music/tracks/get_track", {
      item_id,
      provider_instance_id_or_domain,
      album_uri: album_uri,
    });
  }

  public getTrackVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Track[]> {
    return this.sendCommand("music/tracks/track_versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getTrackAlbums(
    item_id: string,
    provider_instance_id_or_domain: string,
    in_library_only = false,
  ): Promise<Album[]> {
    return this.sendCommand("music/tracks/track_albums", {
      item_id,
      provider_instance_id_or_domain,
      in_library_only,
    });
  }

  public getTrackPreviewUrl(
    provider_instance_id_or_domain: string,
    item_id: string,
  ): string {
    const encItemId = encodeURIComponent(encodeURIComponent(item_id));
    return `${this.baseUrl}/preview?item_id=${encItemId}&provider=${provider_instance_id_or_domain}`;
  }

  public getLibraryArtistsCount(
    favorite_only: boolean = false,
    album_artists_only: boolean = false,
  ): Promise<number> {
    return this.sendCommand("music/artists/count", {
      favorite_only,
      album_artists_only,
    });
  }
  public getLibraryAlbumsCount(
    favorite_only: boolean = false,
    album_types?: Array<AlbumType | string>,
  ): Promise<number> {
    return this.sendCommand("music/albums/count", {
      favorite_only,
      album_types,
    });
  }
  public getLibraryTracksCount(
    favorite_only: boolean = false,
  ): Promise<number> {
    return this.sendCommand("music/tracks/count", { favorite_only });
  }
  public getLibraryPlaylistsCount(
    favorite_only: boolean = false,
  ): Promise<number> {
    return this.sendCommand("music/playlists/count", { favorite_only });
  }
  public getLibraryRadiosCount(
    favorite_only: boolean = false,
  ): Promise<number> {
    return this.sendCommand("music/radios/count", { favorite_only });
  }

  public getLibraryPodcastsCount(
    favorite_only: boolean = false,
  ): Promise<number> {
    return this.sendCommand("music/podcasts/count", { favorite_only });
  }

  public getLibraryAudiobooksCount(
    favorite_only: boolean = false,
  ): Promise<number> {
    return this.sendCommand("music/audiobooks/count", { favorite_only });
  }

  public getLibraryGenresCount(
    favorite_only: boolean = false,
  ): Promise<number> {
    return this.sendCommand("music/genres/count", { favorite_only });
  }

  /**
   * Get Artists listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param album_artists_only - Only return artists that have albums
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of artists
   */
  public getLibraryArtists(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    album_artists_only?: boolean,
    provider?: string | string[],
    genre?: number | number[],
  ): Promise<Artist[]> {
    return this.sendCommand("music/artists/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      album_artists_only,
      provider,
      genre,
    });
  }

  public getArtist(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Artist> {
    return this.sendCommand("music/artists/get_artist", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getArtistTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
    in_library_only = false,
    provider_filter?: string[],
  ): Promise<Track[]> {
    return this.sendCommand("music/artists/artist_tracks", {
      item_id,
      provider_instance_id_or_domain,
      in_library_only,
      provider_filter,
    });
  }

  public getArtistAlbums(
    item_id: string,
    provider_instance_id_or_domain: string,
    in_library_only = false,
  ): Promise<Album[]> {
    return this.sendCommand("music/artists/artist_albums", {
      item_id,
      provider_instance_id_or_domain,
      in_library_only,
    });
  }

  /**
   * Get Albums listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param album_types - Filter by album types
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of albums
   */
  public getLibraryAlbums(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    album_types?: Array<AlbumType | string>,
    provider?: string | string[],
    genre?: number | number[],
  ): Promise<Album[]> {
    return this.sendCommand("music/albums/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      album_types,
      provider,
      genre,
    });
  }

  public getAlbum(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Album> {
    return this.sendCommand("music/albums/get_album", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getAlbumTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
    in_library_only = false,
  ): Promise<Track[]> {
    return this.sendCommand("music/albums/album_tracks", {
      item_id,
      provider_instance_id_or_domain,
      in_library_only,
    });
  }

  public getAlbumVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Album[]> {
    return this.sendCommand("music/albums/album_versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  /**
   * Get Playlists listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of playlists
   */
  public getLibraryPlaylists(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
    genre?: number | number[],
  ): Promise<Playlist[]> {
    return this.sendCommand("music/playlists/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
      genre,
    });
  }

  public getPlaylist(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Playlist> {
    return this.sendCommand("music/playlists/get_playlist", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getPlaylistTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
  ): Promise<(Track | Radio | PodcastEpisode | Audiobook)[]> {
    return this.sendCommand("music/playlists/playlist_tracks", {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
    });
  }

  public addPlaylistTracks(
    db_playlist_id: string | number,
    uris: string[],
  ): Promise<void> {
    return this.sendCommand("music/playlists/add_playlist_tracks", {
      db_playlist_id,
      uris,
    });
  }

  public removePlaylistTracks(
    db_playlist_id: string | number,
    positions_to_remove: number[],
  ): Promise<void> {
    return this.sendCommand("music/playlists/remove_playlist_tracks", {
      db_playlist_id,
      positions_to_remove,
    });
  }

  public createPlaylist(
    name: string,
    provider_instance_or_domain?: string,
  ): Promise<Playlist> {
    return this.sendCommand("music/playlists/create_playlist", {
      name,
      provider_instance_or_domain,
    });
  }

  /**
   * Get Radio stations listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of radio stations
   */
  public getLibraryRadios(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
    genre?: number | number[],
  ): Promise<Radio[]> {
    return this.sendCommand("music/radios/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
      genre,
    });
  }

  public getRadio(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Radio> {
    return this.sendCommand("music/radios/get_radio", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getRadioVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Radio[]> {
    return this.sendCommand("music/radios/radio_versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  // Audiobook related endpoints
  /**
   * Get Audiobooks listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of audiobooks
   */
  public getLibraryAudiobooks(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
    genre?: number | number[],
  ): Promise<Audiobook[]> {
    return this.sendCommand("music/audiobooks/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
      genre,
    });
  }

  public getAudiobook(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Audiobook> {
    return this.sendCommand("music/audiobooks/get_audiobook", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getAudiobookVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Audiobook[]> {
    return this.sendCommand("music/audiobooks/audiobook_versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  // Podcast related endpoints
  /**
   * Get Podcasts listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of podcasts
   */
  public getLibraryPodcasts(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
    genre?: number | number[],
  ): Promise<Podcast[]> {
    return this.sendCommand("music/podcasts/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
      genre,
    });
  }

  /**
   * Get Genres listing from the server.
   * @param favorite - Filter by favorite status
   * @param search - Filter by search query
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @param order_by - Order by field (e.g. 'sort_name', 'timestamp_added')
   * @param provider - Filter by provider instance ID or domain (single string or list)
   * @returns Promise resolving to array of genres
   */
  public getLibraryGenres(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    provider?: string | string[],
    genre?: number | number[],
    hide_empty?: boolean,
  ): Promise<Genre[]> {
    return this.sendCommand("music/genres/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      provider,
      genre,
      hide_empty,
    });
  }

  public getGenre(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Genre> {
    return this.sendCommand("music/genres/get", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public addGenreToLibrary(
    item: Partial<Genre>,
    overwrite_existing = false,
  ): Promise<Genre> {
    return this.sendCommand("music/genres/add", {
      item,
      overwrite_existing,
    });
  }

  public removeGenreFromLibrary(item_id: string): Promise<void> {
    return this.sendCommand("music/genres/remove", {
      item_id,
    });
  }

  public restoreGenreDefaults(fullRestore = false): Promise<Genre[]> {
    return this.sendCommand("music/genres/restore_defaults", {
      full_restore: fullRestore,
    });
  }

  public getGenreScannerStatus(): Promise<{
    running: boolean;
    last_scan_time: number;
    last_scan_ago_seconds: number | null;
    last_scan_mapped: number | null;
  }> {
    return this.sendCommand("music/genres/scanner_status");
  }

  public triggerGenreScan(): Promise<{
    status: "triggered" | "already_running";
    message: string;
    last_scan: number;
  }> {
    return this.sendCommand("music/genres/scan_mappings");
  }

  public addGenreAlias(genre_id: string, alias: string): Promise<Genre> {
    return this.sendCommand("music/genres/add_alias", {
      genre_id,
      alias,
    });
  }

  public removeGenreAlias(genre_id: string, alias: string): Promise<Genre> {
    return this.sendCommand("music/genres/remove_alias", {
      genre_id,
      alias,
    });
  }

  public promoteGenreAlias(genre_id: string, alias: string): Promise<Genre> {
    return this.sendCommand("music/genres/promote_alias", {
      genre_id,
      alias,
    });
  }

  public getGenresForMediaItem(
    media_type: string,
    media_id: string,
  ): Promise<Genre[]> {
    return this.sendCommand("music/genres/genres_for_media_item", {
      media_type,
      media_id,
    });
  }

  public mergeGenres(
    genre_ids: string[],
    target_genre_id: string,
  ): Promise<Genre> {
    return this.sendCommand("music/genres/merge", {
      genre_ids,
      target_genre_id,
    });
  }

  public addGenreMediaMapping(
    genre_id: string,
    media_type: string,
    media_id: string,
  ): Promise<void> {
    return this.sendCommand("music/genres/add_media_mapping", {
      genre_id,
      media_type,
      media_id,
    });
  }

  public async getGenreOverviewRows(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<RecommendationFolder[]> {
    return this.sendCommand("music/genres/overview", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getGenreRadioBaseTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Track[]> {
    return this.sendCommand("music/genres/radio_mode_base_tracks", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getPodcast(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Podcast> {
    return this.sendCommand("music/podcasts/get_podcast", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public gePodcastVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Podcast[]> {
    return this.sendCommand("music/podcasts/podcast_versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getPodcastEpisodes(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<PodcastEpisode[]> {
    return this.sendCommand("music/podcasts/podcast_episodes", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getItemByUri(uri: string): Promise<MediaItemType> {
    // Get single music item providing a mediaitem uri.
    return this.sendCommand("music/item_by_uri", {
      uri,
    });
  }

  public refreshItem(
    media_item: MediaItemType | ItemMapping,
  ): Promise<MediaItemType> {
    // Try to refresh a mediaitem by requesting it's full object or search for substitutes.
    return this.sendCommand("music/refresh_item", {
      media_item,
    });
  }

  public updateMetadata(
    item: MediaItemType | ItemMapping | string,
    force_refresh = false,
  ): Promise<MediaItemType> {
    // Update an item's (extra) metadata.
    return this.sendCommand("metadata/update_metadata", {
      item,
      force_refresh,
    });
  }

  public getTrackLyrics(track: Track): Promise<[string | null, string | null]> {
    // Get lyrics for a track.
    // Returns a tuple of (lyrics, lrc_lyrics) - plain text and synced lyrics.
    return this.sendCommand("metadata/get_track_lyrics", {
      track,
    });
  }

  public getItem(
    media_type: MediaType,
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<MediaItemType> {
    // Get single music item by id and media type.
    return this.sendCommand("music/item", {
      media_type,
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getLibraryItem(
    media_type: MediaType,
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<MediaItemType | null> {
    // Get single music item by id and media type.
    return this.sendCommand("music/get_library_item", {
      media_type,
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public async addItemToLibrary(
    item: string | MediaItemType | ItemMapping,
    overwrite_existing = false,
  ): Promise<void> {
    // Add an item (uri or mediaitem) to the library.
    return this.sendCommand("music/library/add_item", {
      item,
      overwrite_existing,
    });
  }

  public async removeItemFromLibrary(
    media_type: MediaType,
    library_item_id: string | number,
  ): Promise<void> {
    // Remove an item from the library.
    return this.sendCommand("music/library/remove_item", {
      media_type,
      library_item_id,
    });
  }

  public async addItemToFavorites(
    item: string | MediaItemType | ItemMapping,
  ): Promise<void> {
    // optimistically set the value
    if (typeof item !== "string" && "favorite" in item) {
      item.favorite = true;
    }
    // Add an item (uri or mediaitem) to the favorites.
    return this.sendCommand("music/favorites/add_item", {
      item,
    });
  }
  public async removeItemFromFavorites(
    media_type: MediaType,
    library_item_id: string | number,
  ): Promise<void> {
    // Add an item (uri or mediaitem) to the favorites.
    return this.sendCommand("music/favorites/remove_item", {
      media_type,
      library_item_id,
    });
  }

  public toggleFavorite(item: MediaItemType) {
    // Toggle favorite for a media item
    if (item.favorite) {
      this.removeItemFromFavorites(item.media_type, item.item_id);
      // optimistically set the value
      item.favorite = false;
    } else {
      this.addItemToFavorites(item);
      // optimistically set the value
      item.favorite = true;
    }
  }

  public browse(path?: string): Promise<MediaItemType[]> {
    // Browse Music providers.
    return this.sendCommand("music/browse", { path });
  }

  public search(
    search_query: string,
    media_types?: MediaType[],
    limit?: number,
  ): Promise<SearchResults> {
    // Perform global search for media items on all providers.
    return this.sendCommand("music/search", {
      search_query,
      media_types,
      limit,
    });
  }

  public async getRecentlyPlayedItems(
    limit = 10,
    media_types?: MediaType[],
  ): Promise<ItemMapping[]> {
    return this.sendCommand("music/recently_played_items", {
      limit,
      media_types,
    });
  }

  public async getInProgressItems(limit = 10): Promise<ItemMapping[]> {
    return this.sendCommand("music/in_progress_items", {
      limit,
    });
  }

  public async getRecommendations(): Promise<RecommendationFolder[]> {
    return this.sendCommand("music/recommendations");
  }

  public markItemPlayed(
    media_item: MediaItemTypeOrItemMapping,
    fully_played?: boolean,
    seconds_played?: number,
  ): Promise<void> {
    if ("fully_played" in media_item) media_item.fully_played = fully_played;
    if ("resume_position_ms" in media_item)
      delete media_item.resume_position_ms;
    // Mark item as played in the playlog
    return this.sendCommand("music/mark_played", {
      media_item,
      fully_played,
      seconds_played,
    });
  }
  public markItemUnPlayed(
    media_item: MediaItemTypeOrItemMapping,
  ): Promise<void> {
    if ("fully_played" in media_item) media_item.fully_played = false;
    if ("resume_position_ms" in media_item)
      delete media_item.resume_position_ms;
    // Mark item as unplayed in the playlog
    return this.sendCommand("music/mark_unplayed", {
      media_item,
    });
  }

  // PlayerQueue related functions/commands

  public async getPlayerQueues(): Promise<PlayerQueue[]> {
    // Get all registered PlayerQueues
    return this.sendCommand("player_queues/all");
  }

  public getPlayerQueueItems(
    queue_id: string,
    limit: number,
    offset: number,
  ): Promise<QueueItem[]> {
    // Get all QueueItems for given PlayerQueue
    return this.sendCommand("player_queues/items", {
      queue_id,
      limit,
      offset,
    });
  }
  public queueCommandClear(queueId: string) {
    // Clear all items in the queue.
    this.playerQueueCommand(queueId, "clear");
  }
  public queueCommandPlayIndex(queueId: string, index: number | string) {
    // Play item at index (or item_id) X in queue.
    this.playerQueueCommand(queueId, "play_index", { index });
  }
  public queueCommandMoveItem(
    queueId: string,
    queue_item_id: string,
    pos_shift = 1,
  ) {
    // Move queue item x up/down the queue.
    // - queue_id: id of the queue to process this request.
    // - queue_item_id: the item_id of the queueitem that needs to be moved.
    // - pos_shift: move item x positions down if positive value
    // - pos_shift: move item x positions up if negative value
    // - pos_shift:  move item to top of queue as next item if 0
    this.playerQueueCommand(queueId, "move_item", { queue_item_id, pos_shift });
  }
  public queueCommandMoveItemEnd(queueId: string, queue_item_id: string) {
    // Move queue item to the end of the queue.
    // - queue_id: id of the queue to process this request.
    // - queue_item_id: the item_id of the queueitem that needs to be moved.
    this.playerQueueCommand(queueId, "move_item_end", { queue_item_id });
  }
  public queueCommandMoveUp(queueId: string, queue_item_id: string) {
    this.queueCommandMoveItem(queueId, queue_item_id, -1);
  }
  public queueCommandMoveDown(queueId: string, queue_item_id: string) {
    this.queueCommandMoveItem(queueId, queue_item_id, 1);
  }
  public queueCommandMoveNext(queueId: string, queue_item_id: string) {
    this.queueCommandMoveItem(queueId, queue_item_id, 0);
  }
  public queueCommandDelete(
    queueId: string,
    item_id_or_index: number | string,
  ) {
    // Delete item (by id or index) from the queue.
    this.playerQueueCommand(queueId, "delete_item", { item_id_or_index });
  }

  public queueCommandSeek(queueId: string, position: number) {
    // Handle SEEK command for given queue.
    // - position: position in seconds to seek to in the current playing item.
    this.playerQueueCommand(queueId, "seek", { position });
  }
  public queueCommandSkip(queueId: string, seconds: number) {
    // Handle SKIP command for given queue.
    // - seconds: number of seconds to skip in track. Use negative value to skip back.
    this.playerQueueCommand(queueId, "skip", { seconds });
  }
  public queueCommandSkipAhead(queueId: string) {
    this.queueCommandSkip(queueId, 10);
  }
  public queueCommandSkipBack(queueId: string) {
    this.queueCommandSkip(queueId, -10);
  }
  public queueCommandShuffle(queueId: string, shuffle_enabled: boolean) {
    // Configure shuffle setting on the the queue.
    this.playerQueueCommand(queueId, "shuffle", { shuffle_enabled });
  }
  public queueCommandShuffleToggle(queueId: string) {
    // Toggle shuffle mode for a queue
    this.queueCommandShuffle(queueId, !this.queues[queueId].shuffle_enabled);
  }
  public queueCommandRepeat(queueId: string, repeat_mode: RepeatMode) {
    // Configure repeat setting on the the queue.
    this.playerQueueCommand(queueId, "repeat", { repeat_mode });
  }
  public queueCommandRepeatToggle(queueId: string) {
    // Toggle repeat mode of a queue
    const queue = this.queues[queueId];
    if (this.queues[queueId].repeat_mode == RepeatMode.OFF) {
      this.queueCommandRepeat(queueId, RepeatMode.ONE);
    } else if (this.queues[queueId].repeat_mode == RepeatMode.ONE) {
      this.queueCommandRepeat(queueId, RepeatMode.ALL);
    } else {
      this.queueCommandRepeat(queueId, RepeatMode.OFF);
    }
  }
  public queueCommandDontStopTheMusic(
    queueId: string,
    dont_stop_the_music_enabled: boolean,
  ) {
    // Configure dont_stop_the_music setting on the the queue.
    this.playerQueueCommand(queueId, "dont_stop_the_music", {
      dont_stop_the_music_enabled,
    });
  }
  public queueCommandDontStopTheMusicToggle(queueId: string) {
    // Toggle dont_stop_the_music mode of a queue
    this.queueCommandDontStopTheMusic(
      queueId,
      !this.queues[queueId].dont_stop_the_music_enabled,
    );
  }
  public playerQueueCommand(
    queue_id: string,
    command: string,
    args?: Record<string, any>,
  ) {
    /*
      Handle (throttled) command to player
    */
    this._sendCommand(`player_queues/${command}`, {
      queue_id,
      ...args,
    });
  }
  public queueCommandTransfer(
    sourceQueue: string,
    targetQueue: string,
    autoPlay?: boolean,
  ) {
    // Transfer queue to another queue.
    this._sendCommand("player_queues/transfer", {
      source_queue_id: sourceQueue,
      target_queue_id: targetQueue,
      auto_play: autoPlay,
    });
  }
  public queueCommandSaveAsPlaylist(
    queueId: string,
    name: string,
  ): Promise<Playlist> {
    // Save the current queue items as a new playlist.
    return this.sendCommand("player_queues/save_as_playlist", {
      queue_id: queueId,
      name,
    });
  }

  // Player related functions/commands

  public async getPlayers(): Promise<Player[]> {
    // Get all registered players.
    return this.sendCommand("players/all");
  }
  public async getPlayer(player_id: string): Promise<Player> {
    return this.sendCommand("players/get", {
      player_id,
      raise_unavailable: true,
    });
  }

  public playerCommandPlay(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "play");
  }
  public playerCommandPause(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "pause");
  }
  public playerCommandPlayPause(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "play_pause");
  }
  public playerCommandStop(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "stop");
  }
  public playerCommandNext(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "next");
  }
  public playerCommandPrevious(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "previous");
  }
  public playerCommandSeek(playerId: string, position: number) {
    this.playerCommand(playerId, "seek", { position });
  }

  public playerCommandPower(playerId: string, powered: boolean): Promise<void> {
    return this.playerCommand(playerId, "power", { powered });
  }

  public playerCommandPowerToggle(playerId: string): Promise<void> {
    return this.playerCommandPower(playerId, !this.players[playerId].powered);
  }

  public async playerCommandVolumeSet(playerId: string, newVolume: number) {
    newVolume = Math.max(newVolume, 0);
    newVolume = Math.min(newVolume, 100);

    await this.playerCommand(playerId, "volume_set", {
      volume_level: newVolume,
    });
    this.players[playerId].volume_level = newVolume;
  }
  public playerCommandVolumeUp(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "volume_up");
  }
  public playerCommandVolumeDown(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "volume_down");
  }
  public playerCommandVolumeMute(
    playerId: string,
    muted: boolean,
  ): Promise<void> {
    return this.playerCommand(playerId, "volume_mute", {
      muted,
    });
  }

  public playerCommandMuteToggle(playerId: string): Promise<void> {
    return this.playerCommandVolumeMute(
      playerId,
      !this.players[playerId].volume_muted,
    );
  }

  public playerCommandSetMembers(
    target_player: string,
    player_ids_to_add?: string[],
    player_ids_to_remove?: string[],
  ): Promise<void> {
    /*
      Join/unjoin given player(s) to/from target player.

      Will add the given player(s) to the target player (sync leader or group player).

      - target_player: player_id of the syncgroup leader or group player.
      - player_ids_to_add: List of player_id's to add to the target player.
      - player_ids_to_remove: List of player_id's to remove from the target player.
    */
    return this.playerCommand(target_player, "set_members", {
      target_player,
      player_ids_to_add,
      player_ids_to_remove,
    });
  }

  public playerCommandGroup(
    playerId: string,
    target_player: string,
  ): Promise<void> {
    /*
      Handle GROUP command for given player.

      Join/add the given player(id) to the given (leader) player/sync group.
      If the target player itself is already synced to another player, this may fail.
      If the player can not be synced with the given target player, this may fail.

          - player_id: player_id of the player to handle the command.
          - target_player: player_id of the syncgroup leader or group player.
    */
    return this.playerCommand(playerId, "group", {
      target_player,
    });
  }

  public playerCommandUnGroup(playerId: string): Promise<void> {
    /*
      Handle UNGROUP command for given player.

      Remove the given player from any (sync)groups it currently is synced to.
      If the player is not currently grouped to any other player,
      this will silently be ignored.

          - player_id: player_id of the player to handle the command.
    */
    return this.playerCommand(playerId, "ungroup");
  }

  public playerCommandSelectSoundMode(
    playerId: string,
    soundMode: string,
  ): Promise<void> {
    /*
      Handle SELECT_SOUND_MODE on given player
          - playerId: playerId of the player to handle the command.
          - soundMode: selected sound mode
    */
    return this.playerCommand(playerId, "select_sound_mode", {
      sound_mode: soundMode,
    });
  }

  public playerCommandSetOption(
    playerId: string,
    optionKey: string,
    optionValue: PlayerOptionValueType,
  ): Promise<void> {
    /*
      Handle SET_OPTION on given player
          - playerId: playerId of the player to handle the command.
          - optionKey: the option's key
          - optionValue: the option's new value
    */
    return this.playerCommand(playerId, "set_option", {
      option_key: optionKey,
      option_value: optionValue,
    });
  }

  public playerCommand(
    player_id: string,
    command: string,
    args?: Record<string, any>,
  ): Promise<void> {
    /*
      Handle command to player
    */
    return this.sendCommand(`players/cmd/${command}`, {
      player_id,
      ...args,
    });
  }

  public removePlayer(playerId: string): Promise<void> {
    return this.sendCommand("players/remove", { player_id: playerId });
  }

  // PlayerGroup related functions/commands

  public playerCommandGroupVolume(playerId: string, newVolume: number) {
    /*
      Send VOLUME_SET command to given playergroup.

      Will send the new (average) volume level to group child's.
        - playerId: player_id of the playergroup to handle the command.
        - newVolume: volume level (0..100) to set on the player.
    */
    this.playerCommand(playerId, "group_volume", {
      volume_level: newVolume,
    });
    this.players[playerId].group_volume = newVolume;
  }
  public playerCommandGroupVolumeUp(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "group_volume_up");
  }
  public playerCommandGroupVolumeDown(playerId: string): Promise<void> {
    return this.playerCommand(playerId, "group_volume_down");
  }

  public async createPlayerGroup(
    provider: string,
    name: string,
    members: string[],
    dynamic = false,
  ): Promise<Player> {
    // Create a new Sync playergroup
    return this.sendCommand("players/create_group_player", {
      provider,
      name,
      members,
      dynamic,
    });
  }

  public playerCommandGroupSelectSource(
    playerId: string,
    source: string,
  ): Promise<void> {
    return this.playerCommand(playerId, "select_source", { source });
  }

  // Play Media related functions

  public playMedia(
    media:
      | MediaItemTypeOrItemMapping
      | MediaItemTypeOrItemMapping[]
      | string
      | string[],
    option?: QueueOption,
    radio_mode?: boolean,
    start_item?: PlayableMediaItemType | string,
    queue_id?: string,
  ): Promise<void> {
    if (
      !queue_id &&
      store.activePlayer?.active_source &&
      store.activePlayer?.active_source in this.queues
    ) {
      queue_id = store.activePlayer?.active_source;
    } else if (!queue_id) {
      queue_id = store.activePlayer?.player_id;
    }
    return this.sendCommand("player_queues/play_media", {
      queue_id,
      media,
      option,
      radio_mode,
      start_item,
    });
  }

  // ProviderConfig related functions

  public async getProviderConfigs(
    provider_type?: ProviderType,
    provider_domain?: string,
  ): Promise<ProviderConfig[]> {
    // Return all known provider configurations, optionally filtered by ProviderType or domain.
    return this.sendCommand("config/providers", {
      provider_type,
      provider_domain,
    });
  }

  public async getProviderConfig(instance_id: string): Promise<ProviderConfig> {
    // Return configuration for a single provider.
    return this.sendCommand("config/providers/get", { instance_id });
  }

  public async getProviderConfigEntries(
    provider_domain: string,
    instance_id?: string,
    action?: string,
    values?: Record<string, ConfigValueType>,
  ): Promise<ConfigEntry[]> {
    // Return Config entries to setup/configure a provider.
    // provider_domain: (mandatory) domain of the provider.
    // instance_id: id of an existing provider instance (None for new instance setup).
    // action: [optional] action key called from config entries UI.
    // values: the (intermediate) raw values for config entries sent with the action.
    return this.sendCommand("config/providers/get_entries", {
      provider_domain,
      instance_id,
      action,
      values,
    });
  }

  public async saveProviderConfig(
    provider_domain: string,
    values: Record<string, ConfigValueType>,
    instance_id?: string,
  ): Promise<ProviderConfig> {
    // Save Provider(instance) Config.
    // provider_domain: (mandatory) domain of the provider.
    // values: the raw values for config entries that need to be stored/updated.
    // instance_id: id of an existing provider instance (None for new instance setup).
    // action: [optional] action key called from config entries UI.
    return this.sendCommand("config/providers/save", {
      provider_domain,
      values,
      instance_id,
    });
  }

  public removeProviderConfig(instance_id: string): Promise<void> {
    // Remove ProviderConfig.
    return this.sendCommand("config/providers/remove", {
      instance_id,
    });
  }

  public reloadProvider(instance_id: string): Promise<void> {
    // Reload Provider(instance).
    return this.sendCommand("config/providers/reload", {
      instance_id,
    });
  }

  // PlayerConfig related functions

  public async getPlayerConfigs(
    provider?: string,
    include_values?: boolean,
    include_unavailable?: boolean,
    include_disabled?: boolean,
  ): Promise<PlayerConfig[]> {
    // Return all known player configurations, optionally filtered by provider domain.
    return this.sendCommand("config/players", {
      provider,
      include_values,
      include_unavailable,
      include_disabled,
    });
  }

  public async getPlayerConfig(player_id: string): Promise<PlayerConfig> {
    // Return configuration for a single player.
    return this.sendCommand("config/players/get", { player_id });
  }

  public async getPlayerConfigEntries(
    player_id: string,
    action?: string,
    values?: Record<string, ConfigValueType>,
  ): Promise<ConfigEntry[]> {
    // Return Config entries to setup/configure a player.
    // player_id: (mandatory) id of the player.
    // action: [optional] action key called from config entries UI.
    // values: the (intermediate) raw values for config entries sent with the action.
    return this.sendCommand("config/players/get_entries", {
      player_id,
      action,
      values,
    });
  }

  public async getPlayerConfigValue(
    player_id: string,
    key: string,
  ): Promise<PlayerConfig> {
    // Return single configentry value for a player.
    return this.sendCommand("config/players/get_value", { player_id, key });
  }

  public async savePlayerConfig(
    player_id: string,
    values: Record<string, ConfigValueType>,
  ): Promise<PlayerConfig> {
    // Save/update PlayerConfig.
    return this.sendCommand("config/players/save", {
      player_id,
      values,
    });
  }

  public removePlayerConfig(player_id: string): Promise<void> {
    // remove the configuration of a player
    return this.sendCommand("config/players/remove", {
      player_id,
    });
  }

  // DSP related functions

  public async getDSPConfig(player_id: string): Promise<DSPConfig> {
    // Return the DSP configuration for a player.
    return this.sendCommand("config/players/dsp/get", { player_id });
  }

  public async saveDSPConfig(
    player_id: string,
    config: DSPConfig,
  ): Promise<DSPConfig> {
    // Save/update the DSP configuration for a player.
    return this.sendCommand("config/players/dsp/save", {
      player_id,
      config,
    });
  }

  public async getDSPPresets(): Promise<DSPConfigPreset[]> {
    // Return all known DSP presets
    return this.sendCommand("config/dsp_presets/get");
  }

  public async saveDSPPreset(
    preset: DSPConfigPreset,
  ): Promise<DSPConfigPreset> {
    // Save a DSP preset.
    return this.sendCommand("config/dsp_presets/save", { preset });
  }

  public async removeDSPPreset(presetId: string): Promise<void> {
    // Remove a DSP preset.
    return this.sendCommand("config/dsp_presets/remove", {
      preset_id: presetId,
    });
  }

  // Core Config related functions

  public async getCoreConfigs(): Promise<CoreConfig[]> {
    // Return all known core configurations
    return this.sendCommand("config/core");
  }

  public async getCoreConfig(domain: string): Promise<ProviderConfig> {
    // Return configuration for a single core controller.
    return this.sendCommand("config/core/get", { domain });
  }

  public async getCoreConfigValue(
    domain: string,
    key: string,
  ): Promise<ConfigValueType> {
    // Return value for a single core controller config entry.
    return this.sendCommand("config/core/get_value", { domain, key });
  }

  public async getCoreConfigEntries(
    domain: string,
    action?: string,
    values?: Record<string, ConfigValueType>,
  ): Promise<ConfigEntry[]> {
    // Return Config entries to configure a core controller.
    // domain: (mandatory) domain of the core module.
    // action: [optional] action key called from config entries UI.
    // values: the (intermediate) raw values for config entries sent with the action.
    return this.sendCommand("config/core/get_entries", {
      domain,
      action,
      values,
    });
  }

  public async saveCoreConfig(
    domain: string,
    values: Record<string, ConfigValueType>,
  ): Promise<ProviderConfig> {
    // Save Core controller Config.
    // domain: (mandatory) domain of the provider.
    // values: the raw values for config entries that need to be stored/updated.
    // action: [optional] action key called from config entries UI.
    return this.sendCommand("config/core/save", {
      domain,
      values,
    });
  }

  public reloadCoreController(domain: string): Promise<void> {
    // Reload Core controller.
    return this.sendCommand("config/core/reload", {
      domain,
    });
  }

  // Other (utility) functions

  public startSync(
    media_types?: MediaType[],
    providers?: string[],
  ): Promise<void> {
    // Start running the sync of (all or selected) musicproviders.
    // media_types: only sync these media types. omit for all.
    // providers: only sync these provider domains. omit for all.
    return this.sendCommand("music/sync", { media_types, providers });
  }

  public getProviderName(provider_domain_or_instance_id: string): string {
    // try to get the name of the provider from the instance_id or domain
    if (provider_domain_or_instance_id in this.providers) {
      provider_domain_or_instance_id =
        this.providers[provider_domain_or_instance_id].instance_id;
    }
    // prefer the user configured name
    if (provider_domain_or_instance_id in this.providers) {
      return this.providers[provider_domain_or_instance_id].name;
    }
    // fallback to manifest name
    if (provider_domain_or_instance_id in this.providerManifests) {
      return this.providerManifests[provider_domain_or_instance_id].name;
    }
    return provider_domain_or_instance_id;
  }

  public getProvider(
    provider_domain_or_instance_id: string,
  ): ProviderInstance | undefined {
    // try to get the provider from the instance_id or domain
    if (provider_domain_or_instance_id in this.providers) {
      return this.providers[provider_domain_or_instance_id];
    }
    for (const provId in this.providers) {
      const prov = this.providers[provId];
      if (prov.domain == provider_domain_or_instance_id) {
        return prov;
      }
    }
    return undefined;
  }

  public getProviderManifest(
    provider_domain_or_instance_id: string,
  ): ProviderManifest | undefined {
    // try to get the provider manifest from the instance_id or domain
    if (provider_domain_or_instance_id in this.providerManifests) {
      return this.providerManifests[provider_domain_or_instance_id];
    }
    if (provider_domain_or_instance_id in this.providers) {
      const prov = this.providers[provider_domain_or_instance_id];
      return this.providerManifests[prov.domain];
    }
    return undefined;
  }

  private handleEventMessage(msg: EventMessage) {
    // Handle incoming MA event message
    if (msg.event == EventType.QUEUE_ADDED) {
      const queue = msg.data as PlayerQueue;
      this.queues[queue.queue_id] = queue;
    } else if (msg.event == EventType.QUEUE_UPDATED) {
      const queue = msg.data as PlayerQueue;
      if (queue.queue_id in this.queues)
        Object.assign(this.queues[queue.queue_id], queue);
      else this.queues[queue.queue_id] = queue;
    } else if (msg.event == EventType.QUEUE_TIME_UPDATED) {
      const queueId = msg.object_id as string;
      if (queueId in this.queues) {
        this.queues[queueId].elapsed_time = msg.data as unknown as number;
        this.queues[queueId].elapsed_time_last_updated = Date.now() / 1000;
      }
    } else if (msg.event == EventType.PLAYER_ADDED) {
      const player = msg.data as Player;
      this.players[player.player_id] = player;
    } else if (msg.event == EventType.PLAYER_UPDATED) {
      const player = msg.data as Player;
      if (player.player_id in this.players)
        Object.assign(this.players[player.player_id], player);
      else this.players[player.player_id] = player;
    } else if (msg.event == EventType.PLAYER_REMOVED) {
      delete this.players[msg.object_id!];
      delete this.queues[msg.object_id!];
    } else if (msg.event == EventType.SYNC_TASKS_UPDATED) {
      this.syncTasks.value = msg.data as SyncTask[];
    } else if (msg.event == EventType.CORE_STATE_UPDATED) {
      // Update serverInfo with the new server state
      this.serverInfo.value = msg.data as ServerInfoMessage;
    } else if (msg.event == EventType.PROVIDERS_UPDATED) {
      // Clear and repopulate the existing reactive object to preserve reactivity
      Object.keys(this.providers).forEach((key) => delete this.providers[key]);
      for (const prov of msg.data as ProviderInstance[]) {
        this.providers[prov.instance_id] = prov;
      }
    }
    // signal + log all events
    if (DEBUG) console.log("[event]", msg);
    this.signalEvent(msg);
  }

  private handleResultMessage(msg: SuccessResultMessage | ErrorResultMessage) {
    // Handle result of a command
    const resultPromise = this.commands.get(msg.message_id);

    if ("error_code" in msg) {
      // always handle error (as we may be missing a resolve promise for this command)
      msg = msg as ErrorResultMessage;
      console.error("[resultMessage]", msg);

      // Don't show toast for authentication errors - they're handled by the login UI
      const errorMsg = msg.details || msg.error_code || "";
      const isAuthError =
        errorMsg.includes("Invalid credentials") ||
        errorMsg.includes("Invalid username") ||
        errorMsg.includes("Invalid password") ||
        errorMsg.includes("Authentication failed") ||
        errorMsg.includes("Authentication required") ||
        errorMsg.toLowerCase().includes("unauthorized");

      if (!isAuthError) {
        toast.error(msg.details || msg.error_code);
      }
    } else if (DEBUG) {
      console.log("[resultMessage]", msg);
    }

    if (!resultPromise) return;

    if ("partial" in msg && msg.partial) {
      // handle partial results (for large listings that are split in multiple messages)
      if (!(msg.message_id in this.partialResult)) {
        this.partialResult[msg.message_id] = [];
      }
      this.partialResult[msg.message_id].push(...msg.result);
      return;
    } else if (msg.message_id in this.partialResult) {
      // if we have partial results, append them to the final result
      if ("result" in msg)
        msg.result = this.partialResult[msg.message_id].concat(msg.result);
      delete this.partialResult[msg.message_id];
    }

    this.commands.delete(msg.message_id);
    if ("error_code" in msg) {
      resultPromise.reject(msg.details || msg.error_code);
    } else {
      msg = msg as SuccessResultMessage;
      resultPromise.resolve(msg.result);
    }
  }

  private handleServerInfoMessage(msg: ServerInfoMessage) {
    // Handle ServerInfo message which is sent as first message on connect
    if (DEBUG) {
      console.log("[serverInfo]", msg);
    }

    this.serverInfo.value = msg;
    // ServerInfo means transport is connected and server is ready, but not yet authenticated
    this.state.value = ConnectionState.CONNECTED;
    this.signalEvent({
      event: EventType.CONNECTED,
      object_id: "",
      data: msg,
    });
  }

  /**
   * Signal an event to all registered listeners.
   */
  public signalEvent(evt: MassEvent) {
    // signal event to all listeners
    for (const listener of this.eventCallbacks) {
      if (listener[0] === EventType.ALL || listener[0] === evt.event) {
        if (listener[1] == "*" || listener[1] === evt.object_id) {
          listener[2](evt);
        }
      }
    }
  }

  // Auth related functions/commands

  public async changePassword(newPassword: string): Promise<boolean> {
    // Change password for current user using unified update command
    try {
      const result = await this.sendCommand<
        { success?: boolean; user?: User } | boolean | null | undefined
      >("auth/user/update", {
        password: newPassword,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      if (
        typeof result === "object" &&
        (("success" in result && result.success === true) || "user" in result)
      ) {
        return true;
      }

      return true;
    } catch (error) {
      console.error("Error changing password:", error);
      return false;
    }
  }

  public async getCurrentUserInfo(): Promise<User | null> {
    // Get current authenticated user information
    try {
      const result = await this.sendCommand<User>("auth/me");
      return result;
    } catch (error) {
      console.error("Failed to get current user info:", error);
      return null;
    }
  }

  public async getUserTokens(userId?: string): Promise<AuthToken[]> {
    // Get all tokens for current user or specific user (admin only)
    const args = userId ? { user_id: userId } : undefined;
    const tokens = await this.sendCommand<AuthToken[]>("auth/tokens", args);
    return tokens || [];
  }

  public async createToken(name: string, userId?: string): Promise<string> {
    // Create a new long-lived token for current user or specific user (admin only)
    const args: { name: string; user_id?: string } = { name };
    if (userId) args.user_id = userId;
    const result = await this.sendCommand<
      { success?: boolean; token: string } | string
    >("auth/token/create", args);

    if (typeof result === "string") {
      return result;
    }

    if (result.success === false) {
      throw new Error("Failed to create token");
    }

    if (!result.token) {
      throw new Error("Failed to create token");
    }

    return result.token;
  }

  public async revokeToken(tokenId: string): Promise<boolean> {
    // Revoke a token
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/token/revoke", {
        token_id: tokenId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === true
      ) {
        return true;
      }

      return true;
    } catch (error) {
      console.error("Error revoking token:", error);
      return false;
    }
  }

  public async getAuthProviders(): Promise<AuthProvider[]> {
    // Get list of available authentication providers
    return await this.sendCommand<AuthProvider[]>("auth/providers");
  }

  public async logout(): Promise<boolean> {
    // Logout current user by revoking the current token
    const result = await this.sendCommand<{ success: boolean }>("auth/logout");
    return result.success;
  }

  // User management functions/commands (admin only)

  public async getAllUsers(): Promise<User[]> {
    // Get all users (admin only)
    const users = await this.sendCommand<User[]>("auth/users");
    return users;
  }

  public async createUser(
    username: string,
    password: string,
    role: UserRole,
    displayName?: string,
    playerFilter?: string[],
    providerFilter?: string[],
  ): Promise<User> {
    // Create a new user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean; user?: User } | User | null | undefined
      >("auth/user/create", {
        username,
        password,
        role,
        display_name: displayName,
        player_filter: playerFilter,
        provider_filter: providerFilter,
      });

      if (result == null) {
        throw new Error("Failed to create user");
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        throw new Error("Failed to create user");
      }

      if (typeof result === "object" && "user" in result && result.user) {
        return result.user;
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      throw new Error("Failed to create user");
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  public async updateUser(
    userId: string,
    updates: {
      username?: string;
      displayName?: string;
      avatarUrl?: string;
      role?: UserRole;
      password?: string;
      preferences?: Record<string, any>;
      provider_filter?: string[];
      player_filter?: string[];
    },
  ): Promise<User> {
    // Update user using unified update command
    try {
      const args: Record<string, any> = { user_id: userId };

      if (updates.username) args.username = updates.username;
      if (updates.displayName) args.display_name = updates.displayName;
      if (updates.avatarUrl) args.avatar_url = updates.avatarUrl;
      if (updates.role) args.role = updates.role;
      if (updates.password) args.password = updates.password;
      if (updates.preferences != undefined)
        args.preferences = updates.preferences;
      if (updates.provider_filter != undefined)
        args.provider_filter = updates.provider_filter;
      if (updates.player_filter != undefined)
        args.player_filter = updates.player_filter;

      const result = await this.sendCommand<
        { success?: boolean; user?: User } | User | null | undefined
      >("auth/user/update", args);

      if (result == null) {
        throw new Error("Failed to update user");
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        throw new Error("Failed to update user");
      }

      if (typeof result === "object" && "user" in result && result.user) {
        return result.user;
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      throw new Error("Failed to update user");
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  public async updateUserRole(
    userId: string,
    role: UserRole,
  ): Promise<boolean> {
    // Update user role using unified update command
    try {
      await this.updateUser(userId, { role });
      return true;
    } catch (error) {
      return false;
    }
  }

  public async enableUser(userId: string): Promise<boolean> {
    // Enable user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/user/enable", {
        user_id: userId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error enabling user:", error);
      return false;
    }
  }

  public async deleteUser(userId: string): Promise<boolean> {
    // Delete user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/user/delete", {
        user_id: userId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  public async disableUser(userId: string): Promise<boolean> {
    // Disable user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/user/disable", {
        user_id: userId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error disabling user:", error);
      return false;
    }
  }

  // Remote Access methods

  public async getRemoteAccessInfo(): Promise<RemoteAccessInfo> {
    // Get remote access information
    return this.sendCommand<RemoteAccessInfo>("remote_access/info");
  }

  public async configureRemoteAccess(
    enabled: boolean,
  ): Promise<RemoteAccessInfo> {
    // Configure remote access (admin only)
    return this.sendCommand<RemoteAccessInfo>("remote_access/configure", {
      enabled,
    });
  }

  public sendCommand<Result>(
    command: string,
    args?: Record<string, any>,
  ): Promise<Result> {
    // send command to the server and return promise where the result can be returned
    const cmdId = this._genCmdId();
    return new Promise((resolve, reject) => {
      this.commands.set(cmdId, { resolve, reject });
      this._sendCommand(command, args, cmdId);
    });
  }

  private _sendCommand(
    command: string,
    args?: Record<string, any>,
    msgId?: string,
  ): void {
    // Allow commands only when fully connected
    if (
      this.state.value !== ConnectionState.CONNECTED &&
      this.state.value !== ConnectionState.AUTH_REQUIRED &&
      this.state.value !== ConnectionState.AUTHENTICATING &&
      this.state.value !== ConnectionState.AUTHENTICATED &&
      this.state.value !== ConnectionState.INITIALIZED
    ) {
      throw new Error("Connection lost");
    }

    if (!msgId) {
      msgId = this._genCmdId();
    }

    const msg: CommandMessage = {
      command: command,
      message_id: msgId.toString(),
      args,
    };

    if (DEBUG) {
      console.log("[sendCommand]", msg);
    }

    const msgStr = JSON.stringify(msg);

    if (!this.transport) {
      throw new Error("No connection available");
    }

    this.transport.send(msgStr);
  }

  public async fetchState() {
    // fetch full initial state
    for (const player of await this.getPlayers()) {
      this.players[player.player_id] = player;
    }
    for (const queue of await this.getPlayerQueues()) {
      this.queues[queue.queue_id] = queue;
    }

    for (const prov of await this.sendCommand<ProviderManifest[]>(
      "providers/manifests",
    )) {
      this.providerManifests[prov.domain] = prov;
    }

    for (const prov of await this.sendCommand<ProviderInstance[]>(
      "providers",
    )) {
      this.providers[prov.instance_id] = prov;
    }

    this.syncTasks.value =
      await this.sendCommand<SyncTask[]>("music/synctasks");
  }

  private _genCmdId(): string {
    // Generate a cryptographically secure UUID
    // Use crypto.randomUUID when available (secure contexts only)
    // Otherwise fall back to a UUID v4 implementation using crypto.getRandomValues
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback UUID v4 generator using crypto.getRandomValues (works in all contexts)
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
      const num = parseInt(c, 10);
      return (
        num ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (num / 4)))
      ).toString(16);
    });
  }

  /**
   * Create a sendspin DataChannel through the remote access WebRTC connection.
   * Returns null if not in remote mode or if WebRTC transport doesn't support it.
   */
  public async createSendspinDataChannel(): Promise<RTCDataChannel | null> {
    if (!this.transport) {
      return null;
    }

    // Check if transport supports creating sendspin channels
    if (typeof this.transport.createSendspinDataChannel === "function") {
      try {
        return await this.transport.createSendspinDataChannel();
      } catch (error) {
        console.error("[API] Failed to create sendspin DataChannel:", error);
        return null;
      }
    }

    return null;
  }
}

export const api = new MusicAssistantApi();
export default api;
