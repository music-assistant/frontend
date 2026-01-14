// Re-export types from the Vue frontend
// This allows us to share type definitions between web and mobile
// In a monorepo setup, you could import directly, but for now we'll maintain compatibility

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTH_REQUIRED = 'auth_required',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  INITIALIZED = 'initialized',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

export enum MediaType {
  ARTIST = 'artist',
  ALBUM = 'album',
  TRACK = 'track',
  PLAYLIST = 'playlist',
  RADIO = 'radio',
  AUDIOBOOK = 'audiobook',
  PODCAST = 'podcast',
  PODCAST_EPISODE = 'podcast_episode',
  FOLDER = 'folder',
  UNKNOWN = 'unknown',
}

export enum RepeatMode {
  OFF = 'off',
  ONE = 'one',
  ALL = 'all',
}

export enum PlaybackState {
  IDLE = 'idle',
  PAUSED = 'paused',
  PLAYING = 'playing',
}

export enum QueueOption {
  PLAY = 'play',
  REPLACE = 'replace',
  NEXT = 'next',
  REPLACE_NEXT = 'replace_next',
  ADD = 'add',
}

export interface User {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  role: 'admin' | 'user';
  enabled: boolean;
  player_filter?: string[];
  provider_filter?: string[];
}

export interface Player {
  player_id: string;
  name: string;
  type: 'player' | 'group' | 'stereo_pair';
  available: boolean;
  powered?: boolean;
  volume_level?: number;
  volume_muted?: boolean;
  state?: PlaybackState;
  playback_state?: PlaybackState;
  current_item?: QueueItem;
  active_source?: string;
  group_volume?: number;
  features?: string[];
  provider?: string;
}

export interface QueueItem {
  queue_item_id: string;
  queue_id: string;
  name: string;
  duration?: number;
  duration_ms?: number;
  position: number;
  media_item: MediaItem;
  streamdetails?: StreamDetails;
}

export interface PlayerQueue {
  queue_id: string;
  display_name: string;
  player_id: string;
  queue_items: QueueItem[];
  items: number;
  elapsed_time: number;
  elapsed_time_ms: number;
  state: PlaybackState;
  current_index?: number;
  current_item?: QueueItem;
  shuffle_enabled: boolean;
  repeat_mode: RepeatMode;
  dont_stop_the_music_enabled: boolean;
}

export interface MediaItem {
  item_id: string;
  provider: string;
  provider_instance: string;
  name: string;
  uri: string;
  media_type: MediaType;
  favorite?: boolean;
  metadata?: Record<string, any>;
}

// Minimal image types used for covers/thumbnails
export enum ImageType {
  THUMB = 'thumb',
  LANDSCAPE = 'landscape',
}

export interface MediaItemImage {
  type: ImageType;
  path: string;
  provider: string;
  remotely_accessible: boolean;
}

export interface Track extends MediaItem {
  media_type: MediaType.TRACK;
  duration?: number;
  duration_ms?: number;
  artists: Artist[];
  album?: Album;
  disc_number?: number;
  track_number?: number;
}

export interface Artist extends MediaItem {
  media_type: MediaType.ARTIST;
  musicbrainz_id?: string;
}

export interface Album extends MediaItem {
  media_type: MediaType.ALBUM;
  artists: Artist[];
  year?: number;
  version?: string;
  album_type?: string;
  musicbrainz_id?: string;
}

export interface Playlist extends MediaItem {
  media_type: MediaType.PLAYLIST;
  owner?: string;
  is_editable?: boolean;
}

export interface Podcast extends MediaItem {
  media_type: MediaType.PODCAST;
}

export interface PodcastEpisode extends MediaItem {
  media_type: MediaType.PODCAST_EPISODE;
}

export interface Audiobook extends MediaItem {
  media_type: MediaType.AUDIOBOOK;
  authors?: Artist[];
}

export interface Radio extends MediaItem {
  media_type: MediaType.RADIO;
}

export interface BrowseFolder extends MediaItem {
  media_type: MediaType.FOLDER;
  path?: string;
}

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  playlists: Playlist[];
  podcasts: Podcast[];
  audiobooks: Audiobook[];
  radio: Radio[];
}

export interface StreamDetails {
  provider: string;
  item_id: string;
  uri: string;
  media_type: MediaType;
  content_type?: string;
  sample_rate?: number;
  bit_depth?: number;
  channels?: number;
  bit_rate?: number;
  duration?: number;
  size?: number;
  direct?: string;
  can_seek?: boolean;
}

export interface ServerInfo {
  server_version: string;
  server_id: string;
  schema_version: number;
  onboard_done: boolean;
}

export interface CommandMessage {
  command: string;
  message_id: string;
  args?: Record<string, any>;
}

export interface SuccessResultMessage {
  message_id: string;
  result: any;
  partial?: boolean;
}

export interface ErrorResultMessage {
  message_id: string;
  error_code: string;
  details?: string;
}

export enum EventType {
  PLAYER_ADDED = 'player_added',
  PLAYER_UPDATED = 'player_updated',
  PLAYER_REMOVED = 'player_removed',
  QUEUE_ADDED = 'queue_added',
  QUEUE_UPDATED = 'queue_updated',
  QUEUE_TIME_UPDATED = 'queue_time_updated',
  PROVIDERS_UPDATED = 'providers_updated',
  SYNC_TASKS_UPDATED = 'sync_tasks_updated',
}

export interface EventMessage {
  event: EventType | string;
  object_id?: string;
  data?: any;
}

export enum ProviderType {
  MUSIC = 'music',
  PLAYER = 'player',
}

export enum ProviderFeature {
  BROWSE = 'browse',
  SEARCH = 'search',
  RECOMMENDATIONS = 'recommendations',
}

export interface ProviderInstance {
  type: ProviderType;
  domain: string;
  name: string;
  default_name: string;
  instance_name_postfix?: string;
  instance_id: string;
  supported_features: ProviderFeature[];
  available: boolean;
  is_streaming_provider?: boolean;
  enabled?: boolean;
}

export interface RecommendationFolder {
  item_id: string;
  provider: string;
  provider_instance: string;
  name: string;
  uri: string;
  media_type: MediaType;
  favorite?: boolean;
  icon?: string;
  metadata?: Record<string, any>;
  // Items contained in this recommendation row
  items: MediaItem[];
  translation_key?: string;
}
