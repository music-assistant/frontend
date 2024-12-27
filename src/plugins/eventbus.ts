// Global, simple eventbus

import mitt, { Emitter } from "mitt";
import { MediaItemType } from "./api/interfaces";
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";

export type PlaylistDialogEvent = {
  items: MediaItemType[];
  parentItem?: MediaItemType;
};

export type ItemContextMenuDialogEvent = {
  items: ContextMenuItem[];
  posX?: number;
  posY?: number;
};

export type MediaItemContextMenuDialogEvent = {
  items: MediaItemType[];
  parentItem?: MediaItemType;
  showContextMenuItems?: boolean;
  posX?: number;
  posY?: number;
};

export type Events = {
  contextmenu: ItemContextMenuDialogEvent;
  playlistdialog: PlaylistDialogEvent;
};

export const eventbus: Emitter<Events> = mitt<Events>();
