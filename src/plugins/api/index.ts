import { AlertType, store } from "../store";
/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { computed, reactive, ref } from "vue";
import { LinearBackoff, Websocket, WebsocketBuilder } from "websocket-ts";
import { getDeviceName } from "./helpers";
import type { ITransport } from "../remote/transport";
import { TransportState } from "../remote/transport";
import {
  type Album,
  type Artist,
  type AuthToken,
  type CommandMessage,
  type ErrorResultMessage,
  type EventMessage,
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
  type SyncTask,
  type Track,
  type User,
  AlbumType,
  Audiobook,
  AuthProvider,
  BuiltinPlayerState,
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
  RepeatMode,
  SearchResults,
  UserRole,
} from "./interfaces";

const DEBUG = process.env.NODE_ENV === "development";

export enum ConnectionState {
  DISCONNECTED = 0,
  CONNECTING = 1,
  CONNECTED = 2,
}

export class MusicAssistantApi {
  private ws?: Websocket;
  private transport?: ITransport;
  private _throttleId?: any;
  public baseUrl?: string;
  public isRemoteConnection = ref<boolean>(false);
  public state = ref<ConnectionState>(ConnectionState.DISCONNECTED);
  public serverInfo = ref<ServerInfoMessage>();
  public players = reactive<{ [player_id: string]: Player }>({});
  public queues = reactive<{ [queue_id: string]: PlayerQueue }>({});
  public providers = reactive<{ [instance_id: string]: ProviderInstance }>({});
  public providerManifests = reactive<{ [domain: string]: ProviderManifest }>(
    {},
  );
  public syncTasks = ref<SyncTask[]>([]);
  public fetchesInProgress = ref<string[]>([]);
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

