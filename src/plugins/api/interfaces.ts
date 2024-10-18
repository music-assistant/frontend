import { ComputedRef } from "vue";

/// constants
export const SECURE_STRING_SUBSTITUTE = "this_value_is_encrypted";
export const MASS_LOGO_ONLINE =
  "https://github.com/home-assistant/brands/raw/master/custom_integrations/mass/icon%402x.png";

/// enums

export enum MediaType {
  ARTIST = "artist",
  ALBUM = "album",
  TRACK = "track",
  PLAYLIST = "playlist",
  RADIO = "radio",
  FOLDER = "folder",
  UNKNOWN = "unknown",
}

export enum LinkType {
  WEBSITE = "website",
  FACEBOOK = "facebook",
  TWITTER = "twitter",
  LASTFM = "lastfm",
  YOUTUBE = "youtube",
  INSTAGRAM = "instagram",
  SNAPCHAT = "snapchat",
  TIKTOK = "tiktok",
  DISCOGS = "discogs",
  WIKIPEDIA = "wikipedia",
  ALLMUSIC = "allmusic",
}

export enum ImageType {
  THUMB = "thumb",
  LANDSCAPE = "landscape",
  FANART = "fanart",
  LOGO = "logo",
  CLEARART = "clearart",
  BANNER = "banner",
  CUTOUT = "cutout",
  BACK = "back",
  DISCART = "discart",
  OTHER = "other",
}

export enum AlbumType {
  ALBUM = "album",
  SINGLE = "single",
  COMPILATION = "compilation",
  EP = "ep",
  PODCAST = "podcast",
  AUDIOBOOK = "audiobook",
  UNKNOWN = "unknown",
}

export enum ContentType {
  OGG = "ogg",
  FLAC = "flac",
  MP3 = "mp3",
  AAC = "aac",
  MPEG = "mpeg",
  ALAC = "alac",
  WAV = "wav",
  AIFF = "aiff",
  WMA = "wma",
  M4B = "m4b",
  M4A = "m4a",
  DSF = "dsf",
  WAVPACK = "wv",
  PCM_S16LE = "s16le", // PCM signed 16-bit little-endian
  PCM_S24LE = "s24le", // PCM signed 24-bit little-endian
  PCM_S32LE = "s32le", // PCM signed 32-bit little-endian
  PCM_F32LE = "f32le", // PCM 32-bit floating-point little-endian
  PCM_F64LE = "f64le", // PCM 64-bit floating-point little-endian
  MPEG_DASH = "dash",
  UNKNOWN = "?",
}

export enum QueueOption {
  PLAY = "play",
  REPLACE = "replace",
  NEXT = "next",
  REPLACE_NEXT = "replace_next",
  ADD = "add",
}

export enum RepeatMode {
  OFF = "off", // no repeat at all
  ONE = "one", // repeat current/single track
  ALL = "all", // repeat entire queue
}

export enum PlayerState {
  IDLE = "idle",
  PAUSED = "paused",
  PLAYING = "playing",
}

export enum PlayerType {
  PLAYER = "player", // A regular player.
  GROUP = "group", // A (dedicated) group player or playergroup.
  STEREO_PAIR = "stereo_pair",
}

export enum PlayerFeature {
  POWER = "power",
  VOLUME_SET = "volume_set",
  VOLUME_MUTE = "volume_mute",
  PAUSE = "pause",
  SYNC = "sync",
  SEEK = "seek",
  ENQUEUE_NEXT = "enqueue_next",
}

export enum EventType {
  PLAYER_ADDED = "player_added",
  PLAYER_UPDATED = "player_updated",
  PLAYER_REMOVED = "player_removed",
  PLAYER_SETTINGS_UPDATED = "player_settings_updated",
  QUEUE_ADDED = "queue_added",
  QUEUE_UPDATED = "queue_updated",
  QUEUE_ITEMS_UPDATED = "queue_items_updated",
  QUEUE_TIME_UPDATED = "queue_time_updated",
  QUEUE_SETTINGS_UPDATED = "queue_settings_updated",
  SHUTDOWN = "application_shutdown",
  MEDIA_ITEM_ADDED = "media_item_added",
  MEDIA_ITEM_UPDATED = "media_item_updated",
  MEDIA_ITEM_DELETED = "media_item_deleted",
  PROVIDERS_UPDATED = "providers_updated",
  PLAYER_CONFIG_UPDATED = "player_config_updated",
  SYNC_TASKS_UPDATED = "sync_tasks_updated",
  AUTH_SESSION = "auth_session",
  // special types for local subscriptions only
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ALL = "*",
}

