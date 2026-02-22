/// constants
export const SECURE_STRING_SUBSTITUTE = "this_value_is_encrypted";
export const MASS_LOGO_ONLINE =
  "https://github.com/home-assistant/brands/raw/master/core_integrations/music_assistant/icon%402x.png";
export const PLAYER_CONTROL_NONE = "none";

/// dsp
export enum AudioChannel {
  ALL = "ALL",
  FL = "FL",
  FR = "FR",
}

export enum DSPFilterType {
  PARAMETRIC_EQ = "parametric_eq",
  TONE_CONTROL = "tone_control",
}

export enum ParametricEQBandType {
  PEAK = "peak",
  HIGH_SHELF = "high_shelf",
  LOW_SHELF = "low_shelf",
  HIGH_PASS = "high_pass",
  LOW_PASS = "low_pass",
  NOTCH = "notch",
}

// Base interface for all DSP filters
export interface DSPFilterBase {
  type: DSPFilterType;
  enabled: boolean;
}

export interface ParametricEQBand {
  frequency: number;
  q: number;
  gain: number;
  type: ParametricEQBandType;
  enabled: boolean;
  channel: AudioChannel;
}

// Specific filter types
export interface ParametricEQFilter extends DSPFilterBase {
  preamp?: number;
  per_channel_preamp: Partial<Record<AudioChannel, number>>;
  type: DSPFilterType.PARAMETRIC_EQ;
  bands: Array<ParametricEQBand>;
}

export interface ToneControlFilter extends DSPFilterBase {
  type: DSPFilterType.TONE_CONTROL;
  bass_level: number;
  mid_level: number;
  treble_level: number;
}

// Union type for all possible filters
export type DSPFilter = ParametricEQFilter | ToneControlFilter;

// Main DSP chain configuration
export interface DSPConfig {
  enabled: boolean;
  filters: DSPFilter[];
  input_gain: number;
  output_gain: number;
}

// DSPConfigPreset represents a preset configuration for DSP
export interface DSPConfigPreset {
  preset_id?: string;
  name: string;
  config: DSPConfig;
}

// DSPDetails used in StreamDetails
export enum DSPState {
  ENABLED = "enabled",
  DISABLED = "disabled",
  DISABLED_BY_UNSUPPORTED_GROUP = "disabled_by_unsupported_group",
}

// This describes the DSP configuration as applied,
// even when the DSP state is disabled. For example,
// output_limiter can remain true while the DSP is disabled.
// All filters in the list are guaranteed to be enabled.
// output_format is the format that will be sent to the output device (if known).
export interface DSPDetails {
  state: DSPState;
  input_gain: number;
  filters: DSPFilter[];
  output_gain: number;
  output_limiter: boolean;
  output_format?: AudioFormat;
}

/// enums

export enum MediaType {
  ARTIST = "artist",
  ALBUM = "album",
  TRACK = "track",
  PLAYLIST = "playlist",
  RADIO = "radio",
  AUDIOBOOK = "audiobook",
  PODCAST = "podcast",
  PODCAST_EPISODE = "podcast_episode",
  GENRE = "genre",
  GENRE_ALIAS = "genre_alias",
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
  LIVE = "live",
  SOUNDTRACK = "soundtrack",
  UNKNOWN = "unknown",
}

export enum ExternalID {
  MB_ARTIST = "musicbrainz_artistid", // MusicBrainz Artist ID (or AlbumArtist ID)
  MB_ALBUM = "musicbrainz_albumid", // MusicBrainz Album ID
  MB_RELEASEGROUP = "musicbrainz_releasegroupid", // MusicBrainz ReleaseGroupID
  MB_TRACK = "musicbrainz_trackid", // MusicBrainz Track ID
  MB_RECORDING = "musicbrainz_recordingid", // MusicBrainz Recording ID
  ISRC = "isrc", // used to identify unique recordings
  BARCODE = "barcode", // EAN-13 barcode for identifying albums
  ACOUSTID = "acoustid", //unique fingerprint (id) for a recording
  ASIN = "asin", // amazon unique number to identify albums
  DISCOGS = "discogs", // id for media item on discogs
  TADB = "tadb", // the audio db id
  UNKNOWN = "unknown",
}

