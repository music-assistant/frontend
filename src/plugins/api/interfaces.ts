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
  GAIN = "gain",
  BALANCE = "balance",
  TRANSPOSE = "transpose",
  SAFETY_LIMITER = "safety_limiter",
  COMPRESSOR = "compressor",
  HIGH_LOW_PASS = "high_low_pass",
  CONVOLUTION = "convolution",
  STEREO_WIDTH = "stereo_width",
  CROSSFEED = "crossfeed",
}

export enum HighLowPassMode {
  HIGH_PASS = "high_pass",
  LOW_PASS = "low_pass",
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
  preamp?: number | null;
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

export interface GainFilter extends DSPFilterBase {
  type: DSPFilterType.GAIN;
  gain: number;
}

export interface BalanceFilter extends DSPFilterBase {
  type: DSPFilterType.BALANCE;
  balance: number;
}

export interface TransposeFilter extends DSPFilterBase {
  type: DSPFilterType.TRANSPOSE;
  // Key shift in semitones, -12.0 to +12.0. Fractional values are valid.
  semitones: number;
}

// All values are in user-facing units (dB/ms/ratio); the server converts to
// ffmpeg parameters, so the UI must never send anything else.
export interface SafetyLimiterFilter extends DSPFilterBase {
  type: DSPFilterType.SAFETY_LIMITER;
  ceiling: number;
}

export interface CompressorFilter extends DSPFilterBase {
  type: DSPFilterType.COMPRESSOR;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
  makeup: number;
}

// Slope in dB/octave. Each biquad section is 12 dB/oct, so the filter is a
// cascade of 1/2/4 sections. The server coerces anything else to 12 without
// reporting an error, so only these three values may be sent.
export type HighLowPassSlope = 12 | 24 | 48;

// A first-class high-pass / low-pass filter. `frequency` is the cutoff in Hz,
// 20..20000.
export interface HighLowPassFilter extends DSPFilterBase {
  type: DSPFilterType.HIGH_LOW_PASS;
  mode: HighLowPassMode;
  frequency: number;
  slope: HighLowPassSlope;
}

// Applies a stored impulse response to the audio. `ir_id` references an entry
// in the server-side IR library; an empty string is valid and means "none
// selected", which makes the filter a no-op. `gain` trims the output level,
// since an impulse response changes overall loudness (-60..60 dB).
export interface ConvolutionFilter extends DSPFilterBase {
  type: DSPFilterType.CONVOLUTION;
  ir_id: string;
  gain: number;
}

// Metadata of a stored impulse response. Everything but `name` is probed from
// the file server-side and is informational only.
export interface DSPIRMetadata {
  ir_id: string;
  name: string;
  sample_rate: number;
  channels: number;
  duration: number | null;
}

export interface StereoWidthFilter extends DSPFilterBase {
  type: DSPFilterType.STEREO_WIDTH;
  // 0.0 mono, 1.0 unchanged, 2.0 widest
  width: number;
}

export interface CrossfeedFilter extends DSPFilterBase {
  type: DSPFilterType.CROSSFEED;
  strength: number;
  soundstage: number;
}

// Union type for all possible filters
export type DSPFilter =
  | ParametricEQFilter
  | ToneControlFilter
  | GainFilter
  | BalanceFilter
  | TransposeFilter
  | SafetyLimiterFilter
  | CompressorFilter
  | HighLowPassFilter
  | ConvolutionFilter
  | StereoWidthFilter
  | CrossfeedFilter;

// Main DSP chain configuration
export interface DSPConfig {
  enabled: boolean;
  filters: DSPFilter[];
  input_gain: number;
  output_gain: number;
  preset_id?: string | null;
}

// DSPConfigPreset represents a preset configuration for DSP
export interface DSPConfigPreset {
  preset_id?: string | null;
  name: string;
  config: DSPConfig;
}

export enum DSPState {
  ENABLED = "enabled",
  DISABLED = "disabled",
  DISABLED_BY_UNSUPPORTED_GROUP = "disabled_by_unsupported_group",
  UNKNOWN = "unknown",
}

/// enums

export enum MediaType {
  ARTIST = "artist",
  ALBUM = "album",
  TRACK = "track",
  PLAYLIST = "playlist",
  RADIO = "radio",
  AUDIOBOOK = "audiobook",
  AUDIO_SOURCE = "audio_source",
  SOUND_EFFECT = "sound_effect",
  PODCAST = "podcast",
  PODCAST_EPISODE = "podcast_episode",
  COLLECTION = "collection",
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

export enum ArtistType {
  SINGER = "singer",
  AUTHOR = "author",
  NARRATOR = "narrator",
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
  STEREO_PAIR = "stereo_pair",
  GROUP = "group", // A (dedicated) group player or playergroup.
  PROTOCOL = "protocol",
  DISPLAY = "display",
  VISUALIZER = "visualizer",
  LIGHT = "light",
  UNKNOWN = "unknown",
}

export enum PlayerOptionType {
  BOOLEAN = "boolean",
  INTEGER = "integer",
  FLOAT = "float",
  STRING = "string",
}

export type PlayerOptionValueType = number | string | boolean;

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
  SELECT_SOUND_MODE = "select_sound_mode",
  OPTIONS = "options",
}

export enum SourceControl {
  PLAY = "play",
  PAUSE = "pause",
  NEXT = "next",
  PREVIOUS = "previous",
  SEEK = "seek",
  UNKNOWN = "unknown",
}

export enum EventType {
  PLAYER_ADDED = "player_added",
  PLAYER_UPDATED = "player_updated",
  PLAYER_REMOVED = "player_removed",
  PLAYER_SETTINGS_UPDATED = "player_settings_updated",
  PLAYER_SLEEP_TIMER_UPDATED = "player_sleep_timer_updated",
  QUEUE_ADDED = "queue_added",
  QUEUE_UPDATED = "queue_updated",
  QUEUE_ITEMS_UPDATED = "queue_items_updated",
  QUEUE_TIME_UPDATED = "queue_time_updated",
  QUEUE_SETTINGS_UPDATED = "queue_settings_updated",
  CORE_STATE_UPDATED = "core_state_updated",
  MEDIA_ITEM_ADDED = "media_item_added",
  MEDIA_ITEM_UPDATED = "media_item_updated",
  MEDIA_ITEM_DELETED = "media_item_deleted",
  MEDIA_ITEM_PLAYED = "media_item_played",
  PROVIDERS_UPDATED = "providers_updated",
  TASKS_UPDATED = "tasks_updated",
  MUSIC_SYNC_COMPLETED = "music_sync_completed",
  PLAYER_CONFIG_UPDATED = "player_config_updated",
  PLAYER_DSP_CONFIG_UPDATED = "player_dsp_config_updated",
  PLAYER_OPTIONS_UPDATED = "player_options_updated",
  DSP_PRESETS_UPDATED = "dsp_presets_updated",
  DSP_IRS_UPDATED = "dsp_irs_updated",
  AUTH_SESSION = "auth_session",
  PROVIDER_EVENT = "provider_event",
  DASHBOARD_SESSIONS_UPDATED = "dashboard_sessions_updated",
  DASHBOARD_SHOW = "dashboard_show",
  DASHBOARD_HIDE = "dashboard_hide",
  DASHBOARDS_UPDATED = "dashboards_updated",
  // setup_flow_updated: a running setup flow produced a new/updated step;
  // object_id is the flow_id, data is the SetupFlowStep
  SETUP_FLOW_UPDATED = "setup_flow_updated",
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
  // provider can enumerate sound effect items (used as audio overlay sources)
  SOUND_EFFECTS = "sound_effects",
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
  ARTIST_TRACKS = "artist_tracks",
  ARTIST_TOPTRACKS = "artist_toptracks",
  ARTIST_TOPALBUMS = "artist_topalbums",
  AUTHOR_AUDIOBOOKS = "author_audiobooks",
  NARRATOR_AUDIOBOOKS = "narrator_audiobooks",
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
  SIMILAR_ARTISTS = "similar_artists",
  // playlist-specific features
  PLAYLIST_TRACKS_EDIT = "playlist_tracks_edit",
  PLAYLIST_CREATE = "playlist_create",
  PLAYLIST_CREATE_TRACKS = "playlist_create_tracks",
  PLAYLIST_CREATE_AUDIOBOOKS = "playlist_create_audiobooks",
  PLAYLIST_CREATE_PODCAST_EPISODES = "playlist_create_podcast_episodes",
  PLAYLIST_CREATE_RADIOS = "playlist_create_radios",
  PLAYLIST_CREATE_MIXED = "playlist_create_mixed",
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
  AUDIO_ANALYSIS = "audio_analysis",
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
  // image: presentational entry whose value/default_value is a data-URI image
  IMAGE = "image",
  // url: clickable link; in an invoke_action response the frontend opens it (one-shot)
  URL = "url",

