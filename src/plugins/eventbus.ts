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

export type ImportPlaylistEvent = {
  m3uData: string;
  playlistName: string;
};

export type CreateSmartPlaylistEvent = {
  providerId?: string;
};

export type Events = {
  contextmenu: ContextMenuDialogEvent;
  playlistdialog: PlaylistDialogEvent;
  createPlaylist: CreatePlaylistEvent;
  mergeGenreDialog: MergeGenreDialogEvent;
  deleteGenreDialog: DeleteGenreDialogEvent;
  deleteConfirmationDialog: DeleteConfirmationDialogEvent;
  linkGenreDialog: LinkGenreDialogEvent;
  importPlaylistDialog: ImportPlaylistEvent;
  createSmartPlaylist: CreateSmartPlaylistEvent;
  editItemDialog: Radio | Track | Playlist;
  clearSelection: void;
  genreExcluded: void;
  "homescreen-edit-toggle": void;
  "mobile-sidebar-open": void;
};

export const eventbus: Emitter<Events> = mitt<Events>();