// Enum with audio content/container types supported by ffmpeg.
export enum ContentType {
  // --- Containers ---
  OGG = "ogg", // Ogg container (Vorbis/Opus/FLAC)
  WAV = "wav", // WAV container (usually PCM)
  AIFF = "aiff", // AIFF container
  MPEG = "mpeg", // MPEG-PS/MPEG-TS container
  M4A = "m4a", // MPEG-4 Audio (AAC/ALAC)
  MP4A = "mp4a", // MPEG-4 Audio (AAC/ALAC)
  MP4 = "mp4", // MPEG-4 container
  M4B = "m4b", // MPEG-4 Audiobook
  DSF = "dsf", // DSD Stream File

  // --- Can both be a container and codec ---
  FLAC = "flac", // FLAC lossless audio
  MP3 = "mp3", // MPEG-1 Audio Layer III
  WMA = "wma", // Windows Media Audio
  WMAV2 = "wmav2", // Windows Media Audio v2
  WMAPRO = "wmapro", // Windows Media Audio Professional
  WAVPACK = "wavpack", // WavPack lossless
  TAK = "tak", // Tom's Lossless Audio Kompressor
  APE = "ape", // Monkey's Audio
  MUSEPACK = "mpc", // MusePack

  // --- Codecs ---
  AAC = "aac", // Advanced Audio Coding
  ALAC = "alac", // Apple Lossless Audio Codec
  OPUS = "opus", // Opus audio codec
  VORBIS = "vorbis", // Ogg Vorbis compression
  AC3 = "ac3", // Dolby Digital (common in DVDs)
  EAC3 = "eac3", // Dolby Digital Plus (streaming/4K)
  DTS = "dts", // Digital Theater System
  TRUEHD = "truehd", // Dolby TrueHD (lossless)
  DTSHD = "dtshd", // DTS-HD Master Audio
  DTSX = "dtsx", // DTS:X immersive audio
  COOK = "cook", // RealAudio Cook Codec
  RA_144 = "ralf", // RealAudio Lossless
  MP2 = "mp2", // MPEG-1 Audio Layer II
  MP1 = "mp1", // MPEG-1 Audio Layer I
  DRA = "dra", // Chinese Digital Rise Audio
  ATRAC3 = "atrac3", // Sony MiniDisc format

  // --- PCM Codecs ---
  PCM_S16LE = "s16le", // PCM 16-bit little-endian
  PCM_S24LE = "s24le", // PCM 24-bit little-endian
  PCM_S32LE = "s32le", // PCM 32-bit little-endian
  PCM_F32LE = "f32le", // PCM 32-bit float
  PCM_F64LE = "f64le", // PCM 64-bit float
  PCM_S16BE = "s16be", // PCM 16-bit big-endian
  PCM_S24BE = "s24be", // PCM 24-bit big-endian
  PCM_S32BE = "s32be", // PCM 32-bit big-endian
  PCM_BLURAY = "pcm_bluray", // Blu-ray specific PCM
  PCM_DVD = "pcm_dvd", // DVD specific PCM

  // --- ADPCM Codecs ---
  ADPCM_IMA = "adpcm_ima_qt", // QuickTime variant
  ADPCM_MS = "adpcm_ms", // Microsoft variant
  ADPCM_SWF = "adpcm_swf", // Flash audio

  // --- PDM Codecs ---
  DSD_LSBF = "dsd_lsbf", // DSD least-significant-bit first
  DSD_MSBF = "dsd_msbf", // DSD most-significant-bit first
  DSD_LSBF_PLANAR = "dsd_lsbf_planar", // DSD planar least-significant-bit first
  DSD_MSBF_PLANAR = "dsd_msbf_planar", // DSD planar most-significant-bit first

