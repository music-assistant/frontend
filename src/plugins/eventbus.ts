// Global, simple eventbus

import type { ContextMenuItem } from "@/helpers/context_menu_item";
import mitt, { Emitter } from "mitt";
import {
  MediaItemType,
  MediaItemTypeOrItemMapping,
  MediaType,
  Playlist,
  Radio,
  Track,
} from "./api/interfaces";

export type PlaylistDialogEvent = {
  items: MediaItemType[];
  parentItem?: MediaItemType;
};

export type ContextMenuDialogEvent = {
  items: ContextMenuItem[];
  posX?: number;
  posY?: number;
  showPlayMenuHeader?: boolean;
};

export type CreatePlaylistEvent = {
  queueId?: string;
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
  onConfirm: () => void | Promise<void>;
};

export type PlayerGroupPlaybackChange = "remove" | "power_off";

export type PlayerGroupPlaybackDialogEvent = {
  change: PlayerGroupPlaybackChange;
  playerName: string;
  onKeepPlaying: () => void | Promise<void>;
  onStopAndUngroup: () => void | Promise<void>;
};

export type ImportPlaylistEvent = {
  m3uData: string;
  playlistName: string;
};

export type MigratePlaylistDialogEvent = {
  playlist: Playlist;
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

// finished: the flow ended on a FINISH step rather than an ABORT
export type SetupFlowEndedCallback = (finished: boolean) => void;

// Launches the setup flow dialog for one of: adding a provider (by domain),
// reconfiguring a provider instance, or setting up a player.
export type SetupFlowDialogEvent =
  | { kind: "provider"; domain: string }
  | {
      kind: "reconfigure";
      instanceId: string;
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
  linkGenreDialog: LinkGenreDialogEvent;
  importPlaylistDialog: ImportPlaylistEvent;
  migratePlaylistDialog: MigratePlaylistDialogEvent;
  createSmartPlaylist: CreateSmartPlaylistEvent;
  audioOverlayDialog: AudioOverlayDialogEvent;
  playAnnouncementDialog: PlayAnnouncementDialogEvent;
  playerRenameDialog: PlayerRenameDialogEvent;
  setupFlowDialog: SetupFlowDialogEvent;
  editItemDialog: Radio | Track | Playlist;
  clearSelection: void;
  genreExcluded: void;
  "mobile-sidebar-open": void;
};

export const eventbus: Emitter<Events> = mitt<Events>();
