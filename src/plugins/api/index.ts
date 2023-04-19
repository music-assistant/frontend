import { store } from "../store";
/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  WebsocketBuilder,
  Websocket,
  WebsocketEvents,
  LinearBackoff,
} from "websocket-ts";
import { reactive, ref } from "vue";
import {
  type Connection,
  createConnection,
  ERR_HASS_HOST_REQUIRED,
  getAuth,
} from "home-assistant-js-websocket";

import {
  type Artist,
  type Album,
  type Track,
  type Radio,
  type Playlist,
  type Player,
  type PlayerQueue,
  type PagedItems,
  type MediaItemType,
  type MediaType,
  type BrowseFolder,
  type QueueItem,
  QueueOption,
  type ProviderInstance,
  type MassEvent,
  EventType,
  type EventMessage,
  type ServerInfoMessage,
  type SuccessResultMessage,
  type ErrorResultMessage,
  type CommandMessage,
  type SyncTask,
  RepeatMode,
  SearchResults,
  ProviderManifest,
  ChunkedResultMessage,
  ProviderType,
  ProviderConfig,
  ConfigValueType,
  ConfigEntry,
  PlayerConfig,
} from "./interfaces";

const DEBUG = true;

export interface Library {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  radios: Radio[];
  playlists: Playlist[];
  artistsFetched: boolean;
  albumsFetched: boolean;
  tracksFetched: boolean;
  radiosFetched: boolean;
  playlistsFetched: boolean;
}

export enum ConnectionState {
  DISCONNECTED = 0,
  CONNECTING = 1,
  CONNECTED = 2,
}

export interface chunkCallback {
  (data: Array<any>): void;
}

export class MusicAssistantApi {
  private ws?: Websocket;
  private commandId: number;
  private _throttleId?: any;
  public baseUrl?: string;
  public state = ref<ConnectionState>(ConnectionState.DISCONNECTED);
  public serverInfo = ref<ServerInfoMessage>();
  public players = reactive<{ [player_id: string]: Player }>({});
  public queues = reactive<{ [queue_id: string]: PlayerQueue }>({});
  public providers = reactive<{ [instance_id: string]: ProviderInstance }>({});
  public providerManifests = reactive<{ [domain: string]: ProviderManifest }>(
    {}
  );
  public syncTasks = ref<SyncTask[]>([]);
  public fetchesInProgress = ref<number[]>([]);
  private eventCallbacks: Array<[string, CallableFunction]>;
  private commands: Map<
    number,
    {
      resolve: (result?: any) => void;
      reject: (err: any) => void;
      chunkCallback?: chunkCallback;
    }
  >;

  constructor() {
    this.commandId = 0;
    this.eventCallbacks = [];
    this.commands = new Map();
  }