  // --- Voice Codecs ---
  AMR = "amr_nb", // Adaptive Multi-Rate Narrowband, voice codec
  AMR_WB = "amr_wb", // Adaptive Multi-Rate Wideband, voice codec
  SPEEX = "speex", // Open-source voice codec, voice codec
  PCM_ALAW = "alaw", // G.711 A-law, voice codec
  PCM_MULAW = "mulaw", // G.711 µ-law, voice codec
  G722 = "g722", // ITU-T 7 kHz audio
  G726 = "g726", // ADPCM telephone quality

  // --- Special ---
  PCM = "pcm", // PCM generic (details determined later)
  UNKNOWN = "?", // Unknown type
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

export enum PlaybackState {
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
  SET_MEMBERS = "set_members",
  MULTI_DEVICE_DSP = "multi_device_dsp",
  SEEK = "seek",
  NEXT_PREVIOUS = "next_previous",
  PLAY_ANNOUNCEMENT = "play_announcement",
  ENQUEUE = "enqueue",
  SELECT_SOURCE = "select_source",
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
  MEDIA_ITEM_PLAYED = "media_item_played",
  PROVIDERS_UPDATED = "providers_updated",
  PLAYER_CONFIG_UPDATED = "player_config_updated",
  PLAYER_DSP_CONFIG_UPDATED = "player_dsp_config_updated",
  DSP_PRESETS_UPDATED = "dsp_presets_updated",
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
  LIBRARY_PODCASTS = "library_podcasts",
  LIBRARY_AUDIOBOOKS = "library_audiobooks",
  LIBRARY_GENRES = "library_genres",
  // additional library features
  ARTIST_ALBUMS = "artist_albums",
  ARTIST_TOPTRACKS = "artist_toptracks",
  // library edit (=add/remove) feature per mediatype
  LIBRARY_ARTISTS_EDIT = "library_artists_edit",
  LIBRARY_ALBUMS_EDIT = "library_albums_edit",
  LIBRARY_TRACKS_EDIT = "library_tracks_edit",
  LIBRARY_PLAYLISTS_EDIT = "library_playlists_edit",
  LIBRARY_RADIOS_EDIT = "library_radios_edit",
  LIBRARY_PODCASTS_EDIT = "library_podcasts_edit",
  LIBRARY_AUDIOBOOKS_EDIT = "library_audiobooks_edit",
  LIBRARY_GENRES_EDIT = "library_genres_edit",
  // bonus features
  SIMILAR_TRACKS = "similar_tracks",
  // playlist-specific features
  PLAYLIST_TRACKS_EDIT = "playlist_tracks_edit",
  PLAYLIST_CREATE = "playlist_create",
  // player provider specific features
  SYNC_PLAYERS = "sync_players",
  REMOVE_PLAYER = "remove_player",
  REMOVE_GROUP_PLAYER = "remove_group_player",
  CREATE_GROUP_PLAYER = "create_group_player",
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

  // Only used in the frontend
  DSP_SETTINGS = "dsp_settings",
}

export enum VolumeNormalizationMode {
  DISABLED = "disabled",
  DYNAMIC = "dynamic",
  MEASUREMENT_ONLY = "measurement_only",
  FALLBACK_FIXED_GAIN = "fallback_fixed_gain",
  FIXED_GAIN = "fixed_gain",
  FALLBACK_DYNAMIC = "fallback_dynamic",
}

export enum IdentifierType {
  // Types of identifiers/connections for a device.
  // Also used to match protocol players to their parent device.
  MAC_ADDRESS = "mac_address", // Most reliable - e.g., "AA:BB:CC:DD:EE:FF"
  SERIAL_NUMBER = "serial_number", // Device serial number
  UUID = "uuid", // Universal unique identifier
  IP_ADDRESS = "ip_address", // Less reliable (DHCP) but useful for fallback
  UNKNOWN = "unknown",
}

//// api

export interface CommandMessage {
  // Model for a Message holding a command from server to client or client to server.