  // Only used in the frontend
  OPTIONS = "options",
}

export enum VolumeNormalizationMode {
  DISABLED = "disabled",
  DYNAMIC = "dynamic",
  MEASUREMENT_ONLY = "measurement_only",
  FALLBACK_FIXED_GAIN = "fallback_fixed_gain",
  FIXED_GAIN = "fixed_gain",
  FALLBACK_DYNAMIC = "fallback_dynamic",
  UNKNOWN = "unknown",
}

export enum CrossfadeMode {
  SMART_CROSSFADE = "smart_crossfade",
  STANDARD_CROSSFADE = "standard_crossfade",
  DISABLED = "disabled",
  UNKNOWN = "unknown",
}

export enum AudioQuality {
  LOW = "low",
  STANDARD = "standard",
  LOSSLESS = "lossless",
  HI_RES = "hi_res",
  UNKNOWN = "unknown",
}

export enum AudioNormalizationMeasurementSource {
  TRACK = "track",
  ALBUM = "album",
  LIVE = "live",
  FALLBACK = "fallback",
  UNKNOWN = "unknown",
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

export enum CoreState {
  STARTING = "starting",
  RUNNING = "running",
  STOPPING = "stopping",
  STOPPED = "stopped",
}

//// api

export interface CommandMessage {
  // Model for a Message holding a command from server to client or client to server.

  message_id?: string;
  command: string;
  args?: Record<string, unknown>;
}

export interface ResultMessageBase {
  // Base class for a result/response of a Command Message.

  message_id: string;
}

export interface SuccessResultMessage extends ResultMessageBase {
  // Message sent when a Command has been successfully executed.

  result: unknown;
  partial: boolean;
}

export interface ErrorResultMessage extends ResultMessageBase {
  // Message sent when a Command did not execute successfully.