  public async initialize(baseUrl: string) {
    if (this.ws) throw "already initialized";
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    this.baseUrl = baseUrl;
    const wsUrl = baseUrl.replace("http", "ws") + "/ws";
    console.log(`Connecting to Music Assistant API ${wsUrl}`);
    this.state.value = ConnectionState.CONNECTING;
    // connect to the websocket api
    this.ws = new WebsocketBuilder(wsUrl)
      .onOpen((i, ev) => {
        console.log("connection opened");
      })
      .onClose((i, ev) => {
        console.log("connection closed");
        this.state.value = ConnectionState.DISCONNECTED;
      })
      .onError((i, ev) => {
        console.log("error on connection");
      })
      .onMessage((i, ev) => {
        // Message retrieved on the websocket
        const msg = JSON.parse(ev.data);
        if ("event" in msg) {
          this.handleEventMessage(msg as EventMessage);
        } else if ("server_version" in msg) {
          this.handleServerInfoMessage(msg as ServerInfoMessage);
        } else if ("message_id" in msg && "is_last_chunk" in msg) {
          this.handleChunkedResultMessage(msg);
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

  public subscribe(eventFilter: EventType, callback: CallableFunction) {
    // subscribe a listener for events
    // returns handle to remove the listener
    const listener: [EventType, CallableFunction] = [eventFilter, callback];
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
    callback: CallableFunction
  ) {
    // subscribe a listener for multiple events
    // returns handle to remove the listener
    const removeCallbacks: CallableFunction[] = [];
    for (const eventFilter of eventFilters) {
      removeCallbacks.push(this.subscribe(eventFilter, callback));
    }
    const removeCallback = () => {
      for (const cb of removeCallbacks) {
        cb();
      }
    };
    return removeCallback;
  }

  public getTracks(
    in_library?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string
  ): Promise<PagedItems> {
    return this.getData("music/tracks", {
      in_library,
      search,
      limit,
      offset,
      order_by,
    });
  }

  public getTrack(
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
    lazy?: boolean,
    album?: string
  ): Promise<Track> {
    return this.getData("music/track", {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
      album_uri: album,
    });
  }

  public getTrackVersions(
    item_id: string,
    provider_instance_id_or_domain: string
  ): Promise<Track[]> {
    return this.getData("music/track/versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getTrackAlbums(
    item_id: string,
    provider_instance_id_or_domain: string
  ): Promise<Album[]> {
    return this.getData("music/track/albums", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getTrackPreviewUrl(
    provider_instance_id_or_domain: string,
    item_id: string
  ): Promise<string> {
    return this.getData("music/track/preview", {
      provider_instance_id_or_domain,
      item_id,
    });
  }

  public getArtists(
    in_library?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string
  ): Promise<PagedItems> {
    return this.getData("music/artists", {
      in_library,
      search,
      limit,
      offset,
      order_by,
    });
  }

  public getAlbumArtists(
    in_library?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string
  ): Promise<PagedItems> {
    return this.getData("music/albumartists", {
      in_library,
      search,
      limit,
      offset,
      order_by,
    });
  }

  public getArtist(
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
    lazy?: boolean
  ): Promise<Artist> {
    return this.getData("music/artist", {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
    });
  }

  public getArtistTracks(
    item_id: string,
    provider_instance_id_or_domain: string
  ): Promise<Track[]> {
    return this.getData("music/artist/tracks", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getArtistAlbums(
    item_id: string,
    provider_instance_id_or_domain: string
  ): Promise<Album[]> {
    return this.getData("music/artist/albums", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getAlbums(
    in_library?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string
  ): Promise<PagedItems> {
    return this.getData("music/albums", {
      in_library,
      search,
      limit,
      offset,
      order_by,
    });
  }

  public getAlbum(
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
    lazy?: boolean
  ): Promise<Album> {
    return this.getData("music/album", {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
    });
  }

  public getAlbumTracks(
    item_id: string,
    provider_instance_id_or_domain: string
  ): Promise<Track[]> {
    return this.getData("music/album/tracks", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getAlbumVersions(
    item_id: string,
    provider_instance_id_or_domain: string
  ): Promise<Album[]> {
    return this.getData("music/album/versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getPlaylists(
    in_library?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string
  ): Promise<PagedItems> {
    return this.getData("music/playlists", {
      in_library,
      search,
      limit,
      offset,
      order_by,
    });
  }

  public getPlaylist(
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
    lazy?: boolean
  ): Promise<Playlist> {
    return this.getData("music/playlist", {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
    });
  }

  public getPlaylistTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
    chunkCallback?: chunkCallback
  ): Promise<Track[]> {
    return this.getData(
      "music/playlist/tracks",
      {
        item_id,
        provider_instance_id_or_domain,
      },
      chunkCallback
    );
  }

  public addPlaylistTracks(db_playlist_id: string | number, uris: string[]) {
    this.sendCommand("music/playlist/tracks/add", { db_playlist_id, uris });
  }

  public removePlaylistTracks(
    db_playlist_id: string | number,
    positions_to_remove: number[]
  ) {
    this.sendCommand("music/playlist/tracks/remove", {
      db_playlist_id,
      positions_to_remove,
    });
  }

  public createPlaylist(name: string, provider?: string): Promise<Playlist> {
    return this.getData("music/playlist/create", { name, provider });
  }

  public getRadios(
    in_library?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string
  ): Promise<PagedItems> {
    return this.getData("music/radios", {
      in_library,
      search,
      limit,
      offset,
      order_by,
    });
  }

  public getRadio(
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
    lazy?: boolean
  ): Promise<Radio> {
    return this.getData("music/radio", {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
    });
  }

  public getRadioVersions(
    item_id: string,
    provider_instance_id_or_domain: string
  ): Promise<Radio[]> {
    return this.getData("music/radio/versions", {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getItemByUri(
    uri: string,
    force_refresh?: boolean,
    lazy?: boolean
  ): Promise<MediaItemType> {
    // Get single music item providing a mediaitem uri.
    return this.getData("music/item_by_uri", {
      uri,
      force_refresh,
      lazy,
    });
  }

  public refreshItem(media_item: MediaItemType): Promise<MediaItemType> {
    // Try to refresh a mediaitem by requesting it's full object or search for substitutes.
    return this.getData("music/refresh_item", {
      media_item,
    });
  }

  public getItem(
    media_type: MediaType,
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
    lazy?: boolean
  ): Promise<MediaItemType> {
    // Get single music item by id and media type.
    return this.getData("music/item", {
      media_type,
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
    });
  }

  public async addToLibrary(
    media_type: MediaType,
    item_id: string,
    provider_instance_id_or_domain: string
  ) {
    // Add an item to the library.
    this.sendCommand("music/library/add", {
      media_type,
      item_id,
      provider_instance_id_or_domain,
    });
  }
  public async addItemsToLibrary(items: Array<MediaItemType | string>) {
    // Add multiple items to the library (provide uri or MediaItem).
    this.sendCommand("music/library/add_items", { items });
    // optimistically set the value
    for (const item of items) {
      if (typeof item !== "string") {
        item.in_library = true;
      }
    }
  }

  public async removeFromLibrary(
    media_type: MediaType,
    item_id: string,
    provider_instance_id_or_domain: string
  ) {
    // Remove an item from the library.
    this.sendCommand("music/library/remove", {
      media_type,
      item_id,
      provider_instance_id_or_domain,
    });
  }
  public async removeItemsFromLibrary(items: Array<MediaItemType | string>) {
    // Remove multiple items from the library (provide uri or MediaItem).
    this.sendCommand("music/library/remove_items", { items });
    // optimistically set the value
    for (const item of items) {
      if (typeof item !== "string") {
        item.in_library = false;
      }
    }
  }

  public async toggleLibrary(item: MediaItemType) {
    // Toggle in_library for a media item
    if (item.in_library) {
      await this.removeItemsFromLibrary([item]);
    } else {
      await this.addItemsToLibrary([item]);
    }
  }

  public async deleteDbItem(
    media_type: MediaType,
    db_item_id: string | number,
    recursive = false
  ) {
    // Remove item from the database.
    this.sendCommand("music/delete", {
      media_type,
      db_item_id,
      recursive,
    });
  }

  public browse(path?: string): Promise<BrowseFolder> {
    // Browse Music providers.
    return this.getData("music/browse", { path });
  }

  public search(
    search_query: string,
    media_types?: MediaType[],
    limit?: number
  ): Promise<SearchResults> {
    // Perform global search for media items on all providers.
    return this.getData("music/search", { search_query, media_types, limit });
  }

  // PlayerQueue related functions/commands

  public async getPlayerQueues(): Promise<PlayerQueue[]> {
    // Get all registered PlayerQueues
    return this.getData("players/queue/all");
  }

  public getPlayerQueueItems(
    queue_id: string,
    chunkCallback?: chunkCallback
  ): Promise<Track[]> {
    // Get all QueueItems for given PlayerQueue
    return this.getData(
      "players/queue/items",
      {
        queue_id,
      },
      chunkCallback
    );
  }

  public queueCommandPlay(queueId: string) {
    // Handle PLAY command for given queue.
    this.playerQueueCommand(queueId, "play");
  }
  public queueCommandPause(queueId: string) {
    // Handle PAUSE command for given queue.
    this.playerQueueCommand(queueId, "pause");
  }
  public queueCommandPlayPause(queueId: string) {
    // Toggle play/pause on given playerqueue.
    this.playerQueueCommand(queueId, "play_pause");
  }
  public queueCommandStop(queueId: string) {
    // Handle STOP command for given queue.
    this.playerQueueCommand(queueId, "stop");
  }
  public queueCommandNext(queueId: string) {
    // Handle NEXT TRACK command for given queue.
    this.playerQueueCommand(queueId, "next");
  }
  public queueCommandPrevious(queueId: string) {
    // Handle PREVIOUS TRACK command for given queue.
    this.playerQueueCommand(queueId, "previous");
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
    pos_shift: number = 1
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
    item_id_or_index: number | string
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
  public queueCommandCrossfade(queueId: string, crossfade_enabled: boolean) {
    // Configure crossfade setting on the the queue.
    this.playerQueueCommand(queueId, "crossfade", { crossfade_enabled });
  }
  public queueCommandCrossfadeToggle(queueId: string) {
    // Toggle crossfade mode for a queue
    this.queueCommandCrossfade(
      queueId,
      !this.queues[queueId].crossfade_enabled
    );
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
  public playerQueueCommand(
    queue_id: string,
    command: string,
    args?: Record<string, any>
  ) {
    /*
      Handle (throttled) command to player 
    */
    clearTimeout(this._throttleId);
    // apply a bit of throttling here
    this._throttleId = setTimeout(() => {
      this.sendCommand(`players/queue/${command}`, {
        queue_id,
        ...args,
      });
    }, 200);
  }

  // Player related functions/commands

  public async getPlayers(): Promise<Player[]> {
    // Get all registered players.
    return this.getData("players/all");
  }

  public playerCommandStop(playerId: string) {
    this.playerCommand(playerId, "stop");
  }

  public playerCommandPower(playerId: string, powered: boolean) {
    this.playerCommand(playerId, "power", { powered });
  }

  public playerCommandPowerToggle(playerId: string) {
    this.playerCommandPower(playerId, !this.players[playerId].powered);
  }

  public playerCommandVolumeSet(playerId: string, newVolume: number) {
    this.playerCommand(playerId, "volume_set", {
      volume_level: newVolume,
    });
    this.players[playerId].volume_level = newVolume;
  }
  public playerCommandVolumeUp(playerId: string) {
    this.playerCommandVolumeSet(
      playerId,
      this.players[playerId].volume_level + 5
    );
  }
  public playerCommandVolumeDown(playerId: string) {
    this.playerCommandVolumeSet(
      playerId,
      this.players[playerId].volume_level - 5
    );
  }
  public playerCommandVolumeMute(playerId: string, muted: boolean) {
    this.playerCommand(playerId, "volume_mute", {
      muted,
    });
    this.players[playerId].volume_muted = muted;
  }

  public playerCommandGroupVolume(queueId: string, newVolume: number) {
    /*
      Send VOLUME_SET command to given playergroup.

      Will send the new (average) volume level to group childs.
        - player_id: player_id of the playergroup to handle the command.
        - volume_level: volume level (0..100) to set on the player.
    */
    this.playerCommand(queueId, "group_volume", {
      volume_level: newVolume,
    });
    this.players[queueId].group_volume = newVolume;
  }

  public playerCommandSync(playerId: string, target_player: string) {
    /*
      Handle SYNC command for given player.

      Join/add the given player(id) to the given (master) player/sync group.
      If the player is already synced to another player, it will be unsynced there first.
      If the target player itself is already synced to another player, this will fail.
      If the player can not be synced with the given target player, this will fail.

          - player_id: player_id of the player to handle the command.
          - target_player: player_id of the syncgroup master or group player.
    */
    this.playerCommand(playerId, "sync", {
      target_player,
    });
  }

  public playerCommandUnSync(playerId: string) {
    /*
      Handle UNSYNC command for given player.

      Remove the given player from any syncgroups it currently is synced to.
      If the player is not currently synced to any other player,
      this will silently be ignored.

          - player_id: player_id of the player to handle the command.
    */
    this.playerCommand(playerId, "unsync");
  }

  public playerCommand(
    player_id: string,
    command: string,
    args?: Record<string, any>
  ) {
    /*
      Handle (throttled) command to player 
    */
    clearTimeout(this._throttleId);
    // apply a bit of throttling here (for the volume and seek sliders especially)
    this._throttleId = setTimeout(() => {
      this.sendCommand(`players/cmd/${command}`, {
        player_id,
        ...args,
      });
    }, 200);
  }

  // PlayerGroup related functions/commands

  public setPlayerGroupMembers(player_id: string, members: string[]) {
    /*
      Update the memberlist of the given PlayerGroup.

          - player_id: player_id of the groupplayer to handle the command.
          - members: list of player ids to set as members.
    */
    this.sendCommand(`players/cmd/set_members`, {
      player_id,
      members,
    });
  }

  public createPlayerGroup(provider: string, name: string): Promise<Player> {
    /*
      Handle CREATE_GROUP command on the given player provider.

        - name: name for the new group.
        - provider: provider domain or instance id of the player provider.
          defaults to the `universal_group` provider


        Returns the newly created PlayerGroup.
    */
    return this.getData(`players/cmd/create_group`, {
      name,
      provider,
    });
  }

  public deletePlayerGroup(provider: string, name: string) {
    /*
      Handle DELETE_GROUP command on the given player provider.

        - player_id: id of the group player to remove.
    */
    this.sendCommand(`players/cmd/delete_group`, {
      name,
      provider,
    });
  }

  // Play Media related functions

  public playMedia(
    media: string | string[] | MediaItemType | MediaItemType[],
    option: QueueOption = QueueOption.PLAY,
    radio_mode?: boolean,
    queue_id?: string
  ) {
    if (!queue_id && store.selectedPlayer && store.selectedPlayer?.active_source in this.players) {
      queue_id = store.selectedPlayer?.active_source;
    }
    else if (!queue_id) {
      queue_id = store.selectedPlayer?.player_id;
    }
    this.sendCommand("players/queue/play_media", {
      queue_id,
      media,
      option,
      radio_mode,
    });
  }

  public async playPlaylistFromIndex(
    playlist: Playlist,
    startIndex: number,
    queue_id?: string
  ) {
    const tracks = await this.getPlaylistTracks(
      playlist.item_id,
      playlist.provider
    );
    // to account for shuffle, we play the first track and append the rest
    this.playMedia(
      tracks[startIndex],
      QueueOption.REPLACE,
      undefined,
      queue_id
    );
    this.playMedia(
      tracks.slice(startIndex + 1),
      QueueOption.ADD,
      undefined,
      queue_id
    );
  }

  public async playAlbumFromItem(
    album: Album,
    startItem: Track,
    queue_id?: string
  ) {
    const tracks = await this.getAlbumTracks(album.item_id, album.provider);
    let startIndex = 0;
    tracks.forEach(function (track, i) {
      if (track.item_id == startItem.item_id) {
        startIndex = i;
      }
    });
    // to account for shuffle, we play the first track and append the rest
    this.playMedia(
      tracks[startIndex],
      QueueOption.REPLACE,
      undefined,
      queue_id
    );
    this.playMedia(
      tracks.slice(startIndex + 1),
      QueueOption.ADD,
      undefined,
      queue_id
    );
  }

  // ProviderConfig related functions

  public async getProviderConfigs(
    provider_type?: ProviderType,
    provider_domain?: string
  ): Promise<ProviderConfig[]> {
    // Return all known provider configurations, optionally filtered by ProviderType or domain.
    return this.getData("config/providers", { provider_type, provider_domain });
  }

  public async getProviderConfig(instance_id: string): Promise<ProviderConfig> {
    // Return configuration for a single provider.
    return this.getData("config/providers/get", { instance_id });
  }

  public async getProviderConfigEntries(
    provider_domain: string,
    instance_id?: string,
    action?: string,
    values?: Record<string, ConfigValueType>
  ): Promise<ConfigEntry[]> {
    // Return Config entries to setup/configure a provider.
    // provider_domain: (mandatory) domain of the provider.
    // instance_id: id of an existing provider instance (None for new instance setup).
    // action: [optional] action key called from config entries UI.
    // values: the (intermediate) raw values for config entries sent with the action.
    return this.getData("config/providers/get_entries", {
      provider_domain,
      instance_id,
      action,
      values,
    });
  }

  public async saveProviderConfig(
    provider_domain: string,
    values: Record<string, ConfigValueType>,
    instance_id?: string
  ): Promise<ProviderConfig> {
    // Save Provider(instance) Config.
    // provider_domain: (mandatory) domain of the provider.
    // values: the raw values for config entries that need to be stored/updated.
    // instance_id: id of an existing provider instance (None for new instance setup).
    // action: [optional] action key called from config entries UI.
    return this.getData("config/providers/save", {
      provider_domain,
      values,
      instance_id,
    });
  }

  public removeProviderConfig(instance_id: string) {
    // Remove ProviderConfig.
    this.sendCommand("config/providers/remove", {
      instance_id,
    });
  }

  public reloadProvider(instance_id: string) {
    // Reload Provider(instance).
    this.sendCommand("config/providers/reload", {
      instance_id,
    });
  }

  // PlayerConfig related functions

  public async getPlayerConfigs(provider?: string): Promise<PlayerConfig[]> {
    // Return all known player configurations, optionally filtered by provider domain.
    return this.getData("config/players", { provider });
  }

  public async getPlayerConfig(player_id: string): Promise<PlayerConfig> {
    // Return configuration for a single player.
    return this.getData("config/players/get", { player_id });
  }

  public async getPlayerConfigValue(
    player_id: string,
    key: string
  ): Promise<PlayerConfig> {
    // Return single configentry value for a player.
    return this.getData("config/players/get_value", { player_id, key });
  }

  public async savePlayerConfig(
    player_id: string,
    values: Record<string, ConfigValueType>
  ): Promise<PlayerConfig> {
    // Save/update PlayerConfig.
    return this.getData("config/players/save", {
      player_id,
      values,
    });
  }

  public removePlayerConfig(player_id: string) {
    // remove the configuration of a player
    this.sendCommand("config/players/remove", {
      player_id,
    });
  }

  // Other (utility) functions

  public startSync(media_types?: MediaType[], providers?: string[]) {
    // Start running the sync of (all or selected) musicproviders.
    // media_types: only sync these media types. omit for all.
    // providers: only sync these provider domains. omit for all.
    this.sendCommand("music/sync", { media_types, providers });
  }

  private async connectHass() {
    // TODO
    // Connect to Music Assistant by using the Home Assistant API
    let auth;
    const authOptions = {
      async loadTokens() {
        try {
          return JSON.parse(localStorage.hassTokens);
        } catch (err) {
          return undefined;
        }
      },
      saveTokens: (tokens: any) => {
        localStorage.hassTokens = JSON.stringify(tokens);
      },
      hassUrl: "",
    };
    try {
      auth = await getAuth(authOptions);
    } catch (err) {
      if (err === ERR_HASS_HOST_REQUIRED) {
        authOptions.hassUrl =
          prompt(
            "Please enter the URL to Home Assistant",
            "http://homeassistant.local:8123"
          ) || "";
        if (!authOptions.hassUrl) return;
        auth = await getAuth(authOptions);
      } else {
        alert(`Unknown error: ${err}`);
        return;
      }
    }
    const connection = await createConnection({ auth });
    connection.addEventListener("ready", () => window.history.back());
    return connection;
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
    if (msg.event !== EventType.QUEUE_TIME_UPDATED) {
      // eslint-disable-next-line no-console
      console.log("[event]", msg);
    }
    this.signalEvent(msg);
  }

  private handleResultMessage(
    msg: SuccessResultMessage | ChunkedResultMessage | ErrorResultMessage
  ) {
    // Handle result of a command
    const resultPromise = this.commands.get(msg.message_id as number);
    if (!resultPromise) return;
    if (DEBUG) {
      console.log("[resultMessage]", msg);
    }

    this.commands.delete(msg.message_id as number);
    this.fetchesInProgress.value = this.fetchesInProgress.value.filter(
      (x) => x != msg.message_id
    );

    if ("error_code" in msg) {
      msg = msg as ErrorResultMessage;
      resultPromise.reject(msg.details || msg.error_code);
    } else {
      msg = msg as SuccessResultMessage;
      resultPromise.resolve(msg.result);
    }
  }

  private handleChunkedResultMessage(
    msg: ChunkedResultMessage | ErrorResultMessage
  ) {
    // Handle result of a command
    const resultPromise = this.commands.get(msg.message_id as number);
    if (!resultPromise) return;
    const lastChunk = "is_last_chunk" in msg && msg.is_last_chunk;
    const isError = "error_code" in msg;
    if (DEBUG) {
      console.log("[chunkedResultMessage]", msg);
    }

    if (isError || lastChunk) {
      this.commands.delete(msg.message_id as number);
      this.fetchesInProgress.value = this.fetchesInProgress.value.filter(
        (x) => x != msg.message_id
      );
    }

    if ("error_code" in msg) {
      msg = msg as ErrorResultMessage;
      resultPromise.reject(msg.details || msg.error_code);
    } else {
      if (resultPromise.chunkCallback) resultPromise.chunkCallback(msg.result);
      if (lastChunk) resultPromise.resolve([]);
    }
  }

  private handleServerInfoMessage(msg: ServerInfoMessage) {
    // Handle ServerInfo message which is sent as first message on connect
    if (DEBUG) {
      console.log("[serverInfo]", msg);
    }
    this.state.value = ConnectionState.CONNECTED;
    this.serverInfo.value = msg;
    // trigger fetch of full state once we are connected to the server
    this._fetchState();
  }

  private signalEvent(evt: MassEvent) {
    // signal event to all listeners
    for (const listener of this.eventCallbacks) {
      if (listener[0] === EventType.ALL || listener[0] === evt.event) {
        listener[1](evt);
      }
    }
  }

  public getData<Result>(
    command: string,
    args?: Record<string, any>,
    chunkCallback?: chunkCallback
  ): Promise<Result> {
    // send command to the server and return promise where the result can be returned
    const cmdId = this._genCmdId();
    return new Promise((resolve, reject) => {
      this.commands.set(cmdId, { resolve, reject, chunkCallback });
      this.fetchesInProgress.value.push(cmdId);
      this.sendCommand(command, args, cmdId);
    });
  }

  public sendCommand(
    command: string,
    args?: Record<string, any>,
    msgId?: number
  ): void {
    if (this.state.value !== ConnectionState.CONNECTED) {
      throw "Connection lost";
    }

    if (!msgId) {
      msgId = this._genCmdId();
    }

    const msg: CommandMessage = {
      command: command,
      message_id: msgId,
      args,
    };

    if (DEBUG) {
      console.log("[sendCommand]", msg);
    }

    this.ws!.send(JSON.stringify(msg));
  }

  private async _fetchState() {
    // fetch full initial state
    for (const player of await this.getPlayers()) {
      this.players[player.player_id] = player;
    }
    for (const queue of await this.getPlayerQueues()) {
      this.queues[queue.queue_id] = queue;
    }

    for (const prov of await this.getData<ProviderManifest[]>(
      "providers/available"
    )) {
      this.providerManifests[prov.domain] = prov;
    }

    for (const prov of await this.getData<ProviderInstance[]>("providers")) {
      this.providers[prov.instance_id] = prov;
    }

    this.syncTasks.value = await this.getData<SyncTask[]>("music/synctasks");
  }

  private _genCmdId() {
    return ++this.commandId;
  }
}

export const api = new MusicAssistantApi();
export default api;