export enum ProviderFeature {
  // browse/explore/recommendations
  BROWSE = "browse",
  SEARCH = "search",
  RECOMMENDATIONS = "recommendations",
  // library feature per mediatype
  LIBRARY_ARTISTS = "library_artists",
  LIBRARY_ALBUMS = "library_albums",
  LIBRARY_TRACKS = "library_tracks",
  LIBRARY_PLAYLISTS = "library_playlists",
  LIBRARY_RADIOS = "library_radios",
  // additional library features
  ARTIST_ALBUMS = "artist_albums",
  ARTIST_TOPTRACKS = "artist_toptracks",
  // library edit (=add/remove) feature per mediatype
  LIBRARY_ARTISTS_EDIT = "library_artists_edit",
  LIBRARY_ALBUMS_EDIT = "library_albums_edit",
  LIBRARY_TRACKS_EDIT = "library_tracks_edit",
  LIBRARY_PLAYLISTS_EDIT = "library_playlists_edit",
  LIBRARY_RADIOS_EDIT = "library_radios_edit",
  // bonus features
  SIMILAR_TRACKS = "similar_tracks",
  // playlist-specific features
  PLAYLIST_TRACKS_EDIT = "playlist_tracks_edit",
  PLAYLIST_CREATE = "playlist_create",
  // player provider specific features
  SYNC_PLAYERS = "sync_players",
  REMOVE_PLAYER = "remove_player",
  // metadata provider specific features
  ARTIST_METADATA = "artist_metadata",
  ALBUM_METADATA = "album_metadata",
  TRACK_METADATA = "track_metadata",
}

export enum ProviderType {
  MUSIC = "music",
  PLAYER = "player",
  METADATA = "metadata",
  PLUGIN = "plugin",
}

export enum ConfigEntryType {
  BOOLEAN = "boolean",
  STRING = "string",
  SECURE_STRING = "secure_string",
  INTEGER = "integer",
  FLOAT = "float",
  LABEL = "label",
  DIVIDER = "divider",
  ACTION = "action",
  ICON = "icon",
  ALERT = "alert",
}

//// api

export interface CommandMessage {
  // Model for a Message holding a command from server to client or client to server.

  message_id?: string | number;
  command: string;
  args?: Record<string, any>;
}

export interface ResultMessageBase {
  // Base class for a result/response of a Command Message.

  message_id: string | number;
}

export interface SuccessResultMessage extends ResultMessageBase {
  // Message sent when a Command has been successfully executed.

  result: any;
  partial?: boolean;
}

export interface ErrorResultMessage extends ResultMessageBase {
  // Message sent when a Command has been successfully executed.

  error_code: string;
  details?: string;
}

export interface EventMessage {
  event: EventType;
  object_id?: string; // player_id, queue_id or uri
  data?: any; // optional data (such as the object)
}
export type MassEvent = EventMessage;

export interface ServerInfoMessage {
  server_id: string;
  server_version: string;
  schema_version: number;
  min_supported_schema_version: number;
  base_url: string;
  homeassistant_addon: boolean;
  onboard_done: boolean;
}

export type MessageType =
  | CommandMessage
  | EventMessage
  | SuccessResultMessage
  | ErrorResultMessage
  | ServerInfoMessage;

// config entries

export type ConfigValueType =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null;

export interface ConfigValueOption {
  // Model for a value with separated name/value.
  title: string;
  value: ConfigValueType;
}

export interface ConfigEntry {
  // Model for a Config Entry.
  // The definition of something that can be configured for an object (e.g. provider or player)
  // within Music Assistant (without the value).
  // key: used as identifier for the entry, also for localization
  key: string;
  type: ConfigEntryType;
  // label: default label when no translation for the key is present
  label: string;
  default_value: ConfigValueType;
  required: boolean;
  // options [optional]: select from list of possible values/options
  options?: ConfigValueOption[];
  // range [optional]: select values within range
  range?: number[];
  // description [optional]: extended description of the setting.
  description?: string;
  // help_link [optional]: link to help article.
  help_link?: string;
  // multi_value [optional]: allow multiple values from the list
  multi_value?: boolean;
  // depends_on [optional]: needs to be set before this setting shows up in frontend
  depends_on?: string;
  // hidden: hide from UI
  hidden?: boolean;
  // category: category to group this setting into in the frontend (e.g. advanced)
  category: string;
  // action: (configentry)action that is needed to get the value for this entry
  action?: string;
  // action_label: default label for the action when no translation for the action is present
  action_label?: string;