  error_code: number;
  details: string | null;
}

export interface EventMessage {
  event: EventType;
  // the frontend also emits synthetic events (connect/disconnect, optimistic updates)
  // without an object_id, so this stays optional as well as nullable
  object_id?: string | null; // player_id, queue_id or uri
  // the server always sends data (null when the event carries none), but those same
  // synthetic events leave it out entirely, so it stays optional
  data?: unknown;
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
  name: string | null;
  status: CoreState;
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

// The server sends every key of the two interfaces below, but the settings UI also
// fabricates config entries and options of its own (frontend-only preferences, injected
// player fields), setting only what it needs - so the fields that carry a server-side
// default stay optional here rather than burdening every synthetic entry.

export interface ConfigValueOption {
  // Model for a value with separated name/value.
  // title: display title, resolved server-side from the translations; null when the
  // option carries no in-code title and no translation matches - fall back to `value`
  title: string | null;
  value: ConfigValueType;
  // disabled: when true the option is shown but not selectable (currently unavailable)
  disabled?: boolean;
  // disabled_reason: optional explanation of why the option is disabled
  disabled_reason?: string | null;
  // description: optional per-option help text shown under the option
  description?: string | null;
}

export interface ConfigEntry {
  // Model for a Config Entry.
  // The definition of something that can be configured for an object (e.g. provider or player)
  // within Music Assistant (without the value).
  // key: used as identifier for the entry, also for localization
  key: string;
  type: ConfigEntryType;
  // label: localized display label, resolved server-side; null when the entry carries no
  // in-code label and no translation matches - fall back to `key`
  label: string | null;
  default_value: ConfigValueType;
  required: boolean;
  // options: select from list of possible values/options, empty when the entry has no fixed set
  options: ConfigValueOption[];
  // range [optional]: select values within range
  range?: number[] | null;
  // description [optional]: extended description of the setting.
  description?: string | null;
  // help_link [optional]: link to help article.
  help_link?: string | null;
  // multi_value [optional]: allow multiple values from the list
  multi_value?: boolean;
  // expanded_options [optional]: render the options inline - all of them, with their
  // descriptions, visible at once (e.g. as a radio group) - instead of behind a dropdown.
  // Ignored when the entry has no options or is multi_value.
  expanded_options?: boolean;
  // depends_on [optional]: key of another entry that gates this one; an unresolved key counts
  // as unmet. While unmet, input types and ACTION stay visible but render disabled;
  // DIVIDER/LABEL/ALERT/IMAGE have nothing to disable, so they are hidden instead.
  depends_on?: string | null;
  // depends_on_value [optional]: complementary to depends_on, the dependency is only met when
  // the other entry holds this exact value (without it, any truthy value will do)
  depends_on_value?: ConfigValueType;
  // depends_on_value_not [optional]: same as depends_on_value but inverted
  depends_on_value_not?: ConfigValueType;
  // hidden: hide from UI
  hidden?: boolean;
  // read_only: prevent user from changing this setting (make it disabled)
  read_only?: boolean;
  // category: category to group this setting into in the frontend (e.g. advanced)
  category: string;
  // action: (configentry)action that is needed to get the value for this entry
  action?: string | null;
  // action_label: default label for the action when no translation for the action is present
  action_label?: string | null;
  // immediate_apply: whether changes to this config entry should be applied immediately
  immediate_apply?: boolean;
  // requires_reload: indicates that a reload of the provider (or player playback)
  // is required when this setting is changed
  requires_reload?: boolean;
  // category_label: localized category display name, resolved server-side
  category_label?: string | null;
  // advanced: indicates this is an advanced setting (hidden by default)
  advanced?: boolean;

  value?: ConfigValueType;
}

export interface Config {
  // Base Configuration object.
  values: Record<string, ConfigEntry>;
}

export interface ConfigActionResult {
  // Outcome of a one-shot config action: a message to show to the user
  // and/or a url to open once. Either may be null; a result that carries
  // neither reports a generic success.
  // message: already localized server-side for the connection locale
  message: string | null;
  open_url: string | null;
}

export enum FlowStepType {
  // form: render config entries and wait for the user to submit
  FORM = "form",
  // external: the user must open an external url (e.g. OAuth); the server
  // advances the flow on the callback (pushed via SETUP_FLOW_UPDATED)
  EXTERNAL = "external",
  // progress: the server is working/waiting on something; no user input
  PROGRESS = "progress",
  // finish: the flow completed; result references the created/updated object
  FINISH = "finish",
  // abort: the flow ended without a result
  ABORT = "abort",
  // fallback
  UNKNOWN = "unknown",
}

export interface SetupFlowStep {
  // A single step of a running setup flow (add/reconfigure a provider or set up a player).
  // Human-readable fields (title/description/progress_text/reason and error values) are
  // already resolved server-side for the connection locale.

