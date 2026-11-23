// Global, simple eventbus

import type { ContextMenuItem } from "@/helpers/context_menu_item";
import type { MultiChannelLayouts } from "@/helpers/multi_channel";
import mitt, { Emitter } from "mitt";
import {
  ConfigValueType,
  MediaItemType,
  MediaItemTypeOrItemMapping,
  MediaType,
  PlayerProtocolInfo,
  Playlist,
  Radio,
  Track,
} from "./api/interfaces";

export type PlaylistDialogEvent = {
  items: MediaItemType[];
  parentItem?: MediaItemType;
  // add the items of this queue instead of items
  queueId?: string;
};

export type ContextMenuDialogEvent = {
  items: ContextMenuItem[];
  posX?: number;
  posY?: number;
  showPlayMenuHeader?: boolean;
};

export type CreatePlaylistEvent = {
  providerId?: string;
};

export type MergeGenreDialogEvent = {
  genreIds: string[];
  genreNames: string[];
  genreContentTypes: (MediaType | null | undefined)[];
};

export type DeleteGenreDialogEvent = {
  genreIds: string[];
  navigateBack?: boolean;
};

export type LinkGenreDialogEvent = {
  items: MediaItemType[];
};

export type DeleteConfirmationDialogEvent = {
  message: string;
  title?: string;
  confirmLabel?: string;
  // false for a confirmation that does not destroy anything: the confirm button
  // is then the regular one instead of the red destructive one
  destructive?: boolean;
  // when set, a checkbox with this label has to be ticked before the confirm
  // button is enabled
  acknowledgement?: string;
  // shown as a list below the message, such as the names of what is removed
  items?: string[];
  onConfirm: () => void | Promise<void>;
};

export type PlayerGroupPlaybackChange = "remove" | "power_off";

export type PlayerGroupPlaybackDialogEvent = {
  change: PlayerGroupPlaybackChange;
  playerName: string;
  // the player is the built-in player of this device
  isThisDevice: boolean;
  onKeepPlaying: () => void | Promise<void>;
  onStopAndUngroup: () => void | Promise<void>;
};

// Playback was refused because another player is playing from the only stream of a
// provider, such as a Spotify account
export type StreamHeldDialogEvent = {
  holderQueueId: string;
  holderName: string;
  providerName: string;
  // sends the refused command again
  retry: () => Promise<unknown>;
};

export type ImportPlaylistEvent = {
  m3uData: string;
  playlistName: string;
};

export type MigratePlaylistDialogEvent = {
  playlist: Playlist;
};

export type PlaylistAccessDialogEvent = {
  playlist: Playlist;
};

export type ShareLinkPreviewEvent = {
  uri: string;
};

export type CreateSmartPlaylistEvent = {
  providerId?: string;
};

export type AudioOverlayDialogEvent = {
  queueId: string;
};

export type PlayAnnouncementDialogEvent = {
  playerId: string;
};

export type PlayerRenameDialogEvent = {
  playerId: string;
  // the custom name currently set, empty while the player uses its default name
  name?: string | null;
  // shown as the placeholder and restored when the custom name is cleared
  defaultName?: string | null;
};

export type PlayerMergeDialogEvent = {
  // the player that goes into the one the user picks
  playerId: string;
  playerName: string;
  // called with the id of the player that stays
  onMerged?: (targetPlayerId: string) => void;
};

export type MultiChannelPlayerDialogEvent = {
  // the speaker the multi-channel player starts from
  playerId: string;
  playerName: string;
  // the protocol of that speaker that moves into the multi-channel player
  protocol: PlayerProtocolInfo;
  // the layouts the provider of that protocol offers
  layouts: MultiChannelLayouts;
  // called with the id of the new player
  onCreated?: (playerId: string) => void;
};

export type MultiChannelSubwooferDialogEvent = {
  // the multi-channel player the subwoofer joins
  playerId: string;
  playerName: string;
  // the instance id of the provider that combines its speakers
  provider: string;
  // called once the subwoofer joined
  onAdded?: () => void;
};

// finished: the flow ended on a FINISH step rather than an ABORT
export type SetupFlowEndedCallback = (finished: boolean) => void;

// Launches the setup flow dialog for one of: adding a provider (by domain),
// reconfiguring a provider instance, or setting up a player.
export type SetupFlowDialogEvent =
  | {
      kind: "provider";
      domain: string;
      // values for entries of the first form step, by entry key; the user still
      // sees the step and confirms it
      initialValues?: Record<string, ConfigValueType>;
      onFlowEnded?: SetupFlowEndedCallback;
    }
  | {
      kind: "reconfigure";
      instanceId: string;
      // heads the dialog when the instance is not loaded
      name?: string;
      onFlowEnded?: SetupFlowEndedCallback;
    }
  | { kind: "player"; playerId: string; onFlowEnded?: SetupFlowEndedCallback };

export type Events = {
  contextmenu: ContextMenuDialogEvent;
  playlistdialog: PlaylistDialogEvent;
  createPlaylist: CreatePlaylistEvent;
  mergeGenreDialog: MergeGenreDialogEvent;
  deleteGenreDialog: DeleteGenreDialogEvent;
  deleteConfirmationDialog: DeleteConfirmationDialogEvent;
  playerGroupPlaybackDialog: PlayerGroupPlaybackDialogEvent;
  streamHeldDialog: StreamHeldDialogEvent;
  linkGenreDialog: LinkGenreDialogEvent;
  importPlaylistDialog: ImportPlaylistEvent;
  migratePlaylistDialog: MigratePlaylistDialogEvent;
  playlistAccessDialog: PlaylistAccessDialogEvent;
  shareLinkPreview: ShareLinkPreviewEvent;
  createSmartPlaylist: CreateSmartPlaylistEvent;
  audioOverlayDialog: AudioOverlayDialogEvent;
  playAnnouncementDialog: PlayAnnouncementDialogEvent;
  playerRenameDialog: PlayerRenameDialogEvent;
  playerMergeDialog: PlayerMergeDialogEvent;
  multiChannelPlayerDialog: MultiChannelPlayerDialogEvent;
  multiChannelSubwooferDialog: MultiChannelSubwooferDialogEvent;
  setupFlowDialog: SetupFlowDialogEvent;
  editItemDialog: Radio | Track | Playlist;
  clearSelection: void;
  genreExcluded: void;
  "mobile-sidebar-open": void;
};

export const eventbus: Emitter<Events> = mitt<Events>();