  value?: ConfigValueType;
}

export interface Config {
  // Base Configuration object.
  values: Record<string, ConfigEntry>;
}

export interface ProviderConfig extends Config {
  // Provider(instance) Configuration.
  type: ProviderType;
  domain: string;
  instance_id: string;
  manifest: ProviderManifest; // copied here for the UI only
  // enabled: boolean to indicate if the provider is enabled
  enabled: boolean;
  // name: an (optional) custom name for this provider instance/config
  name?: string;
  last_error?: string;
}

export interface PlayerConfig extends Config {
  // Player Configuration.
  provider: string;
  player_id: string;
  // enabled: boolean to indicate if the player is enabled
  enabled: boolean;
  // name: an (optional) custom name for this player
  name?: string;
  // default_name: default name to use when there is name available
  default_name?: string;
}

export interface CoreConfig extends Config {
  // Core(controller) Configuration.
  domain: string;
  manifest: ProviderManifest; // copied here for the UI only
  last_error?: string;
}

//// media_items

export interface ProviderMapping {
  // Model for a MediaItem's provider mapping details.
  item_id: string;
  provider_domain: string;
  provider_instance: string;
  available: boolean;
  // quality details (streamable content only)
  audio_format?: AudioFormat;
  // optional details to store provider specific details
  details?: string;
  // url = link to provider details page if exists
  url?: string;
}

export interface MediaItemLink {
  type: LinkType;
  url: string;
}

export interface MediaItemImage {
  type: ImageType;
  path: string;
  provider: string;
  remotely_accessible: boolean;
}

export interface MediaItemMetadata {
  description?: string;
  review?: string;
  explicit?: boolean;
  images?: MediaItemImage[];
  genres?: string[];
  mood?: string;
  style?: string;
  copyright?: string;
  lyrics?: string;
  label?: string;
  links?: MediaItemLink[];
  performers?: string[];
  preview?: string;
  replaygain?: number;
  popularity?: number;
  cache_checksum?: string;
}

export interface MediaItem {
  item_id: string;
  provider: string;
  name: string;
  provider_mappings: ProviderMapping[];

  metadata: MediaItemMetadata;
  favorite: boolean;
  media_type: MediaType;
  sort_name?: string;
  uri: string;
  timestamp_added: number;
  timestamp_modified: number;
}

export interface ItemMapping {
  media_type: MediaType;
  item_id: string;
  provider: string;
  name: string;
  sort_name: string;
  uri: string;
  version: string;
  image?: MediaItemImage;
}

export interface Artist extends MediaItem {
  musicbrainz_id: string;
}

export interface Album extends MediaItem {
  version: string;
  year?: number;
  artist: ItemMapping | Artist;
  artists: Array<ItemMapping | Artist>;
  album_type: AlbumType;
  upc?: string;
  musicbrainz_id?: string;
}

export interface TrackAlbumMapping extends ItemMapping {
  // Model for a track that is mapped to an album.
  disc_number?: number;
  track_number?: number;
}

export interface Track extends MediaItem {
  duration: number;
  version: string;
  isrc: string;
  musicbrainz_id?: string;
  artists: Array<ItemMapping | Artist>;
  // album track only
  album: ItemMapping | Album;
  disc_number?: number;
  track_number?: number;
  // playlist track only
  position?: number;
}

export interface Playlist extends MediaItem {
  owner: string;
  is_editable: boolean;
}

export interface Radio extends MediaItem {
  duration?: number;
}

export type MediaItemType =
  | Artist
  | Album
  | Track
  | Radio
  | Playlist
  | BrowseFolder;

export interface BrowseFolder extends MediaItem {
  path?: string;
  label: string;
  items?: Array<MediaItemType | BrowseFolder>;
}

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  playlists: Playlist[];
  radio: Radio[];
}