  // flow_id: identifier of the running flow this step belongs to
  flow_id: string;
  // step_id: stable slug identifying this step
  step_id: string;
  type: FlowStepType;
  title?: string | null;
  description?: string | null;
  // entries [FORM]: the config entries that make up the form fields
  entries: ConfigEntry[];
  // errors [FORM]: field-key (or "base") -> localized error message
  errors: Record<string, string>;
  // last_step [FORM]: hint for the submit button label (final step vs. continue)
  last_step?: boolean | null;
  // url [EXTERNAL]: url the user must open (e.g. an OAuth authorize url)
  url?: string | null;
  // progress_text [PROGRESS]: localized status message
  progress_text?: string | null;
  // progress [PROGRESS]: optional completion fraction between 0 and 1
  progress?: number | null;
  // image [PROGRESS]: optional data-URI illustration (e.g. a pairing QR code)
  image?: string | null;
  // expires_at [FORM/EXTERNAL/PROGRESS]: UTC epoch deadline for this step; the client
  // countdown is cosmetic, the server enforces the deadline
  expires_at?: number | null;
  // result [FINISH]: reference to the created/updated object (e.g. {"instance_id": ...})
  result?: Record<string, string> | null;
  // reason [ABORT]: localized reason the flow ended
  reason?: string | null;
}

export interface ProviderConfig extends Config {
  // Provider(instance) Configuration.
  type: ProviderType;
  domain: string;
  instance_id: string;
  // enabled: boolean to indicate if the provider is enabled
  enabled: boolean;
  // name: a custom name for this provider instance/config
  name: string | null;
  // default_name: default name to use when there is name available
  default_name: string | null;
  // last_error: structured error if the provider could not be setup with this config
  last_error: ProviderError | null;
  // status: load/lifecycle status, derived server-side
  status: ProviderStatus | null;
}

export interface PlayerConfig extends Config {
  // Player Configuration.
  provider: string;
  player_id: string;
  // enabled: boolean to indicate if the player is enabled
  enabled: boolean;
  // name: a custom name for this player
  name: string | null;
  // default_name: default name to use when there is name available
  default_name: string | null;
}

export interface CoreConfig extends Config {
  // Core(controller) Configuration.
  domain: string;
  last_error: string | null;
}

export interface PlayerQueueConfig extends Config {
  // PlayerQueue Configuration.
  queue_id: string;
}

//// media_items

// Media item types are the one place where `foo?: X | null` is deliberate rather than
// sloppy. Library listings return the slim summary variant of an item, which leaves out
// the fields it has no value for, while fetching the item in full carries every key with
// null instead - and both shapes deserialize as the interfaces below. Only the types that
// have such a summary variant (artist, album, track, playlist, radio, audiobook, podcast,
// genre, item mapping and their metadata) are spelled that way; everything else here,
// including podcast episodes, gets a plain nullable field.

export interface ProviderMapping {
  // Model for a MediaItem's provider mapping details.
  item_id: string;
  provider_domain: string;
  provider_instance: string;
  available: boolean;
  in_library: boolean | null;
  // quality details, carrying defaults for anything but streamable content
  audio_format: AudioFormat;
  // optional details to store provider specific details
  details: string | null;
  // url = link to provider details page if exists
  url: string | null;
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
  // Opaque sha256(provider+path) id used to address the image via the
  // canonical /imageproxy/<proxy_id> endpoint. Injected by the server on
  // schema_version >= 31; null when it issues no id, absent on older servers.
  proxy_id?: string | null;
}

export interface MediaItemChapter {
  position: number;
  name: string;
  start: number;
  end: number | null;
}

// a collection groups related items, most commonly an audiobook series
export interface MediaItemCollection {
  title: string;
  // sorts the item within the collection, e.g. the book number in a series
  sequence: number | string | null;
}

export interface MediaItemMetadata {
  description?: string | null;
  // ISO 639-1 language code of `description`
  description_language?: string | null;
  review?: string | null;
  explicit?: boolean | null;
  images?: MediaItemImage[] | null;
  genres?: string[] | null;
  mood?: string | null;
  style?: string | null;
  copyright?: string | null;
  lyrics?: string | null;
  lrc_lyrics?: string | null;
  label?: string | null;
  links?: MediaItemLink[] | null;
  performers?: string[] | null;
  preview?: string | null;
  popularity?: number | null;
  release_date?: string | null;
  // spoken languages of the content, mostly set for audiobooks and podcasts.
  // the spelling is whatever the provider reports, e.g. "en", "en-us" or "English"
  languages?: string[] | null;
  chapters?: MediaItemChapter[] | null;
  collections?: MediaItemCollection[] | null;
  life_span?: LifeSpan | null;
  artist_entity_type?: ArtistEntityType | null;
}

interface _MediaItemBase {
  item_id: string;
  provider: string;
  name: string;
  version: string;
  // always sent by the server, but omitted from the payloads we send back so the server
  // re-derives it from the (possibly edited) name
  sort_name?: string;
  uri: string;
  external_ids: Array<[ExternalID, string]>;
  is_playable: boolean; // if the item is playable (can be used in play_media command)
  media_type: MediaType;
}

export interface MediaItem extends _MediaItemBase {
  provider_mappings: ProviderMapping[];
  metadata: MediaItemMetadata;
  favorite: boolean;
  position?: number | null; //required for playlist tracks, optional for all other
}

export interface ItemMapping extends _MediaItemBase {
  available: boolean;
  image?: MediaItemImage | null;
  year?: number | null;
}

export interface Artist extends MediaItem {
  artist_type: ArtistType;
}

export interface Album extends MediaItem {
  year?: number | null;
  artists: Array<ItemMapping | Artist>;
  album_type: AlbumType;
}

export interface AudioMetadata {
  // Audio analysis details (e.g. bpm, musical key).
  bpm: number | null;
  musical_key: string | null;
}

export interface Track extends MediaItem {
  duration: number;
  artists: Array<ItemMapping | Artist>;
  // album: the album this track appears on; omitted on slim listings, null for
  // tracks that are not album tracks
  album?: ItemMapping | Album | null;
  disc_number: number;
  track_number: number;
  // only populated when the full track is requested (get_track), never on listings
  audio_metadata?: AudioMetadata | null;
}

export interface Playlist extends MediaItem {
  owner: string;
  is_editable: boolean;
  supported_mediatypes: MediaType[];
  is_dynamic: boolean;
}

export interface Radio extends MediaItem {
  is_dynamic: boolean;
}

export interface SoundEffect extends MediaItem {
  duration: number;
}

export interface AudioSource extends MediaItem {
  can_play_pause: boolean;
  can_seek: boolean;
  can_next_previous: boolean;
  exclusive: boolean;
  allow_external_trigger: boolean;
}

export interface Audiobook extends MediaItem {
  publisher?: string | null;
  authors: string[] | Artist[];
  narrators: string[] | Artist[];
  duration: number;
  fully_played?: boolean | null;
  resume_position_ms?: number | null;
}

export interface Podcast extends MediaItem {
  publisher?: string | null;
  total_episodes?: number | null;
}

export interface PodcastEpisode extends MediaItem {
  position: number;
  podcast: Podcast | ItemMapping;
  duration: number;
  fully_played: boolean | null;
  resume_position_ms: number | null;
}

export interface Genre extends MediaItem {
  genre_aliases?: string[] | null;
  // mapped alias count (own name excluded), sent on summary listings
  // instead of the full genre_aliases list
  genre_alias_count?: number | null;
  // taxonomy this genre belongs to; null/undefined = music/general
  content_type?: MediaType | null;
}

// a browse folder is not a library item: it has no provider mappings, metadata,
// favorite flag or position, so it extends the bare base instead of MediaItem
export interface BrowseFolder extends _MediaItemBase {
  // always FOLDER: lets TS drop the folder from the MediaItemType union on any
  // other media_type check, and makes Exclude<MediaItemType, BrowseFolder> work
  media_type: MediaType.FOLDER;
  path: string;
  image: MediaItemImage | null;
}
export enum RecommendationFolderType {
  DEFAULT = "default",
  TIMELINE = "timeline",
}

export enum ArtistEntityType {
  PERSON = "Person",
  GROUP = "Group",
  ORCHESTRA = "Orchestra",
  CHOIR = "Choir",
  CHARACTER = "Character",
  OTHER = "Other",
}

export interface LifeSpan {
  begin: string | null;
  end: string | null;
  ended: boolean;
}

export interface TimelineEvent {
  id: string;
  artist: Artist;
  eventType: string;
  dateLabel: string;
  offset: number;
}

/** Mirrors music_assistant_models RecommendationFolder. `items` is populated by
 *  the server; per-user visibility is owned by the frontend (discover.rows). */
export interface RecommendationFolder extends BrowseFolder {
  icon: string | null;
  subtitle: string | null;
  items: MediaItemTypeOrItemMapping[];
  enabled_by_default: boolean;
  type: RecommendationFolderType;
  supports_provider_filter: boolean;
}

export interface MediaCollection<M extends MediaItemType> extends MediaItem {
  items: M[];
}

// unlike the server alias of the same name this includes BrowseFolder, because
// browse listings render folders and media items through the same components.
// use Exclude<MediaItemType, BrowseFolder> where only real media items apply.
export type MediaItemType =
  | Artist
  | Album
  | Track
  | Radio
  | AudioSource
  | Playlist
  | Audiobook
  | Podcast
  | PodcastEpisode
  | Genre
  | MediaCollection<MediaItemType>
  | BrowseFolder;

export type PlayableMediaItemType =
  | Track
  | Radio
  | AudioSource
  | Audiobook
  | PodcastEpisode;
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

export interface AudioFidelity {
  quality: AudioQuality;
  // null when bit-perfect status cannot be determined
  bit_perfect: boolean | null;
}

export interface AudioNormalizationDetails {
  mode: VolumeNormalizationMode;
  measurement_source: AudioNormalizationMeasurementSource;
  target_lufs: number | null;
  measured_lufs: number | null;
  applied_gain_db: number | null;
}

export interface AudioQueueProcessing {
  // internal PCM format shared by queue processing, including F32 headroom
  pcm_format: AudioFormat | null;
  normalization: AudioNormalizationDetails | null;
  playback_speed: number;
  crossfade_mode: CrossfadeMode;
  overlay_active: boolean;
}

export interface AudioDSPDetails {
  state: DSPState;
  input_gain: number;
  filters: DSPFilter[];
  output_gain: number;
  // cleared when the user changes DSP settings manually
  preset_id: string | null;
}

export interface AudioOutputDetails {
  player_ids: string[];
  dsp: AudioDSPDetails;
  // set only for explicit left/right routing; formats show mono/stereo conversion
  source_channel: AudioChannel | null;
  // furthest downstream format known to Music Assistant
  output_format: AudioFormat | null;
  fidelity: AudioFidelity;
}

export interface AudioProcessingChain {
  input_fidelity: AudioFidelity;
  queue_processing: AudioQueueProcessing | null;
  outputs: AudioOutputDetails[];
}

export interface StreamMetadata {
  // mandatory fields
  title: string;
  // nullable fields (always present, null when not set)
  artist: string | null;
  album: string | null;
  image_url: string | null;
  duration: number | null;
  uri: string | null;
}

export interface StreamDetails {
  provider: string;
  item_id: string;
  audio_format: AudioFormat;
  media_type: MediaType;
  stream_metadata: StreamMetadata | null;
  duration: number | null;
  audio_processing: AudioProcessingChain | null;
}

// queue_item

export interface QueueItem {
  queue_id: string;
  queue_item_id: string;
  name: string;
  // duration: null for items without a fixed length (radio stations, live sources)
  duration: number | null;
  sort_index: number;
  streamdetails: StreamDetails | null;
  media_item: PlayableMediaItemType | null;
  image: MediaItemImage | null;
  available: boolean;
  // Party: extra_attributes for guest-added items
  extra_attributes?: {
    party_guest?: boolean; // true if added by party guest
    party_boosted?: boolean; // true if added as "boost" (play next)
    playback_speed?: number; // current playback speed multiplier (audiobook/podcast)
  };
}

// player_queue

export interface PlayerQueue {
  queue_id: string;
  // active: whether the player is currently playing this queue. Server-derived from the
  // player's active_source: false only while an external source (line-in, Spotify Connect,
  // another queue in a group) has taken the player over - a stopped or finished queue stays
  // active and idle. Recalculated ~0.5s after the active_source change that causes it, so
  // during a handover it can briefly still hold the value from before.
  active: boolean;
  display_name: string;
  available: boolean;
  items: number;
  shuffle_enabled: boolean;
  // smart_shuffle_active: whether shuffle is currently in "smart" mode (server-derived,
  // read-only). True when shuffle is on with the per-queue smart-shuffle setting enabled,
  // or while radio mode is active. Lets clients show a smart-shuffle indicator.
  smart_shuffle_active: boolean;
  autoplay_enabled: boolean;
  repeat_mode: RepeatMode;
  crossfade_enabled: boolean;
  // smart_fades_active: whether the effective crossfade is currently smart crossfade (server-derived,
  // read-only). Lets clients show a smart-fades indicator when crossfade is on and smart is active.
  smart_fades_active: boolean;
  // audio overlay: a looping sound effect mixed into this queue's playback.
  // overlay_source holds the selected sound effect (kept when the overlay is
  // disabled so it can be re-enabled with the same sound), overlay_volume is
  // the overlay loudness relative to the music in percent (100 = equally loud).
  overlay_enabled: boolean;
  overlay_source: ItemMapping | null;
  overlay_volume: number;
  current_index: number | null;
  index_in_buffer: number | null;
  // ended: whether the queue played all the way to its end and is waiting to be restarted
  // (server-derived, read-only). The position stays on the last item, so this flag is what
  // tells a finished queue apart from one that is merely stopped on that item. Pressing play
  // on an ended queue starts it over from the beginning.
  ended: boolean;
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
  current_item: QueueItem | null;
  next_item: QueueItem | null;
  // The queue's enqueued parent items (its origin), present regardless of mode.
  // When one or more sources are dynamic, the queue runs in dynamic mode
  // (is_dynamic), implicitly enabling autoplay and smart shuffle.
  sources: ItemMapping[];
  is_dynamic: boolean;
  // extra_attributes: additional attributes for this player_queue to store/forward
  // additional data that is not part of the standard model
  // must be serializable types only
  extra_attributes?: Record<string, unknown>;
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
  protocol_domain: string; // e.g., "airplay", "dlna"; the player's own domain for native
  priority: number; // Lower = more preferred (native = 0 if supported)
  available: boolean; // Whether this output protocol is currently available
  // derived_from: for a derived transport that rides on another protocol (e.g. a Sendspin
  // bridge over an AirPlay player), the output_protocol_id of the base output; null for direct outputs
  derived_from: string | null;
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  software_version: string | null;
  model_id: string | null;
  manufacturer_id: string | null;
  // Identifiers for device identification and protocol player linking
  // Maps IdentifierType to value (e.g., MAC_ADDRESS -> "AA:BB:CC:DD:EE:FF")
  identifiers: Record<IdentifierType, string>;
}

export interface MediaItemPalette {
  background_dark: [number, number, number] | null;
  background_light: [number, number, number] | null;
  primary: [number, number, number] | null;
  accent: [number, number, number] | null;
  on_dark: [number, number, number] | null;
  on_light: [number, number, number] | null;
}

export interface PlayerMedia {
  uri: string; // uri or other identifier of the loaded media
  media_type: MediaType;
  title: string | null;
  artist: string | null;
  album: string | null;
  image_url: string | null;
  palette: MediaItemPalette | null;
  duration: number | null;
  source_id: string | null;
  elapsed_time: number | null;
  elapsed_time_last_updated: number | null;
  queue_item_id: string | null; // only set for requests from the queue controller
}

export interface PlayerSource {
  id: string;
  name: string;
  passive: boolean;
  can_play_pause: boolean;
  can_seek: boolean;
  can_next_previous: boolean;
  can_shuffle: boolean;
  can_repeat: boolean;
  // the ordering the source reports for itself; null = it has not said
  shuffle_enabled: boolean | null;
  repeat_mode: RepeatMode | null;
}

export interface PlayerSoundMode {
  id: string;
  name: string;
  passive: boolean;
}

// TTS engine that can speak an announcement; its name is already
// formatted for display as "<provider> | <engine>".
export interface AnnouncementTtsEngine {
  uid: string;
  name: string;
}

export interface PlayerOptionEntry {
  key: string;
  name: string;
  type: PlayerOptionType;