  message_id?: string;
  command: string;
  args?: Record<string, any>;
}

export interface ResultMessageBase {
  // Base class for a result/response of a Command Message.

  message_id: string;
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
  | number
  | string
  | boolean
  | number[]
  | string[]
  | boolean[]
  | number[]
  | string[]
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
  depends_on_value?: ConfigValueType;
  depends_on_value_not?: ConfigValueType;
  // hidden: hide from UI
  hidden?: boolean;
  // read_only: prevent user from changing this setting (make it disabled)
  read_only?: boolean;
  // category: category to group this setting into in the frontend (e.g. advanced)
  category: string;
  // action: (configentry)action that is needed to get the value for this entry
  action?: string;
  // action_label: default label for the action when no translation for the action is present
  action_label?: string;
  // immediate_apply: whether changes to this config entry should be applied immediately
  immediate_apply?: boolean;
  // requires_reload: indicates that a reload of the provider (or player playback)
  // is required when this setting is changed
  requires_reload?: boolean;
  // translation_key: optional custom translation key for this entry
  translation_key?: string;
  // translation_params: optional parameters for the translation key
  translation_params?: string[];
  // category_translation_key: optional custom translation key for the category
  category_translation_key?: string;
  // category_translation_params: optional parameters for the category translation key
  category_translation_params?: string[];
  // advanced: indicates this is an advanced setting (hidden by default)
  advanced?: boolean;

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
  // default_name: default name to use when there is name available
  default_name?: string;
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
  in_library?: boolean;
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

export interface MediaItemChapter {
  position: number;
  name: string;
  start: number;
  end?: number;
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
  lrc_lyrics?: string;
  label?: string;
  links?: MediaItemLink[];
  performers?: string[];
  preview?: string;
  replaygain?: number;
  popularity?: number;
  release_date?: string;
  cache_checksum?: string;
  chapters?: MediaItemChapter[];
}

interface _MediaItemBase {
  item_id: string;
  provider: string;
  name: string;
  version?: string;
  sort_name?: string;
  uri: string;
  external_ids?: Array<[ExternalID, string]>;
  is_playable: boolean; // if the item is playable (can be used in play_media command)
  translation_key?: string; // an optional translation key identifier
  media_type: MediaType;
}

export interface MediaItem extends _MediaItemBase {
  provider_mappings: ProviderMapping[];
  metadata: MediaItemMetadata;
  favorite: boolean;
  position?: number; //required for playlist tracks, optional for all other
  timestamp_added: number;
  timestamp_modified: number;
}

export interface ItemMapping extends _MediaItemBase {
  available: boolean;
  image?: MediaItemImage;
  year?: number;
}

export interface Artist extends MediaItem {}

export interface Album extends MediaItem {
  year?: number;
  artists: Array<ItemMapping | Artist>;
  album_type: AlbumType;
}

export interface Track extends MediaItem {
  duration: number;
  artists: Array<ItemMapping | Artist>;
  // album track only
  album: ItemMapping | Album;
  disc_number?: number;
  track_number?: number;
}

export interface Playlist extends MediaItem {
  owner: string;
  is_editable: boolean;
}

export interface Radio extends MediaItem {}

export interface Audiobook extends MediaItem {
  publisher: string;
  authors: string[];
  narrators: string[];
  duration: number;
  fully_played?: boolean;
  resume_position_ms?: number;
}

export interface Podcast extends MediaItem {
  publisher?: string;
  total_episodes?: number;
}

export interface PodcastEpisode extends MediaItem {
  position: number;
  podcast: Podcast | ItemMapping;
  duration: number;
  fully_played?: boolean;
  resume_position_ms?: number;
}

export interface Genre extends MediaItem {
  genre_aliases: string[] | null;
}

export interface BrowseFolder extends MediaItem {
  path?: string;
  image?: MediaItemImage;
}
export interface RecommendationFolder extends BrowseFolder {
  icon?: string;
  items: MediaItemTypeOrItemMapping[];
}

export type MediaItemType =
  | Artist
  | Album
  | Track
  | Radio
  | Playlist
  | Audiobook
  | Podcast
  | PodcastEpisode
  | Genre
  | BrowseFolder;

export type PlayableMediaItemType = Track | Radio | Audiobook | PodcastEpisode;
export type MediaItemTypeOrItemMapping = MediaItemType | ItemMapping;

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  playlists: Playlist[];
  radio: Radio[];
  podcasts: Podcast[];
  audiobooks: Audiobook[];
  genres: Genre[];
}

export interface AudioFormat {
  content_type: ContentType;
  codec_type: ContentType;
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

export interface StreamMetadata {
  // mandatory fields
  title: string;
  // optional fields
  artist?: string;
  album?: string;
  image_url?: string;
  duration?: number;
  uri?: string;
}

export interface StreamDetails {
  provider: string;
  item_id: string;
  audio_format: AudioFormat;
  media_type: MediaType;
  stream_metadata?: StreamMetadata;
  duration?: number;

