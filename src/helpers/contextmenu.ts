// Helpers and utilities for Contextmenu items

import router from '@/plugins/router';
import { eventbus } from '@/plugins/eventbus';
import api from '@/plugins/api';
import {
  MediaItemType,
  ProviderFeature,
  MediaItem,
  QueueOption,
  MediaType,
  Playlist,
  Album,
  Track,
} from '@/plugins/api/interfaces';
import { useI18n } from 'vue-i18n';
import { i18n } from '@/plugins/i18n';

export interface ContextMenuItem {
  label: string;
  labelArgs: Array<string | number>;
  action: CallableFunction;
  icon: string;
  disabled?: boolean;
  hide?: boolean;
}

export const itemIsAvailable = function (item: MediaItemType) {
  for (const x of item.provider_mappings) {
    if (x.available && api.providers[x.provider_instance]?.available) return true;
  }
  return false;
};

export const radioSupported = function (item: MediaItemType) {
  for (const provId of item.provider_mappings) {
    if (api.providers[provId.provider_instance]?.supported_features.includes(ProviderFeature.SIMILAR_TRACKS))
      return true;
  }
  return false;
};

export const getPlayMenuItems = function (items: MediaItem[], parentItem?: MediaItem) {
  const playMenuItems: ContextMenuItem[] = [];
  if (items.length == 0 || !itemIsAvailable(items[0])) {
    return playMenuItems;
  }
  let queueOptPlay = QueueOption.PLAY;
  let queueOptNext = QueueOption.NEXT;
  if (items.length > 10 || [MediaType.ALBUM, MediaType.PLAYLIST].includes(items[0].media_type)) {
    queueOptPlay = QueueOption.REPLACE;
    queueOptNext = QueueOption.REPLACE_NEXT;
  }
  // Play from here (playlist track)
  if (items.length == 1 && parentItem && parentItem.media_type == MediaType.PLAYLIST) {
    playMenuItems.push({
      label: 'play_playlist_from',
      action: () => {
        api.playMedia(parentItem as Playlist, QueueOption.REPLACE, false, items[0].item_id);
      },
      icon: 'mdi-play-circle-outline',
      labelArgs: [],
    });
  }
  // Play from here (album track)
  if (items.length == 1 && parentItem && parentItem.media_type == MediaType.ALBUM) {
    playMenuItems.push({
      label: 'play_album_from',
      action: () => {
        api.playMedia(parentItem as Album, QueueOption.REPLACE, false, items[0].item_id);
      },
      icon: 'mdi-play-circle-outline',
      labelArgs: [],
    });
  }

  // Play NOW
  playMenuItems.push({
    label: 'play_now',
    action: () => {
      api.playMedia(items, queueOptPlay);
    },
    icon: 'mdi-play-circle-outline',
    labelArgs: [],
  });

  // Start Radio
  if (radioSupported(items[0])) {
    playMenuItems.push({
      label: 'play_radio',
      action: () => {
        api.playMedia(items, queueOptPlay, true);
      },
      icon: 'mdi-radio-tower',
      labelArgs: [],
    });
  }

  // Play NEXT
  if (items.length === 1 || items[0].media_type === MediaType.TRACK) {
    playMenuItems.push({
      label: 'play_next',
      action: () => {
        api.playMedia(items, queueOptNext);
      },
      icon: 'mdi-skip-next-circle-outline',
      labelArgs: [],
    });
  }
  // Add to Queue
  playMenuItems.push({
    label: 'add_queue',
    action: () => {
      api.playMedia(items, QueueOption.ADD);
    },
    icon: 'mdi-playlist-plus',
    labelArgs: [],
  });

  return playMenuItems;
};

