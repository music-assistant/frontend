<!--
  Global contextmenu for a (media) item.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <v-menu
    v-model="show"
    :target="[posX, posY]"
    scrim
    style="z-index: 999999"
    z-index="999999"
    @update:model-value="
      (v) => {
        store.dialogActive = v;
      }
    "
  >
    <v-card min-width="260">
      <v-list density="compact" slim tile>
        <div
          v-for="menuItem of items.filter((x) => !x.hide)"
          :key="menuItem.label"
          class="menurow"
        >
          <v-list-item
            variant="text"
            :title="$t(menuItem.label, menuItem.labelArgs || [])"
            :disabled="menuItem.disabled == true"
            :prepend-icon="menuItem.icon"
            :append-icon="menuItem.selected ? 'mdi-check' : undefined"
            @click.stop="(e) => menuItemClicked(e, menuItem)"
          />
        </div>
      </v-list>
    </v-card>
  </v-menu>
  <v-menu
    v-model="showSubmenu"
    :target="[subMenuPosX, subMenuPosY]"
    style="z-index: 999999"
    z-index="999999"
    @update:model-value="
      (v) => {
        store.dialogActive = v;
      }
    "
  >
    <v-card min-width="260">
      <v-list density="compact" slim tile>
        <div
          v-for="subMenuItem of subMenuItems.filter((x) => !x.hide)"
          :key="subMenuItem.label"
          class="menurow"
        >
          <v-list-item
            variant="text"
            :title="$t(subMenuItem.label, subMenuItem.labelArgs || [])"
            :disabled="subMenuItem.disabled == true"
            :prepend-icon="subMenuItem.icon"
            :append-icon="subMenuItem.selected ? 'mdi-check' : undefined"
            @click="(e) => menuItemClicked(e, subMenuItem)"
          />
        </div>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { ItemContextMenuDialogEvent, eventbus } from "@/plugins/eventbus";

const show = ref<boolean>(false);
const items = ref<ContextMenuItem[]>([]);
const posX = ref(0);
const posY = ref(0);

const showSubmenu = ref<boolean>(false);
const subMenuItems = ref<ContextMenuItem[]>([]);
const subMenuPosX = ref(0);
const subMenuPosY = ref(0);

onMounted(() => {
  eventbus.on("contextmenu", async (evt: ItemContextMenuDialogEvent) => {
    items.value = evt.items;
    posX.value = evt.posX || 0;
    posY.value = evt.posY || 0;
    nextTick(() => {
      show.value = true;
    });
  });
  onBeforeUnmount(() => {
    eventbus.off("contextmenu");
  });
});

const menuItemClicked = function (
  evt: MouseEvent | KeyboardEvent,
  menuItem: ContextMenuItem,
) {
  if (menuItem.subItems) {
    evt.preventDefault();
    subMenuItems.value = menuItem.subItems;
    (subMenuPosX.value = (evt as PointerEvent).clientX),
      (subMenuPosY.value = (evt as PointerEvent).clientY),
      (showSubmenu.value = true);
    return;
  } else if (menuItem.action) {
    menuItem.action();
  }
  show.value = false;
  store.dialogActive = false;
};
</script>

<script lang="ts">
// Helpers and utilities for Contextmenu items

import router from "@/plugins/router";

import {
  ProviderFeature,
  MediaItem,
  QueueOption,
  MediaType,
  Playlist,
  Album,
  Track,
  ItemMapping,
  MediaItemType,
  PodcastEpisode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { itemIsAvailable } from "@/plugins/api/helpers";

export interface ContextMenuItem {
  label: string;
  labelArgs?: Array<string | number>;
  action?: () => void;
  icon?: string;
  disabled?: boolean;
  hide?: boolean;
  selected?: boolean;
  subItems?: ContextMenuItem[];
}

export const showContextMenuForMediaItem = async function (
  item: MediaItemType | MediaItemType[],
  parentItem?: MediaItem,
  posX = 0,
  posY = 0,
  includePlayItems = true,
) {
  // show ContextMenu for given MediaItem(s)
  const mediaItems: MediaItemType[] = Array.isArray(item) ? item : [item];
  if (mediaItems.length == 0) return;

  const menuItems: ContextMenuItem[] = [];

  if (includePlayItems) {
    menuItems.push(...getPlayMenuItems(mediaItems, parentItem));
  }

  // collect all contextMenuItems
  menuItems.push(...getContextMenuItems(mediaItems, parentItem));

  // open the contextmenu by emitting the event
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: posX,
    posY: posY,
  });
};