  queue_id?: string;
  fade_in?: boolean;
  loudness?: number;
  loudness_album?: number;
  prefer_album_loudness?: boolean;
  target_loudness?: number;
  volume_normalization_mode?: VolumeNormalizationMode;
  volume_normalization_gain_correct?: number;
  // This contains the DSPDetails of all players in the group.
  // In case of single player playback, dict will contain only one entry.
  dsp?: Record<string, DSPDetails>;
}

// queue_item

export interface QueueItem {
  queue_id: string;
  queue_item_id: string;
  name: string;
  duration: number;
  sort_index: number;
  streamdetails?: StreamDetails;
  media_item?: PlayableMediaItemType;
  image?: MediaItemImage;
  available: boolean;
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
  /**
   * UTC timestamp (seconds since epoch) when `elapsed_time` was last updated.
   *
   * Semantics/units:
   * - `elapsed_time` is expressed in seconds (number, can be fractional).
   * - `elapsed_time_last_updated` is a UTC timestamp in seconds since epoch.
   *   Convert to milliseconds (multiply by 1000) when comparing to Date.now().
   *
   * Use this timestamp to compute the current progress while playback is
   * ongoing by adding (now - elapsed_time_last_updated*1000)/1000 to
   * `elapsed_time`.
   */
  elapsed_time_last_updated: number;
  state: PlaybackState;
  current_item?: QueueItem;
  next_item?: QueueItem;
  radio_source: MediaItemType[];
}

// player

export interface OutputProtocol {
  // Represents an output protocol for a player.
  // This provides a unified view of all ways to play audio to a device:
  // - Native output (if player supports PLAY_MEDIA)
  // - Protocol outputs (AirPlay, Chromecast, DLNA, etc.)

  output_protocol_id: string; // Unique ID: "native" or protocol player_id
  name: string; // Display name: "Native (Sonos)" or "AirPlay"
  is_native: boolean; // True if this is the player's native output
  protocol_domain: string | null; // e.g., "airplay", "dlna" (null for native)
  priority: number; // Lower = more preferred (native = 0 if supported)
  available: boolean; // Whether this output protocol is currently available
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  software_version?: string;
  model_id?: string;
  manufacturer_id?: string;
  // Identifiers for device identification and protocol player linking
  // Maps IdentifierType to value (e.g., MAC_ADDRESS -> "AA:BB:CC:DD:EE:FF")
  identifiers: Record<IdentifierType, string>;
}

export interface PlayerMedia {
  uri: string; // uri or other identifier of the loaded media
  media_type: MediaType;
  title?: string; // optional
  artist?: string; // optional
  album?: string; // optional
  image_url?: string; // optional
  duration?: number; // optional
  source_id?: string; // optional
  elapsed_time?: number; // optional
  elapsed_time_last_updated?: number; // optional
  queue_id?: string; // only present for requests from queue controller
  queue_item_id?: string; // only present for requests from queue controller
}

export interface PlayerSource {
  id: string;
  name: string;
  passive: boolean;
  can_play_pause: boolean;
  can_seek: boolean;
  can_next_previous: boolean;
}

export interface Player {
  player_id: string;
  provider: string;
  type: PlayerType;
  name: string;
  available: boolean;
  device_info: DeviceInfo;
  supported_features: PlayerFeature[];
  can_group_with: string[];
  enabled: boolean;