export const getContextMenuItems = function (items: MediaItem[], parentItem?: MediaItem) {
  const contextMenuItems: ContextMenuItem[] = [];
  if (items.length == 0) {
    return contextMenuItems;
  }
  const t = i18n.global;

  // show info
  if (items.length === 1 && items[0] !== parentItem && itemIsAvailable(items[0])) {
    contextMenuItems.push({
      label: 'show_info',
      labelArgs: [],
      action: () => {
        router.push({
          name: items[0].media_type,
          params: {
            itemId: items[0].item_id,
            provider: items[0].provider,
          },
          query: {
            album: 'album' in items[0] ? (items[0].album as Album)?.uri : '',
          },
        });
      },
      icon: 'mdi-information-outline',
    });
  }

  // go to artist(s)
  if (
    items.length === 1 &&
    itemIsAvailable(items[0]) &&
    'artists' in items[0] &&
    (items[0] as Track | Album).artists.length === 1
  ) {
    for (const artist of (items[0] as Track).artists) {
      contextMenuItems.push({
        label: 'goto_artist',
        labelArgs: [artist.name],
        action: () => {
          router.push({
            name: 'artist',
            params: {
              itemId: artist.item_id,
              provider: artist.provider,
            },
          });
        },
        icon: 'mdi-account-music',
      });
    }
  }
  // go to album
  if (items.length === 1 && itemIsAvailable(items[0]) && 'album' in items[0] && (items[0] as Track).album) {
    contextMenuItems.push({
      label: 'goto_album',
      labelArgs: [(items[0] as Track).album.name],
      action: () => {
        router.push({
          name: 'album',
          params: {
            itemId: (items[0] as Track).album.item_id,
            provider: (items[0] as Track).album.provider,
          },
        });
      },
      icon: 'mdi-album',
    });
  }

  // refresh item
  if (items.length === 1 && (items[0] == parentItem || !itemIsAvailable(items[0]))) {
    contextMenuItems.push({
      label: 'refresh_item',
      labelArgs: [],
      action: async () => {
        await api.refreshItem(items[0]);
        router.go(0);
      },
      icon: 'mdi-refresh',
    });
  }
  // add to library
  if (items[0].provider != 'library' && itemIsAvailable(items[0])) {
    contextMenuItems.push({
      label: 'add_library',
      labelArgs: [],
      action: () => {
        for (const item of items) api.addItemToLibrary(item);
      },
      icon: 'mdi-bookshelf',
    });
  }
  // remove from library
  if (items[0].provider == 'library') {
    contextMenuItems.push({
      label: 'remove_library',
      labelArgs: [],
      action: () => {
        if (!confirm(t('confirm_library_remove'))) return;
        for (const item of items) api.removeItemFromLibrary(item.media_type, item.item_id);
        if (items[0].item_id == parentItem?.item_id) router.go(-1);
        else router.go(0);
      },
      icon: 'mdi-bookshelf',
    });
  }
  // add to favorites
  if (!items[0].favorite) {
    contextMenuItems.push({
      label: 'favorites_add',
      labelArgs: [],
      action: () => {
        for (const item of items) {
          api.addItemToFavorites(item);
          item.favorite = true;
        }
      },
      icon: 'mdi-heart-outline',
    });
  }
  // remove from favorites
  if (items[0].favorite) {
    contextMenuItems.push({
      label: 'favorites_remove',
      labelArgs: [],
      action: () => {
        for (const item of items) {
          api.removeItemFromFavorites(item.media_type, item.item_id);
          item.favorite = false;
        }
      },
      icon: 'mdi-heart',
    });
  }
  // remove from playlist (playlist tracks only)
  if (parentItem && parentItem.media_type === MediaType.PLAYLIST) {
    const playlist = parentItem as Playlist;
    if (items[0].media_type === MediaType.TRACK && playlist.is_editable) {
      contextMenuItems.push({
        label: 'remove_playlist',
        labelArgs: [],
        action: () => {
          api.removePlaylistTracks(
            playlist.item_id,
            items.map((x) => (x as Track).position as number),
          );
        },
        icon: 'mdi-minus-circle-outline',
      });
    }
  }
  // add to playlist action (tracks only)
  if (items[0].media_type === 'track') {
    contextMenuItems.push({
      label: 'add_playlist',
      labelArgs: [],
      action: () => {
        eventbus.emit('playlistdialog', {
          items: items,
          parentItem: parentItem,
        });
      },
      icon: 'mdi-plus-circle-outline',
    });
  }
  return contextMenuItems;
};