  public async initialize(
    baseUrl: string,
    authToken?: string | null,
    tokenFromLogin?: boolean,
    skipRedirects?: boolean,
  ) {
    if (this.ws) throw new Error("already initialized");
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    this.baseUrl = baseUrl;
    // Build WebSocket URL - don't add /ws if already present
    let wsUrl = baseUrl.replace("http", "ws");
    if (!wsUrl.endsWith("/ws")) {
      wsUrl += "/ws";
    }
    console.log(`Connecting to Music Assistant API ${wsUrl}`);
    this.state.value = ConnectionState.CONNECTING;

    let isAuthenticated = false;
    let authMessageId: string | null = null;
    let pendingServerInfo: ServerInfoMessage | null = null;

    // connect to the websocket api
    this.ws = new WebsocketBuilder(wsUrl)
      .onOpen((i, ev) => {
        console.log("connection opened");
        // Reset authentication state on reconnection
        isAuthenticated = false;
        authMessageId = null;
        pendingServerInfo = null;
        // Wait for ServerInfo message before doing anything
      })
      .onClose((i, ev) => {
        console.log("connection closed");
        this.state.value = ConnectionState.DISCONNECTED;
        this.signalEvent({
          event: EventType.DISCONNECTED,
          object_id: "",
        });
      })
      .onError((i, ev) => {
        console.log("error on connection");
      })
      .onMessage((i, ev) => {
        // Message retrieved on the websocket
        const msg = JSON.parse(ev.data);

        // Handle ServerInfo message FIRST (always sent first by server)
        if ("server_version" in msg && !pendingServerInfo && !isAuthenticated) {
          const serverInfo = msg as ServerInfoMessage;
          console.info("ServerInfo received", serverInfo);

          // Check if we have a token
          if (!authToken) {
            // No token provided
            if (skipRedirects) {
              // Don't redirect - just store serverInfo and let caller handle auth
              console.log("No token provided, skipRedirects=true, storing serverInfo");
              this.serverInfo.value = serverInfo;
              this.state.value = ConnectionState.CONNECTED;
              this.signalEvent({
                event: EventType.CONNECTED,
                object_id: "",
                data: serverInfo,
              });
              return;
            }
            // Old behavior: redirect to login
            console.error("Authentication required but no token provided");
            this.ws?.close();
            const returnUrl = encodeURIComponent(window.location.href);
            const deviceName = encodeURIComponent(getDeviceName());
            if (!serverInfo.onboard_done) {
              window.location.href = `${this.baseUrl}/setup?return_url=${returnUrl}&device_name=${deviceName}`;
            } else {
              window.location.href = `${this.baseUrl}/login?return_url=${returnUrl}&device_name=${deviceName}`;
            }
            return;
          }

          // We have a token - send auth command
          // Store serverInfo locally (not in this.serverInfo) until auth succeeds
          pendingServerInfo = serverInfo;
          authMessageId = this._genCmdId();
          const authCmd = {
            command: "auth",
            message_id: authMessageId,
            args: {
              token: authToken,
            },
          };
          console.debug("Sending auth command", authMessageId);
          i.send(JSON.stringify(authCmd));
          return;
        }

        // Check if this is the auth response (match by message_id)
        if (
          authMessageId &&
          !isAuthenticated &&
          "message_id" in msg &&
          msg.message_id === authMessageId
        ) {
          if ("error" in msg || "error_code" in msg) {
            console.error("WebSocket authentication failed", msg);
            // Clear auth token from localStorage
            localStorage.removeItem("ma_access_token");
            localStorage.removeItem("ma_current_user");

            // If skipRedirects is enabled, don't redirect - let caller handle it
            if (skipRedirects) {
              console.log("Auth failed, skipRedirects=true, not redirecting");
              // Keep connection open, caller will handle re-authentication
              return;
            }

            // Close connection and redirect to server login
            this.ws?.close();

            // Check if we just came from login (to prevent redirect loop)
            if (tokenFromLogin) {
              // We just got a token from login but it failed validation
              // Don't redirect again, show error instead
              console.error(
                "Token from login page failed validation - possible invalid credentials or server issue",
              );
              alert(
                "Authentication failed. The login token is invalid. Please try logging in again.",
              );
              // Clear the token from URL and redirect to login
              const deviceName = encodeURIComponent(getDeviceName());
              window.location.href = `${this.baseUrl}/login?device_name=${deviceName}`;
              return;
            }

            // Redirect to server login page
            const returnUrl = encodeURIComponent(window.location.href);
            const deviceName = encodeURIComponent(getDeviceName());
            window.location.href = `${this.baseUrl}/login?return_url=${returnUrl}&device_name=${deviceName}`;
            return;
          }
          // Auth successful
          console.log("WebSocket authenticated successfully", msg);
          isAuthenticated = true;

          // Extract user from auth response and store it
          if ("result" in msg && msg.result && typeof msg.result === "object") {
            const authResult = msg.result as { user?: any };
            if (authResult.user) {
              // Store user in localStorage (authManager will load it on next access)
              localStorage.setItem(
                "ma_current_user",
                JSON.stringify(authResult.user),
              );
              console.log("User info stored:", authResult.user);

              // Import and update authManager asynchronously
              import("@/plugins/auth").then(({ authManager }) => {
                (authManager as any).currentUser = authResult.user;
              });
            }
          }

          // Now that we're authenticated, process the ServerInfo and signal CONNECTED
          if (pendingServerInfo) {
            console.info(
              "Processing ServerInfo after successful authentication",
            );
            this.handleServerInfoMessage(pendingServerInfo);
            pendingServerInfo = null;
          }
          return;
        }

        if ("event" in msg) {
          this.handleEventMessage(msg as EventMessage);
        } else if ("message_id" in msg) {
          this.handleResultMessage(msg);
        } else {
          // unknown message receoved
          console.error("received unknown message", msg);
        }
      })
      .onRetry((i, ev) => {
        console.log("retry");
        this.state.value = ConnectionState.CONNECTING;
      })
      .withBackoff(new LinearBackoff(0, 1000, 12000))
      .build();
  }