export interface AudioFormat {
  content_type: ContentType;
  sample_rate: number;
  bit_depth: number;
  channels: number;
  output_format_str: string;
  bit_rate: number;
}

export interface LoudnessMeasurement {
  integrated: number;
  true_peak: number;
  lra: number;
  threshold: number;
  target_offset: number;
}

export interface StreamDetails {
  provider: string;
  item_id: string;
  audio_format: AudioFormat;
  media_type: MediaType;
  stream_title?: string;
  duration?: number;

  queue_id?: string;
  loudness?: LoudnessMeasurement;
  target_loudness?: number;
}

// queue_item

export interface QueueItem {
  queue_id: string;
  queue_item_id: string;
  name: string;
  duration: number;
  sort_index: number;
  streamdetails?: StreamDetails;
  media_item?: Track | Radio;
  image?: MediaItemImage;
}

// player_queue

export interface PlayerQueue {
  queue_id: string;
  active: boolean;
  display_name: string;
  available: boolean;
  items: number;
  shuffle_enabled: boolean;
  dont_stop_the_music_enabled: boolean;
  repeat_mode: RepeatMode;
  current_index?: number;
  index_in_buffer?: number;
  elapsed_time: number;
  elapsed_time_last_updated: number;
  state: PlayerState;
  current_item?: QueueItem;
  next_item?: QueueItem;
  radio_source: MediaItemType[];
}

// player

export interface DeviceInfo {
  model: string;
  address: string;
  manufacturer: string;
}

export interface PlayerMedia {
  uri: string; // uri or other identifier of the loaded media
  media_type: MediaType;
  title?: string; // optional
  artist?: string; // optional
  album?: string; // optional
  image_url?: string; // optional
  duration?: number; // optional
  queue_id?: string; // only present for requests from queue controller
  queue_item_id?: string; // only present for requests from queue controller
}

export interface Player {
  player_id: string;
  provider: string;
  type: PlayerType;
  name: string;
  available: boolean;
  powered: boolean;
  device_info: DeviceInfo;
  supported_features: PlayerFeature[];
  elapsed_time: number;
  elapsed_time_last_updated: number;
  current_media?: PlayerMedia;
  state: PlayerState;

  volume_level: number;
  volume_muted: boolean;
  group_childs: string[];
  active_source: string;
  active_group?: string;
  synced_to: string;
  max_sample_rate: number;
  enabled: boolean;
  group_volume: number;
  display_name: string;
  hidden: boolean;
  icon: string;
}

// provider

export interface ProviderManifest {
  // ProviderManifest, details of a provider.
  type: ProviderType;
  domain: string;
  name: string;
  description: string;
  codeowners: string[];
  // config_entries: list of config entries required to configure/setup this provider
  config_entries: ConfigEntry[];
  requirements: string[];
  // documentation: link/url to documentation.
  documentation?: string;
  // multi_instance: whether multiple instances of the same provider are allowed/possible
  multi_instance: boolean;
  // builtin: whether this provider is a system/builtin and can not disabled/removed
  builtin: boolean;
  // allow_disable: whether this provider can be disabled (used with builtin)
  allow_disable: boolean;
  // icon: material design icon
  icon?: string;
  // icon_svg: svg icon (full xml string)
  icon_svg?: string;
  // icon_svg_dark: optional separate dark svg icon (full xml string)
  icon_svg_dark?: string;
  // depends on: domain of another provider that is required for this provider
  depends_on?: string;
}

export interface ProviderInstance {
  // Provider instance details when a provider is serialized over the api.
  type: ProviderType;
  domain: string;
  name: string;
  instance_id: string;
  lookup_key: string;
  supported_features: ProviderFeature[];
  available: boolean;
  is_streaming_provider?: boolean;
}

export interface SyncTask {
  // Description of a Sync task/job of a musicprovider.
  provider_domain: string;
  provider_instance: string;
  media_types: MediaType[];
}

export enum MobileDeviceType {
  ALL,
  TABLET,
  PHONE,
}

export interface IconProps {
  height?: string;
  width?: string;
  size?: number;
  icon?: string;
  color?: string;
}

export interface ButtonProps {
  height?: string;
  width?: string;
  ripple?: boolean;
  class?: string;
  size?: number;
  icon?: string;
  iconOptions?: IconProps; //Experimental
}
