// Global, simple eventbus

import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import mitt, { Emitter } from "mitt";
import { MediaItemType, MediaItemTypeOrItemMapping } from "./api/interfaces";

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
};

export type DeleteGenreDialogEvent = {
  genreIds: string[];
  navigateBack?: boolean;
};

export type LinkGenreDialogEvent = {
  items: MediaItemType[];
};

export type Events = {
  contextmenu: ContextMenuDialogEvent;
  playlistdialog: PlaylistDialogEvent;
  createPlaylist: CreatePlaylistEvent;
  mergeGenreDialog: MergeGenreDialogEvent;
  deleteGenreDialog: DeleteGenreDialogEvent;
  linkGenreDialog: LinkGenreDialogEvent;
  clearSelection: void;
  "homescreen-edit-toggle": void;
  "mobile-sidebar-open": void;
};

export const eventbus: Emitter<Events> = mitt<Events>();
