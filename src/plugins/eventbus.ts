// Global, simple eventbus

import mitt, { Emitter } from "mitt";
import { MediaItemType } from "./api/interfaces";
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";

export type PlaylistDialogEvent = {
  items: MediaItemType[];
  parentItem?: MediaItemType;
};

export type ContextMenuDialogEvent = {
  items: ContextMenuItem[];
  posX?: number;
  posY?: number;
  showPlayMenuHeader?: boolean;
  zIndex?: number;
};

export type Events = {
  contextmenu: ContextMenuDialogEvent;
  playlistdialog: PlaylistDialogEvent;
};

export const eventbus: Emitter<Events> = mitt<Events>();