export const getPlayMenuItems = function (
  items: Array<MediaItemType | ItemMapping>,
  parentItem?: MediaItem,
) {
  const playMenuItems: ContextMenuItem[] = [];
  if (items.length == 0 || !itemIsAvailable(items[0])) {
    return playMenuItems;
  }
  if (!store.activePlayer) return playMenuItems;
  if (items[0].media_type == MediaType.FOLDER) return playMenuItems;

  // Play from here...
  if (items.length == 1 && parentItem && parentItem.uri != items[0].uri) {
    // Play from here (playlist track)
    if (parentItem.media_type == MediaType.PLAYLIST) {
      playMenuItems.push({
        label: "play_playlist_from",
        action: () => {
          api.playMedia(parentItem.uri, undefined, false, items[0].item_id);
        },
        icon: "mdi-play-circle-outline",
        labelArgs: [],
        disabled: !store.activePlayer,
      });
    }
    // Play from here (album track)
    if (parentItem.media_type == MediaType.ALBUM) {
      playMenuItems.push({
        label: "play_album_from",
        action: () => {
          api.playMedia(parentItem.uri, undefined, false, items[0].item_id);
        },
        icon: "mdi-play-circle-outline",
        labelArgs: [],
        disabled: !store.activePlayer,
      });
    }
    // Play from here (podcast episode)
    if (parentItem.media_type == MediaType.PODCAST) {
      playMenuItems.push({
        label: "play_from_here",
        action: () => {
          api.playMedia(parentItem.uri, undefined, false, items[0].item_id);
        },
        icon: "mdi-play-circle-outline",
        labelArgs: [],
        disabled: !store.activePlayer,
      });
    }
  }

  // replace now
  playMenuItems.push({
    label: "play_replace",
    action: () => {
      api.playMedia(
        items.map((x) => x.uri),
        QueueOption.REPLACE,
      );
    },
    icon: "mdi-play-circle-outline",
    labelArgs: [],
    disabled: !store.activePlayer,
  });

  // Play NOW
  playMenuItems.push({
    label: "play_now",
    action: () => {
      api.playMedia(
        items.map((x) => x.uri),
        QueueOption.PLAY,
      );
    },
    icon: "mdi-play-circle-outline",
    labelArgs: [],
    disabled: !store.activePlayer,
  });

  // Play NEXT
  if (items.length === 1 || items[0].media_type === MediaType.TRACK) {
    playMenuItems.push({
      label: "play_next",
      action: () => {
        api.playMedia(
          items.map((x) => x.uri),
          QueueOption.NEXT,
        );
      },
      icon: "mdi-skip-next-circle-outline",
      labelArgs: [],
      disabled: !store.activePlayer,
    });
  }
  // Add to Queue
  playMenuItems.push({
    label: "add_queue",
    action: () => {
      api.playMedia(
        items.map((x) => x.uri),
        QueueOption.ADD,
      );
    },
    icon: "mdi-playlist-plus",
    labelArgs: [],
    disabled: !store.activePlayer,
  });

  // Start Radio
  if (radioModeSupported(items[0])) {
    playMenuItems.push({
      label: "play_radio",
      action: () => {
        api.playMedia(
          items.map((x) => x.uri),
          undefined,
          true,
        );
      },
      icon: "mdi-radio-tower",
      labelArgs: [],
      disabled: !store.activePlayer,
    });
  }

  return playMenuItems;
};