  /**
   * Initialize the API with a custom transport (for remote WebRTC connections)
   * This method is used when connecting via WebRTC DataChannel
   */
  public async initializeWithTransport(
    transport: ITransport,
    baseUrl?: string,
  ): Promise<void> {
    if (this.ws || this.transport) throw new Error("already initialized");

    this.transport = transport;
    this.baseUrl = baseUrl || "";
    this.isRemoteConnection.value = true;
    this.state.value = ConnectionState.CONNECTING;

    console.log("[API] Initializing with custom transport");

    // Set up transport message handler
    transport.on("message", (data: string) => {
      try {
        const msg = JSON.parse(data);
        this.handleTransportMessage(msg);
      } catch (error) {
        console.error("[API] Failed to parse message:", error);
      }
    });

    transport.on("close", () => {
      console.log("[API] Transport closed");
      this.state.value = ConnectionState.DISCONNECTED;
      this.signalEvent({
        event: EventType.DISCONNECTED,
        object_id: "",
      });
    });

    transport.on("error", (error: Error) => {
      console.error("[API] Transport error:", error);
    });

    // Wait for initial ServerInfo message
    await this.waitForServerInfo();
  }

  /**
   * Authenticate with username and password (for remote connections)
   * Returns the auth token on success
   */
  public async loginWithCredentials(
    username: string,
    password: string,
    deviceName?: string,
  ): Promise<{ token: string; user: User }> {
    console.log("[API] Logging in with credentials");

    const result = await this.sendCommand<{ access_token?: string; token?: string; user: User }>(
      "auth/login",
      {
        username,
        password,
        device_name: deviceName || getDeviceName(),
      },
    );

    // Server may return 'access_token' or 'token'
    const token = result.access_token || result.token;

    if (token) {
      // Store the token
      localStorage.setItem("ma_access_token", token);
      if (result.user) {
        localStorage.setItem("ma_current_user", JSON.stringify(result.user));
      }

      // Now authenticate the WebSocket session with the token
      console.log("[API] Authenticating WebSocket session with token");
      await this.sendCommand("auth", { token });

      // Now that we're authenticated, fetch the full state
      this._fetchState();
    }

    return { token: token || "", user: result.user };
  }