  elapsed_time?: number;
  elapsed_time_last_updated?: number;
  current_media?: PlayerMedia;
  playback_state?: PlaybackState;
  powered?: boolean;
  volume_level?: number;
  volume_muted?: boolean;
  group_members: string[];
  static_group_members: string[];
  active_source?: string;
  source_list: PlayerSource[];
  active_group?: string;
  synced_to?: string;

  group_volume: number;
  hide_in_ui: boolean;
  icon: string;
  power_control: string;
  volume_control: string;
  mute_control: string;

  // output_protocols: all available output methods for this player
  // Includes native output (if PLAY_MEDIA supported) + protocol outputs
  output_protocols: OutputProtocol[];

  // active_output_protocol: which output protocol is currently being used for playback
  // Can be "native" or a protocol player_id
  // null means no playback in progress or native playback without explicit selection
  active_output_protocol: string | null;
}

// provider

export interface ProviderManifest {
  // ProviderManifest, details of a provider.
  type: ProviderType;
  domain: string;
  name: string;
  description: string;
  codeowners: string[];
  credits: string[];
  requirements: string[];
  // documentation: link/url to documentation.
  documentation?: string;
  // multi_instance: whether multiple instances of the same provider are allowed/possible
  multi_instance: boolean;
  // builtin: whether this provider is a system/builtin and can not disabled/removed
  builtin: boolean;
  // allow_disable: whether this provider can be disabled (used with builtin)
  allow_disable: boolean;
  stage: ProviderStage;
  // icon: material design icon
  icon?: string;
  // icon_svg: svg icon (full xml string)
  icon_svg?: string;
  // icon_svg_dark: optional separate dark svg icon (full xml string)
  icon_svg_dark?: string;
  // icon_svg_dark: optional separate monochrome svg icon (full xml string)
  icon_svg_monochrome?: string;
  // depends on: domain of another provider that is required for this provider
  depends_on?: string;
}

export enum ProviderStage {
  ALPHA = "alpha",
  BETA = "beta",
  STABLE = "stable",
  EXPERIMENTAL = "experimental",
  UNMAINTAINED = "unmaintained",
  DEPRECATED = "deprecated",
}

export interface ProviderInstance {
  // Provider instance details when a provider is serialized over the api.
  type: ProviderType;
  domain: string;
  name: string;
  default_name: string;
  instance_name_postfix?: string;
  instance_id: string;
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

// Authentication interfaces

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export enum AuthProviderType {
  BUILTIN = "builtin",
  OAUTH_HOMEASSISTANT = "oauth_homeassistant",
}

export interface User {
  user_id: string;
  username: string;
  role: UserRole;
  enabled: boolean;
  created_at: string;
  display_name?: string;
  avatar_url?: string;
  preferences: Record<string, any>;
  provider_filter: string[];
  player_filter: string[];
}

export interface AuthToken {
  token_id: string;
  name: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  is_long_lived: boolean;
}

export interface AuthProvider {
  provider_id: string;
  provider_type: AuthProviderType;
  requires_redirect: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginRequest {
  provider_id: string;
  credentials: LoginCredentials;
  device_name?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface SetupRequest {
  username: string;
  password: string;
  display_name?: string;
  device_name?: string;
}

// Remote Access interfaces

export interface RemoteAccessInfo {
  enabled: boolean;
  running: boolean;
  connected: boolean;
  remote_id: string;
  using_ha_cloud: boolean;
  signaling_url: string;
}
