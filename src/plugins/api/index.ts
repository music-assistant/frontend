import { AlertType, store } from '../store';
/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { WebsocketBuilder, Websocket, LinearBackoff } from 'websocket-ts';
import { computed, reactive, ref } from 'vue';
import {
  createConnection,
  ERR_HASS_HOST_REQUIRED,
  getAuth,
} from 'home-assistant-js-websocket';

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
  MediaType,
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
  ProviderType,
  ProviderConfig,
  ConfigValueType,
  ConfigEntry,
  PlayerConfig,
  CoreConfig,
  ItemMapping,
} from './interfaces';

const DEBUG = process.env.NODE_ENV === 'development';

export enum ConnectionState {
  DISCONNECTED = 0,
  CONNECTING = 1,
  CONNECTED = 2,
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
    {},
  );
  public syncTasks = ref<SyncTask[]>([]);
  public fetchesInProgress = ref<number[]>([]);
  private eventCallbacks: Array<[EventType, string, CallableFunction]>;
  private commands: Map<
    number,
    {
      resolve: (result?: any) => void;
      reject: (err: any) => void;
    }
  >;

  constructor() {
    this.commandId = 0;
    this.eventCallbacks = [];
    this.commands = new Map();
  }

  public async initialize(baseUrl: string) {
    if (this.ws) throw new Error('already initialized');
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    this.baseUrl = baseUrl;
    const wsUrl = baseUrl.replace('http', 'ws') + '/ws';
    console.log(`Connecting to Music Assistant API ${wsUrl}`);
    this.state.value = ConnectionState.CONNECTING;
    // connect to the websocket api
    this.ws = new WebsocketBuilder(wsUrl)
      .onOpen((i, ev) => {
        console.log('connection opened');
      })
      .onClose((i, ev) => {
        console.log('connection closed');
        this.state.value = ConnectionState.DISCONNECTED;
      })
      .onError((i, ev) => {
        console.log('error on connection');
      })
      .onMessage((i, ev) => {
        // Message retrieved on the websocket
        const msg = JSON.parse(ev.data);
        if ('event' in msg) {
          this.handleEventMessage(msg as EventMessage);
        } else if ('server_version' in msg) {
          this.handleServerInfoMessage(msg as ServerInfoMessage);
        } else if ('message_id' in msg) {
          this.handleResultMessage(msg);
        } else {
          // unknown message receoved
          console.error('received unknown message', msg);
        }
      })
      .onRetry((i, ev) => {
        console.log('retry');
        this.state.value = ConnectionState.CONNECTING;
      })
      .withBackoff(new LinearBackoff(0, 1000, 12000))
      .build();
  }

  public setUpCompleted = computed(() => {
    // Return if we have any music or player providers configured
    // in the future we could replace this if some sort of out of the box setup wizard has been completed
    return (
      Object.values(api.providers).filter(
        (prov) =>
          [ProviderType.MUSIC, ProviderType.PLAYER].includes(prov.type) &&
          prov.domain !== 'builtin',
      ).length > 0
    );
  });

  public subscribe(
    eventFilter: EventType,
    callback: CallableFunction,
    object_id: string = '*',
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
    object_id: string = '*',
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
  ): Promise<PagedItems> {
    return this.getData('music/tracks/library_items', {
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
    return this.getData('music/tracks/get_track', {
      item_id,
      provider_instance_id_or_domain,
      album_uri: album_uri,
    });
  }

  public getTrackVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Track[]> {
    return this.getData('music/tracks/track_versions', {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getTrackAlbums(
    item_id: string,
    provider_instance_id_or_domain: string,
    in_library_only = false,
  ): Promise<Album[]> {
    return this.getData('music/tracks/track_albums', {
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
    return `${api.baseUrl}/preview?item_id=${encItemId}&provider=${provider_instance_id_or_domain}`;
  }

  public getLibraryArtists(
    favorite?: boolean,
    search?: string,
    limit?: number,
    offset?: number,
    order_by?: string,
    album_artists_only?: boolean,
  ): Promise<PagedItems> {
    return this.getData('music/artists/library_items', {
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
    return this.getData('music/artists/get_artist', {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getArtistTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
    in_library_only = false,
  ): Promise<Track[]> {
    return this.getData('music/artists/artist_tracks', {
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
    return this.getData('music/artists/artist_albums', {
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
  ): Promise<PagedItems> {
    return this.getData('music/albums/library_items', {
      favorite,
      search,
      limit,
      offset,
      order_by,
    });
  }

  public getAlbum(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Album> {
    return this.getData('music/albums/get_album', {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getAlbumTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
    in_library_only = false,
  ): Promise<Track[]> {
    return this.getData('music/albums/album_tracks', {
      item_id,
      provider_instance_id_or_domain,
      in_library_only,
    });
  }

  public getAlbumVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Album[]> {
    return this.getData('music/albums/album_versions', {
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
  ): Promise<PagedItems> {
    return this.getData('music/playlists/library_items', {
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
    force_refresh?: boolean,
    lazy?: boolean,
  ): Promise<Playlist> {
    return this.getData('music/playlists/get_playlist', {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
    });
  }

  public getPlaylistTracks(
    item_id: string,
    provider_instance_id_or_domain: string,
    force_refresh?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<PagedItems> {
    return this.getData('music/playlists/playlist_tracks', {
      item_id,
      provider_instance_id_or_domain,
      limit,
      offset,
      force_refresh,
    });
  }

  public addPlaylistTracks(db_playlist_id: string | number, uris: string[]) {
    this.sendCommand('music/playlists/add_playlist_tracks', {
      db_playlist_id,
      uris,
    });
  }

  public removePlaylistTracks(
    db_playlist_id: string | number,
    positions_to_remove: number[],
  ) {
    this.sendCommand('music/playlists/remove_playlist_tracks', {
      db_playlist_id,
      positions_to_remove,
    });
  }

  public createPlaylist(
    name: string,
    provider_instance_or_domain?: string,
  ): Promise<Playlist> {
    return this.getData('music/playlists/create_playlist', {
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
  ): Promise<PagedItems> {
    return this.getData('music/radios/library_items', {
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
    force_refresh?: boolean,
    lazy?: boolean,
  ): Promise<Radio> {
    return this.getData('music/radios/get_radio', {
      item_id,
      provider_instance_id_or_domain,
      force_refresh,
      lazy,
    });
  }

  public getRadioVersions(
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<Radio[]> {
    return this.getData('music/radios/radio_versions', {
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public getItemByUri(uri: string): Promise<MediaItemType> {
    // Get single music item providing a mediaitem uri.
    return this.getData('music/item_by_uri', {
      uri,
    });
  }

  public refreshItem(
    media_item: MediaItemType | ItemMapping,
  ): Promise<MediaItemType> {
    // Try to refresh a mediaitem by requesting it's full object or search for substitutes.
    return this.getData('music/refresh_item', {
      media_item,
    });
  }

  public getItem(
    media_type: MediaType,
    item_id: string,
    provider_instance_id_or_domain: string,
  ): Promise<MediaItemType> {
    // Get single music item by id and media type.
    return this.getData('music/item', {
      media_type,
      item_id,
      provider_instance_id_or_domain,
    });
  }

  public async addItemToLibrary(item: string | MediaItemType | ItemMapping) {
    // Add an item (uri or mediaitem) to the library.
    this.sendCommand('music/library/add_item', {
      item,
    });
  }

  public async removeItemFromLibrary(
    media_type: MediaType,
    library_item_id: string | number,
  ) {
    // Remove an item from the library.
    this.sendCommand('music/library/remove_item', {
      media_type,
      library_item_id,
    });
  }

  public async addItemToFavorites(item: string | MediaItemType | ItemMapping) {
    // Add an item (uri or mediaitem) to the favorites.
    this.sendCommand('music/favorites/add_item', {
      item,
    });
    // optimistically set the value
    if (typeof item !== 'string' && 'favorite' in item) {
      item.favorite = true;
    }
  }
  public async removeItemFromFavorites(
    media_type: MediaType,
    library_item_id: string | number,
  ) {
    // Add an item (uri or mediaitem) to the favorites.
    this.sendCommand('music/favorites/remove_item', {
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

  public browse(
    offset: number,
    limit: number,
    path?: string,
  ): Promise<PagedItems> {
    // Browse Music providers.
    return this.getData('music/browse', { offset, limit, path });
  }

  public search(
    search_query: string,
    media_types?: MediaType[],
    limit?: number,
  ): Promise<SearchResults> {
    // Perform global search for media items on all providers.
    return this.getData('music/search', { search_query, media_types, limit });
  }

  public async getRecentlyPlayedItems(
    limit = 10,
    media_types: MediaType[] = [MediaType.TRACK, MediaType.RADIO],
  ): Promise<MediaItemType[]> {
    return this.getData('music/recently_played_items', {
      limit,
      media_types,
    });
  }

  // PlayerQueue related functions/commands

  public async getPlayerQueues(): Promise<PlayerQueue[]> {
    // Get all registered PlayerQueues
    return this.getData('player_queues/all');
  }

  public getPlayerQueueItems(
    queue_id: string,
    limit: number,
    offset: number,
  ): Promise<PagedItems> {
    // Get all QueueItems for given PlayerQueue
    return this.getData('player_queues/items', {
      queue_id,
      limit,
      offset,
    });
  }

  public queueCommandPlay(queueId: string) {
    // Handle PLAY command for given queue.
    this.playerQueueCommand(queueId, 'play');
  }
  public queueCommandPause(queueId: string) {
    // Handle PAUSE command for given queue.
    this.playerQueueCommand(queueId, 'pause');
  }
  public queueCommandPlayPause(queueId: string) {
    // Toggle play/pause on given playerqueue.
    this.playerQueueCommand(queueId, 'play_pause');
  }
  public queueCommandStop(queueId: string) {
    // Handle STOP command for given queue.
    this.playerQueueCommand(queueId, 'stop');
  }
  public queueCommandNext(queueId: string) {
    // Handle NEXT TRACK command for given queue.
    this.playerQueueCommand(queueId, 'next');
  }
  public queueCommandPrevious(queueId: string) {
    // Handle PREVIOUS TRACK command for given queue.
    this.playerQueueCommand(queueId, 'previous');
  }
  public queueCommandClear(queueId: string) {
    // Clear all items in the queue.
    this.playerQueueCommand(queueId, 'clear');
  }
  public queueCommandPlayIndex(queueId: string, index: number | string) {
    // Play item at index (or item_id) X in queue.
    this.playerQueueCommand(queueId, 'play_index', { index });
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
    this.playerQueueCommand(queueId, 'move_item', { queue_item_id, pos_shift });
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
    this.playerQueueCommand(queueId, 'delete_item', { item_id_or_index });
  }

  public queueCommandSeek(queueId: string, position: number) {
    // Handle SEEK command for given queue.
    // - position: position in seconds to seek to in the current playing item.
    this.playerQueueCommand(queueId, 'seek', { position });
  }
  public queueCommandSkip(queueId: string, seconds: number) {
    // Handle SKIP command for given queue.
    // - seconds: number of seconds to skip in track. Use negative value to skip back.
    this.playerQueueCommand(queueId, 'skip', { seconds });
  }
  public queueCommandSkipAhead(queueId: string) {
    this.queueCommandSkip(queueId, 10);
  }
  public queueCommandSkipBack(queueId: string) {
    this.queueCommandSkip(queueId, -10);
  }
  public queueCommandShuffle(queueId: string, shuffle_enabled: boolean) {
    // Configure shuffle setting on the the queue.
    this.playerQueueCommand(queueId, 'shuffle', { shuffle_enabled });
  }
  public queueCommandShuffleToggle(queueId: string) {
    // Toggle shuffle mode for a queue
    this.queueCommandShuffle(queueId, !this.queues[queueId].shuffle_enabled);
  }
  public queueCommandRepeat(queueId: string, repeat_mode: RepeatMode) {
    // Configure repeat setting on the the queue.
    this.playerQueueCommand(queueId, 'repeat', { repeat_mode });
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
    args?: Record<string, any>,
  ) {
    /*
      Handle (throttled) command to player
    */
    clearTimeout(this._throttleId);
    // apply a bit of throttling here
    this._throttleId = setTimeout(() => {
      this.sendCommand(`player_queues/${command}`, {
        queue_id,
        ...args,
      });
    }, 200);
  }

  // Player related functions/commands

  public async getPlayers(): Promise<Player[]> {
    // Get all registered players.
    return this.getData('players/all');
  }

  public playerCommandStop(playerId: string) {
    this.playerCommand(playerId, 'stop');
  }

  public playerCommandPower(playerId: string, powered: boolean) {
    this.playerCommand(playerId, 'power', { powered });
  }

  public playerCommandPowerToggle(playerId: string) {
    this.playerCommandPower(playerId, !this.players[playerId].powered);
  }

  public playerCommandVolumeSet(playerId: string, newVolume: number) {
    newVolume = Math.max(newVolume, 0);
    newVolume = Math.min(newVolume, 100);

    this.playerCommand(playerId, 'volume_set', {
      volume_level: newVolume,
    });
    this.players[playerId].volume_level = newVolume;
  }
  public playerCommandVolumeUp(playerId: string) {
    this.playerCommand(playerId, 'volume_up');
  }
  public playerCommandVolumeDown(playerId: string) {
    this.playerCommand(playerId, 'volume_down');
  }
  public playerCommandVolumeMute(playerId: string, muted: boolean) {
    this.playerCommand(playerId, 'volume_mute', {
      muted,
    });
    this.players[playerId].volume_muted = muted;
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
    this.playerCommand(playerId, 'sync', {
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
    this.playerCommand(playerId, 'unsync');
  }

  public playerCommandSyncMany(
    target_player: string,
    child_player_ids: string[],
  ) {
    /*
      Create temporary sync group by joining given players to target player.
    */
    this.sendCommand('players/cmd/sync_many', {
      target_player,
      child_player_ids,
    });
  }

  public playerCommandUnSyncMany(player_ids: string[]) {
    /*
      Handle UNSYNC command for all the given players.
    */
    this.sendCommand('players/cmd/unsync_many', {
      player_ids,
    });
  }

  public playerCommand(
    player_id: string,
    command: string,
    args?: Record<string, any>,
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

  public playerCommandGroupVolume(playerId: string, newVolume: number) {
    /*
      Send VOLUME_SET command to given playergroup.

      Will send the new (average) volume level to group child's.
        - playerId: player_id of the playergroup to handle the command.
        - newVolume: volume level (0..100) to set on the player.
    */
    this.playerCommand(playerId, 'group_volume', {
      volume_level: newVolume,
    });
    this.players[playerId].group_volume = newVolume;
  }

  public playerCommandGroupPower(playerId: string, newPower: boolean) {
    /*
      Send POWER command to given playergroup.
    */
    this.playerCommand(playerId, 'group_power', {
      power: newPower,
    });
    this.players[playerId].powered = newPower;
  }

  public async createPlayerGroup(
    provider: string,
    name: string,
    members: string[],
  ): Promise<Player> {
    // Save/update PlayerConfig.
    return this.getData('players/create_group', {
      provider,
      name,
      members,
    });
  }

  // Play Media related functions

  public playMedia(
    media: string | string[] | MediaItemType | MediaItemType[],
    option?: QueueOption,
    radio_mode?: boolean,
    start_item?: string,
    queue_id?: string,
  ) {
    if (
      !queue_id &&
      store.activePlayer &&
      store.activePlayer?.active_source in this.players
    ) {
      queue_id = store.activePlayer?.active_source;
    } else if (!queue_id) {
      queue_id = store.activePlayer?.player_id;
    }
    this.sendCommand('player_queues/play_media', {
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
    return this.getData('config/providers', { provider_type, provider_domain });
  }

  public async getProviderConfig(instance_id: string): Promise<ProviderConfig> {
    // Return configuration for a single provider.
    return this.getData('config/providers/get', { instance_id });
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
    return this.getData('config/providers/get_entries', {
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
    return this.getData('config/providers/save', {
      provider_domain,
      values,
      instance_id,
    });
  }

  public removeProviderConfig(instance_id: string) {
    // Remove ProviderConfig.
    this.sendCommand('config/providers/remove', {
      instance_id,
    });
  }

  public reloadProvider(instance_id: string) {
    // Reload Provider(instance).
    this.sendCommand('config/providers/reload', {
      instance_id,
    });
  }

  // PlayerConfig related functions

  public async getPlayerConfigs(provider?: string): Promise<PlayerConfig[]> {
    // Return all known player configurations, optionally filtered by provider domain.
    return this.getData('config/players', { provider });
  }

  public async getPlayerConfig(player_id: string): Promise<PlayerConfig> {
    // Return configuration for a single player.
    return this.getData('config/players/get', { player_id });
  }

  public async getPlayerConfigValue(
    player_id: string,
    key: string,
  ): Promise<PlayerConfig> {
    // Return single configentry value for a player.
    return this.getData('config/players/get_value', { player_id, key });
  }

  public async savePlayerConfig(
    player_id: string,
    values: Record<string, ConfigValueType>,
  ): Promise<PlayerConfig> {
    // Save/update PlayerConfig.
    return this.getData('config/players/save', {
      player_id,
      values,
    });
  }

  public removePlayerConfig(player_id: string) {
    // remove the configuration of a player
    this.sendCommand('config/players/remove', {
      player_id,
    });
  }

  // Core Config related functions

  public async getCoreConfigs(): Promise<CoreConfig[]> {
    // Return all known core configurations
    return this.getData('config/core');
  }

  public async getCoreConfig(domain: string): Promise<ProviderConfig> {
    // Return configuration for a single core controller.
    return this.getData('config/core/get', { domain });
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
    return this.getData('config/core/get_entries', {
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
    return this.getData('config/core/save', {
      domain,
      values,
    });
  }

  public reloadCoreController(domain: string) {
    // Reload Core controller.
    this.sendCommand('config/core/reload', {
      domain,
    });
  }

  // Other (utility) functions

  public startSync(media_types?: MediaType[], providers?: string[]) {
    // Start running the sync of (all or selected) musicproviders.
    // media_types: only sync these media types. omit for all.
    // providers: only sync these provider domains. omit for all.
    this.sendCommand('music/sync', { media_types, providers });
  }

  public getProviderName(provider_domain_or_instance_id: string): string {
    // try to get the name of the provider from the instance_id or domain
    if (provider_domain_or_instance_id in this.providers) {
      provider_domain_or_instance_id =
        this.providers[provider_domain_or_instance_id].domain;
    }
    // prefer the name from manifest and not the user configured name
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
      hassUrl: '',
    };
    try {
      auth = await getAuth(authOptions);
    } catch (err) {
      if (err === ERR_HASS_HOST_REQUIRED) {
        authOptions.hassUrl =
          prompt(
            'Please enter the URL to Home Assistant',
            'http://homeassistant.local:8123',
          ) || '';
        if (!authOptions.hassUrl) return;
        auth = await getAuth(authOptions);
      } else {
        alert(`Unknown error: ${err}`);
        return;
      }
    }
    const connection = await createConnection({ auth });
    connection.addEventListener('ready', () => window.history.back());
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
    } else if (msg.event == EventType.PLAYER_REMOVED) {
      delete this.players[msg.object_id!];
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
      if (DEBUG) console.log('[event]', msg);
    }
    this.signalEvent(msg);
  }

  private handleResultMessage(msg: SuccessResultMessage | ErrorResultMessage) {
    // Handle result of a command
    const resultPromise = this.commands.get(msg.message_id as number);

    if ('error_code' in msg) {
      // always handle error (as we may be missing a resolve promise for this command)
      msg = msg as ErrorResultMessage;
      console.error('[resultMessage]', msg);
      store.activeAlert = {
        type: AlertType.ERROR,
        message: msg.details || msg.error_code,
        persistent: false,
      };
    } else if (DEBUG) {
      console.log('[resultMessage]', msg);
    }

    if (!resultPromise) return;

    this.commands.delete(msg.message_id as number);
    this.fetchesInProgress.value = this.fetchesInProgress.value.filter(
      (x) => x != msg.message_id,
    );

    if ('error_code' in msg) {
      resultPromise.reject(msg.details || msg.error_code);
    } else {
      msg = msg as SuccessResultMessage;
      resultPromise.resolve(msg.result);
    }
  }

  private handleServerInfoMessage(msg: ServerInfoMessage) {
    // Handle ServerInfo message which is sent as first message on connect
    if (DEBUG) {
      console.log('[serverInfo]', msg);
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
        if (listener[1] == '*' || listener[1] === evt.object_id) {
          listener[2](evt);
        }
      }
    }
  }

  public getData<Result>(
    command: string,
    args?: Record<string, any>,
  ): Promise<Result> {
    // send command to the server and return promise where the result can be returned
    const cmdId = this._genCmdId();
    return new Promise((resolve, reject) => {
      this.commands.set(cmdId, { resolve, reject });
      this.fetchesInProgress.value.push(cmdId);
      this.sendCommand(command, args, cmdId);
    });
  }

  public sendCommand(
    command: string,
    args?: Record<string, any>,
    msgId?: number,
  ): void {
    if (this.state.value !== ConnectionState.CONNECTED) {
      throw new Error('Connection lost');
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
      console.log('[sendCommand]', msg);
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
      'providers/manifests',
    )) {
      this.providerManifests[prov.domain] = prov;
    }

    for (const prov of await this.getData<ProviderInstance[]>('providers')) {
      this.providers[prov.instance_id] = prov;
    }

    this.syncTasks.value = await this.getData<SyncTask[]>('music/synctasks');
  }

  private _genCmdId() {
    return ++this.commandId;
  }
}

export const api = new MusicAssistantApi();
export default api;