  value: PlayerOptionValueType;
}

export interface PlayerOption {
  key: string;
  name: string;
  type: PlayerOptionType;

  translation_key: string;

  value: PlayerOptionValueType;
  read_only: boolean;

  min_value: number | null;
  max_value: number | null;
  step: number | null;

  options: PlayerOptionEntry[] | null;
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

  elapsed_time: number | null;
  elapsed_time_last_updated: number | null;
  current_media: PlayerMedia | null;
  playback_state: PlaybackState;
  powered: boolean | null;
  volume_level: number | null;
  volume_muted: boolean | null;
  group_members: string[];
  static_group_members: string[];
  // active_source: id of the source the player is currently playing - its own queue_id for
  // Music Assistant playback, or an external source id. PlayerQueue.active is derived from
  // this, and PLAYER_UPDATED carries a new value before the queue is recalculated, so the
  // two can disagree for about half a second during a source handover.
  active_source: string | null;
  source_list: PlayerSource[];
  active_sound_mode: string | null;
  sound_mode_list: PlayerSoundMode[];
  options: PlayerOption[];
  active_group: string | null;
  synced_to: string | null;

  // group_volume: the server currently substitutes 0 for an unset value, so null does not
  // reach us today; it stays nullable because that substitution is a temporary shim for
  // older Home Assistant integration versions.
  group_volume: number | null;
  group_volume_muted: boolean | null;
  hide_in_ui: boolean;
  // private: the player belongs to a single device (a web/app client) or is an
  // internal anchor; together with hide_in_ui it keeps the player out of the
  // pickers on every other device
  private: boolean;
  icon: string;
  power_control: string;
  volume_control: string;
  mute_control: string;
  needs_setup: boolean;
  // this player (or a wrapped protocol child) offers a setup flow that can be re-run on demand
  has_setup_flow: boolean;