export const getContextMenuItems = function (
  items: Array<MediaItemType | ItemMapping>,
  parentItem?: MediaItem,
) {
  const contextMenuItems: ContextMenuItem[] = [];
  if (items.length == 0) {
    return contextMenuItems;
  }
  if (items[0].media_type == MediaType.FOLDER) return contextMenuItems;
  // show info
  if (
    items.length === 1 &&
    items[0] !== parentItem &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
    ].includes(items[0].media_type) &&
    itemIsAvailable(items[0])
  ) {
    contextMenuItems.push({
      label: "show_info",
      labelArgs: [],
      action: () => {
        router.push({
          name: items[0].media_type,
          params: {
            itemId: items[0].item_id,
            provider: items[0].provider,
          },
          query: {
            album: "album" in items[0] ? (items[0].album as Album)?.uri : "",
          },
        });
      },
      icon: "mdi-information-outline",
    });
  }

  // go to artist(s)
  if (
    items.length === 1 &&
    itemIsAvailable(items[0]) &&
    "artists" in items[0] &&
    (items[0] as Track | Album).artists.length === 1
  ) {
    for (const artist of (items[0] as Track).artists) {
      contextMenuItems.push({
        label: "goto_artist",
        labelArgs: [artist.name],
        action: () => {
          router.push({
            name: "artist",
            params: {
              itemId: artist.item_id,
              provider: artist.provider,
            },
          });
        },
        icon: "mdi-account-music",
      });
    }
  }
  // go to album
  if (
    items.length === 1 &&
    itemIsAvailable(items[0]) &&
    "album" in items[0] &&
    (items[0] as Track).album
  ) {
    contextMenuItems.push({
      label: "goto_album",
      labelArgs: [(items[0] as Track).album.name],
      action: () => {
        router.push({
          name: "album",
          params: {
            itemId: (items[0] as Track).album.item_id,
            provider: (items[0] as Track).album.provider,
          },
        });
      },
      icon: "mdi-album",
    });
  }

  // add to library
  if (
    items[0].provider != "library" &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
    ].includes(items[0].media_type) &&
    itemIsAvailable(items[0])
  ) {
    contextMenuItems.push({
      label: "add_library",
      labelArgs: [],
      action: () => {
        for (const item of items) api.addItemToLibrary(item);
      },
      icon: "mdi-bookshelf",
    });
  }
  // remove from library
  if (
    items[0].provider == "library" &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
    ].includes(items[0].media_type)
  ) {
    contextMenuItems.push({
      label: "remove_library",
      labelArgs: [],
      action: () => {
        if (!confirm($t("confirm_library_remove"))) return;
        for (const item of items)
          api.removeItemFromLibrary(item.media_type, item.item_id);
        if (items[0].item_id == parentItem?.item_id) router.go(-1);
        else window.location.reload();
      },
      icon: "mdi-bookshelf",
    });
  }
  // add to favorites
  if (
    "favorite" in items[0] &&
    !items[0].favorite &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
    ].includes(items[0].media_type)
  ) {
    contextMenuItems.push({
      label: "favorites_add",
      labelArgs: [],
      action: () => {
        for (const item of items) {
          api.addItemToFavorites(item);
        }
      },
      icon: "mdi-heart-outline",
    });
  }
  // remove from favorites
  if (
    "favorite" in items[0] &&
    items[0].favorite &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
    ].includes(items[0].media_type)
  ) {
    contextMenuItems.push({
      label: "favorites_remove",
      labelArgs: [],
      action: () => {
        for (const item of items) {
          api.removeItemFromFavorites(item.media_type, item.item_id);
          (item as MediaItemType).favorite = false;
        }
      },
      icon: "mdi-heart",
    });
  }
  // remove from playlist (playlist tracks only)
  if (parentItem && parentItem.media_type === MediaType.PLAYLIST) {
    const playlist = parentItem as Playlist;
    if (items[0].media_type === MediaType.TRACK && playlist.is_editable) {
      contextMenuItems.push({
        label: "remove_playlist",
        labelArgs: [],
        action: () => {
          api.removePlaylistTracks(
            playlist.item_id,
            items.map((x) => (x as Track).position as number),
          );
        },
        icon: "mdi-minus-circle-outline",
      });
    }
  }
  // add to playlist action (tracks only)
  if (
    (items[0].media_type === MediaType.TRACK ||
      items[0].media_type === MediaType.ALBUM) &&
    "provider_mappings" in items[0]
  ) {
    contextMenuItems.push({
      label: "add_playlist",
      labelArgs: [],
      action: () => {
        eventbus.emit("playlistdialog", {
          items: items as MediaItemType[],
          parentItem: parentItem,
        });
      },
      icon: "mdi-plus-circle-outline",
    });
  }

  if (items.length === 1 && "fully_played" in items[0]) {
    // mark unplayed
    if (items[0].fully_played || items[0].resume_position_ms > 0) {
      contextMenuItems.push({
        label: "mark_unplayed",
        icon: "mdi-clock-fast",
        action: async () => {
          await api.markItemUnPlayed(
            items[0].media_type,
            items[0].item_id,
            items[0].provider,
          );
          (items[0] as PodcastEpisode).fully_played = false;
        },
      });
    } else {
      // mark played
      contextMenuItems.push({
        label: "mark_played",
        icon: "mdi-clock-fast",
        action: async () => {
          await api.markItemPlayed(
            items[0].media_type,
            items[0].item_id,
            items[0].provider,
            true,
          );
          (items[0] as PodcastEpisode).fully_played = true;
        },
      });
    }
  }

  // update metadata
  if (items.length === 1 && items[0] == parentItem) {
    contextMenuItems.push({
      label: "update_metadata",
      labelArgs: [],
      action: async () => {
        const updatedInfo = await api.updateMetadata(items[0], true);
        if (updatedInfo) {
          Object.assign(items[0], updatedInfo);
        }
      },
      icon: "mdi-image-album",
    });
  }
  // refresh item
  if (
    items.length === 1 &&
    (items[0] == parentItem || !itemIsAvailable(items[0]))
  ) {
    contextMenuItems.push({
      label: "refresh_item",
      labelArgs: [],
      action: async () => {
        const updatedInfo = await api.refreshItem(items[0]);
        if (updatedInfo) {
          Object.assign(items[0], updatedInfo);
        }
      },
      icon: "mdi-refresh",
    });
  }
  return contextMenuItems;
};

const radioModeSupported = function (item: MediaItemType | ItemMapping) {
  if ("provider_mappings" in item) {
    for (const provId of item.provider_mappings) {
      if (
        api.providers[provId.provider_instance]?.supported_features.includes(
          ProviderFeature.SIMILAR_TRACKS,
        )
      )
        return true;
    }
  } else if (
    api.providers[item.provider]?.supported_features.includes(
      ProviderFeature.SIMILAR_TRACKS,
    )
  ) {
    return true;
  }
  // we also support a generic radio mode if we have ANY provider with similar track feature
  // and the track is (matched) in the library
  if (item.provider == "library") {
    for (const prov of Object.values(api.providers)) {
      if (prov.supported_features.includes(ProviderFeature.SIMILAR_TRACKS))
        return true;
    }
  }

  return false;
};
</script>

<style scoped>
.menurow :deep(.v-list-item__prepend) {
  width: 45px;
  margin-left: -5px;
}

.menurow :deep(.v-expansion-panel-title) {
  padding: 0;
  padding-right: 10px;
  min-height: 40px !important;
  height: 40px !important;
}

.menurow :deep(.v-expansion-panel-title--active) {
  height: 40px !important;
}

.menurow :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
</style>
