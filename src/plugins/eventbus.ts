// Global, simple eventbus

import mitt, { Emitter } from 'mitt';
import { MediaItemType } from './api/interfaces';

export type PlaylistDialogEvent = {
  items: MediaItemType[]
  parentItem?: MediaItemType
}
export type PlayItemDialogEvent = {
  items: MediaItemType[]
  parentItem?: MediaItemType,
  showContextMenuItems?: boolean
}

export type Events = {
    playdialog: PlayItemDialogEvent;
    playlistdialog: PlaylistDialogEvent;
  };

export const eventbus: Emitter<Events> = mitt<Events>()