  // output_protocols: all available output methods for this player
  // Includes native output (if PLAY_MEDIA supported) + protocol outputs
  output_protocols: OutputProtocol[];

  // active_output_protocol: which output protocol is currently being used for playback
  // Can be "native" or a protocol player_id
  // null means no playback in progress or native playback without explicit selection
  active_output_protocol: string | null;

  // sleep_timer_expires_at: unix (utc) timestamp at which the active sleep timer
  // will stop playback, or null when no sleep timer is set.
  sleep_timer_expires_at: number | null;
}

// provider

export enum ProviderIconVariant {
  DEFAULT = "default",
  DARK = "dark",
  MONOCHROME = "monochrome",
}

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
  documentation: string | null;
  // multi_instance: whether multiple instances of the same provider are allowed/possible
  multi_instance: boolean;
  // builtin: whether this provider is a system/builtin and can not disabled/removed
  builtin: boolean;
  // allow_disable: whether this provider can be disabled (used with builtin)
  allow_disable: boolean;
  // has_setup_flow: whether setup can be run again to reconfigure the provider
  has_setup_flow: boolean;
  stage: ProviderStage;
  // icon: material design icon
  icon: string | null;
  // icon_images: which icon variants this provider supplies as image files.
  icon_images: ProviderIconVariant[];
  // depends on: domain of another provider that is required for this provider
  depends_on: string | null;
}

export enum ProviderStage {
  ALPHA = "alpha",
  BETA = "beta",
  STABLE = "stable",
  EXPERIMENTAL = "experimental",
  UNMAINTAINED = "unmaintained",
  DEPRECATED = "deprecated",
}

export enum ProviderStatus {
  LOADED = "loaded",
  LOADING = "loading",
  DISABLED = "disabled",
  AUTH_REQUIRED = "auth_required",
  INCOMPATIBLE = "incompatible",
  ERROR = "error",
}

export interface ProviderError {
  // Structured error describing why a provider failed to load. The server
  // localizes `message` (translation key/args are stripped server-side), so the
  // client renders it directly.
  error_code: number;
  message: string;
}

export interface ProviderInstance {
  // Provider instance details when a provider is serialized over the api.
  type: ProviderType;
  domain: string;
  name: string;
  instance_id: string;
  supported_features: ProviderFeature[];
  available: boolean;
  is_streaming_provider: boolean | null;
}

export interface DashboardDevice {
  // A dashboard endpoint self-registered with the server (e.g. a Chromecast).
  dashboard_id: string;
  name: string;
  supported_types: DashboardType[];
  provider_domain_hint: string | null; // provider domain used to resolve this endpoint's icon
}

export type DashboardType = "party" | "now_playing" | "music_quiz";

export interface DashboardSession {
  // An active dashboard cast session on a device.
  dashboard_id: string;
  name: string;
  dashboard: DashboardType;
  player_id: string | null; // target player for the now_playing dashboard
}

export enum TaskStatus {
  IDLE = "idle",
  PENDING = "pending",
  RUNNING = "running",
  SUCCESS = "success",
  PARTIAL_SUCCESS = "partial_success",
  FAILED = "failed",
  CANCELLED = "cancelled",
  UNKNOWN = "unknown",
}

export enum TaskScheduleType {
  HOURLY = "hourly",
  DAILY = "daily",
  WEEKLY = "weekly",
  UNKNOWN = "unknown",
}

export interface TaskSchedule {
  type: TaskScheduleType;
  enabled: boolean;
  every?: number | null;
  days_of_week?: number[] | null;
  hour?: number | null;
  minute?: number | null;
}

export type TaskMetadataValue =
  | null
  | boolean
  | number
  | string
  | TaskMetadataValue[]
  | { [key: string]: TaskMetadataValue };

export type TaskMetadata = Record<string, TaskMetadataValue>;

export interface BackgroundTask {
  id: string;
  name: string;
  status: TaskStatus;
  report: string | null;
  logs: string[];
  schedule: TaskSchedule | null;
  last_run: string | null;
  next_run: string | null;
  user_id: string | null;
  last_run_user_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  failure_count: number;
  failure_messages: string[];
  metadata: TaskMetadata;
  progress: number | null;
  progress_text: string | null;
  allow_retry: boolean;
  allow_cancel: boolean;
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
  GUEST = "guest",
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
  display_name: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  provider_filter: string[];
  player_filter: string[];
  // Use authManager.isPartyGuest() to check for party sessions.
}

export interface AuthToken {
  token_id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
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

// Party interfaces

export interface PartyConfig {
  enable_rate_limiting: boolean;
  enable_add_queue: boolean;
  add_queue_limit: number;
  add_queue_refill_minutes: number;
  enable_boost: boolean;
  boost_limit: number;
  boost_refill_minutes: number;
  enable_skip_song: boolean;
  skip_song_limit: number;
  skip_song_refill_minutes: number;
  karaoke_mode: boolean;
  highlight_ahead: boolean;
  request_badge_color?: string;
  boost_badge_color?: string;
  anti_burn_in: boolean;
  party_name: string | null;
  qr_text: string | null;
  hide_back_button: boolean;
  show_progress_bar: boolean;
  // Shared-audio experience for guests: "venue" (opt-in) or "remote" (silent disco).
  mode?: "venue" | "remote";
}

export interface SmartPlaylistRules {
  genre_ids: number[];
  artist_ids: number[];
  album_ids: number[];
  favorites_only: boolean;
  explicit?: boolean | null;
  seed_track_uris?: string[];
  seed_artist_uris?: string[];
  seed_album_uris?: string[];
  seed_playlist_uris?: string[];
  seed_names?: Record<string, string>;
  min_popularity?: number | null;
  logic: "AND" | "OR";
  limit: number;
  genre_names?: Record<number, string>;
  artist_names?: Record<number, string>;
  album_names?: Record<number, string>;
  year_from?: number | null;
  year_to?: number | null;
  excluded_artist_ids?: number[];
  excluded_album_ids?: number[];
  excluded_genre_ids?: number[];
  excluded_track_uris?: string[];
  excluded_artist_names?: Record<number, string>;
  excluded_album_names?: Record<number, string>;
  excluded_genre_names?: Record<number, string>;
  album_types?: string[];
  excluded_album_types?: string[];
  min_duration?: number | null;
  max_duration?: number | null;
  last_played_before_value?: number | null;
  last_played_before_unit?: string | null;
}

export interface SmartPlaylistTrackStats {
  count: number;
  duration_seconds: number;
}

// AI Radio interfaces

export type AIRadioSectionType = "ai_text" | "ai_meta";
export type AIRadioWebSearchMode = "disabled" | "allow" | "force";

export interface AIRadioSectionConstraints {
  max_chars?: number;
}

export interface AIRadioSection {
  id: string;
  name: string;
  type: AIRadioSectionType;
  prompt: string;
  web_search?: AIRadioWebSearchMode;
  constraints?: AIRadioSectionConstraints;
  cover_image?: string;
}

export interface AIRadioOptionalGuards {
  min_gap_songs?: number;
  max_per_60min?: number;
  require_placeholders_present?: string[];
}

export interface AIRadioAlternativeChoice {
  section: string;
  weight: number;
}

export interface AIRadioFlowMust {
  MUST: string;
}

export interface AIRadioFlowAlternative {
  ALTERNATIVE: {
    choices: AIRadioAlternativeChoice[];
  };
}

export interface AIRadioFlowOptional {
  OPTIONAL: {
    section: string;
    chance?: number;
    guards?: AIRadioOptionalGuards;
  };
}

export type AIRadioFlowItem =
  | AIRadioFlowMust
  | AIRadioFlowAlternative
  | AIRadioFlowOptional;

export type AIRadioPlacement =
  | "start_of_playlist"
  | "between_songs"
  | "end_of_playlist";

export interface AIRadioSectionOrderRule {
  when: AIRadioPlacement;
  flow: AIRadioFlowItem[];
}

export interface AIRadioHost {
  id: string;
  name: string;
  instructions: string;
  // tts_engine: "" means use the provider default engine
  tts_engine: string;
  // language: "" means follow the server language
  language: string;
  // options: free-form key/value pairs passed straight through to the TTS engine
  options: Record<string, unknown>;
  section_ids: string[];
  section_order: AIRadioSectionOrderRule[];
  merge_section_id: string;
}

export interface AIRadioStation {
  id: string;
  name: string;
  source_playlist_id: string;
  source_playlist_provider: string;
  default_player_id?: string;
  max_duration_minutes?: number;
  shuffle_source_tracks?: boolean;
  host_id: string;
}

export interface AIRadioSession {
  session_id: string;
  station_id: string;
  queue_id: string | null;
  status: "running" | "completed" | "failed" | "stopped";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  error: string | null;
  skipped_sections?: number;
  last_render_error: string | null;
  progress?: {
    phase?: string;
    [key: string]: unknown;
  };
  result?: {
    queue_entries?: number;
    planned_sections?: number;
    skipped_sections?: number;
    [key: string]: unknown;
  };
}

export interface AIRadioStatus {
  sessions: AIRadioSession[];
}