  /**
   * Authenticate with an existing token (for remote connections)
   */
  public async authenticateWithToken(token: string): Promise<{ user: User }> {
    console.log("[API] Authenticating with token");

    const result = await this.sendCommand<{ user: User }>("auth", {
      token,
    });

    if (result.user) {
      localStorage.setItem("ma_current_user", JSON.stringify(result.user));
      // Import and update authManager
      import("@/plugins/auth").then(({ authManager }) => {
        (authManager as any).currentUser = result.user;
      });
      // Now that we're authenticated, fetch the full state
      this._fetchState();
    }

    return result;
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
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

  /**
   * Wait for ServerInfo message (used with transport-based connections)
   */
  private waitForServerInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for ServerInfo"));
      }, 30000);

      const checkServerInfo = () => {
        if (this.serverInfo.value) {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check if already have server info
      checkServerInfo();

      // Listen for server info via event
      const unsubscribe = this.subscribe(EventType.CONNECTED, () => {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });
    });
  }

  /**
   * Handle messages from the transport (for remote connections)
   */
  private handleTransportMessage(msg: any): void {
    // Handle ServerInfo message
    if ("server_version" in msg && !this.serverInfo.value) {
      console.info("[API] ServerInfo received via transport", msg);
      this.handleServerInfoMessage(msg as ServerInfoMessage);
      return;
    }

    // Handle regular messages
    if ("event" in msg) {
      this.handleEventMessage(msg as EventMessage);
    } else if ("message_id" in msg) {
      this.handleResultMessage(msg);
    } else {
      console.error("[API] received unknown message", msg);
    }
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

  public getLibraryTracks(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
  ): Promise<Track[]> {
    return this.sendCommand("music/tracks/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
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

  public getLibraryArtists(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    album_artists_only?: boolean,
  ): Promise<Artist[]> {
    return this.sendCommand("music/artists/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      album_artists_only,
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
  ): Promise<Track[]> {
    return this.sendCommand("music/artists/artist_tracks", {
      item_id,
      provider_instance_id_or_domain,
      in_library_only,
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

  public getLibraryAlbums(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    album_types?: Array<AlbumType | string>,
  ): Promise<Album[]> {
    return this.sendCommand("music/albums/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
      album_types,
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

  public getLibraryPlaylists(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
  ): Promise<Playlist[]> {
    return this.sendCommand("music/playlists/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
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
  ): Promise<Track[]> {
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

  public getLibraryRadios(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
  ): Promise<Radio[]> {
    return this.sendCommand("music/radios/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
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
  public getLibraryAudiobooks(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
  ): Promise<Audiobook[]> {
    return this.sendCommand("music/audiobooks/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
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
  public getLibraryPodcasts(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
  ): Promise<Podcast[]> {
    return this.sendCommand("music/podcasts/library_items", {
      favorite,
      search,
      limit,
      offset,
      order_by,
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

  // BuiltinPlayer related functions/commands

  public async registerBuiltinPlayer(
    player_name: string,
    player_id?: string,
  ): Promise<Player> {
    return this.sendCommand("builtin_player/register", {
      player_name,
      player_id,
    });
  }

  public async unregisterBuiltinPlayer(player_id: string): Promise<Player> {
    return this.sendCommand("builtin_player/unregister", { player_id });
  }

  public async updateBuiltinPlayerState(
    player_id: string,
    state: BuiltinPlayerState,
  ): Promise<boolean> {
    return this.sendCommand("builtin_player/update_state", {
      player_id,
      state,
    });
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

  public async getPlayerConfigs(provider?: string): Promise<PlayerConfig[]> {
    // Return all known player configurations, optionally filtered by provider domain.
    return this.sendCommand("config/players", { provider });
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
      if (queueId in this.queues)
        this.queues[queueId].elapsed_time = msg.data as unknown as number;
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
    } else if (msg.event == EventType.PROVIDERS_UPDATED) {
      const providers: { [instance_id: string]: ProviderInstance } = {};
      for (const prov of msg.data as ProviderInstance[]) {
        providers[prov.instance_id] = prov;
      }
      this.providers = providers;
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
      store.activeAlert = {
        type: AlertType.ERROR,
        message: msg.details || msg.error_code,
        persistent: false,
      };
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
    this.fetchesInProgress.value = this.fetchesInProgress.value.filter(
      (x) => x != msg.message_id,
    );

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
    this.state.value = ConnectionState.CONNECTED;
    // For remote connections, don't fetch state until authenticated
    // For local connections, fetch state immediately
    if (!this.isRemoteConnection.value) {
      this._fetchState();
    }
    this.signalEvent({
      event: EventType.CONNECTED,
      object_id: "",
      data: msg,
    });
  }

  private signalEvent(evt: MassEvent) {
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

  public sendCommand<Result>(
    command: string,
    args?: Record<string, any>,
  ): Promise<Result> {
    // send command to the server and return promise where the result can be returned
    const cmdId = this._genCmdId();
    return new Promise((resolve, reject) => {
      this.commands.set(cmdId, { resolve, reject });
      this.fetchesInProgress.value.push(cmdId);
      this._sendCommand(command, args, cmdId);
    });
  }

  private _sendCommand(
    command: string,
    args?: Record<string, any>,
    msgId?: string,
  ): void {
    if (this.state.value !== ConnectionState.CONNECTED) {
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

    // Send via transport if available (remote connection), otherwise use WebSocket
    if (this.transport) {
      this.transport.send(msgStr);
    } else if (this.ws) {
      this.ws.send(msgStr);
    } else {
      throw new Error("No connection available");
    }
  }

  private async _fetchState() {
    // fetch full initial state
    for (const player of await this.getPlayers()) {
      // ignore unavailable players in the initial state
      if (!player.available) continue;
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
}

export const api = new MusicAssistantApi();
export default api;
