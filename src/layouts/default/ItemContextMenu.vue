<!--
  Global contextmenu for a (media) item.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <v-menu
    v-model="show"
    :target="[posX, posY]"
    :scrim="!store.showPlayersMenu"
    style="z-index: 999999"
    z-index="999999"
    @update:model-value="
      (v) => {
        store.dialogActive = v;
      }
    "
  >
    <v-card min-width="300">
      <v-list density="compact" slim tile>
        <!-- play menu header -->
        <v-list-item
          v-if="showPlayMenuHeader"
          link
          append-icon="mdi-chevron-right"
          @click.stop="playMenuHeaderClicked"
        >
          <template #prepend>
            <div
              class="icon-thumb"
              style="
                margin-left: -8px;
                width: 50px;
                height: 50px;
                margin-right: 0px;
              "
            >
              <v-icon
                size="35"
                :icon="
                  store.activePlayer ? store.activePlayer.icon : 'mdi-speaker'
                "
                style="display: table-cell; opacity: 0.8"
              />
            </div>
          </template>
          <template #title>
            <v-list-item
              :title="$t('play_on')"
              density="compact"
              :subtitle="store.activePlayer?.display_name || $t('no_player')"
            />
          </template>
        </v-list-item>
        <v-divider
          v-if="showPlayMenuHeader"
          style="margin-top: 5px; margin-bottom: 5px"
        />
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
            border="bottom"
            :append-icon="
              menuItem.selected
                ? 'mdi-check'
                : menuItem.subItems?.length
                  ? 'mdi-chevron-right'
                  : undefined
            "
            style="padding-left: 25px"
            @click.stop="(e) => menuItemClicked(e, menuItem)"
          />
        </div>
      </v-list>
    </v-card>
  </v-menu>
  <!-- submenu -->
  <v-menu
    v-model="showSubmenu"
    :target="[subMenuPosX, subMenuPosY]"
    style="z-index: 999999"
    z-index="999999"
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
            @click.stop="(e) => menuItemClicked(e, subMenuItem)"
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
import { ContextMenuDialogEvent, eventbus } from "@/plugins/eventbus";

const show = ref<boolean>(false);
const items = ref<ContextMenuItem[]>([]);
const posX = ref(0);
const posY = ref(0);
const showPlayMenuHeader = ref<boolean>(false);

const showSubmenu = ref<boolean>(false);
const subMenuItems = ref<ContextMenuItem[]>([]);
const subMenuPosX = ref(0);
const subMenuPosY = ref(0);
onMounted(() => {
  eventbus.on("contextmenu", async (evt: ContextMenuDialogEvent) => {
    items.value = evt.items;
    posX.value = evt.posX || 0;
    posY.value = evt.posY || 0;
    showPlayMenuHeader.value = evt.showPlayMenuHeader || false;
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
  if (showSubmenu.value) {
    showSubmenu.value = false;
    if (menuItem.close_on_click == false) {
      return;
    }
  }
  if (menuItem.close_on_click == false) {
    return;
  }
  show.value = false;
  store.dialogActive = false;
};

const playMenuHeaderClicked = function (evt: MouseEvent | KeyboardEvent) {
  evt.preventDefault();
  const _subItems: ContextMenuItem[] = [];

  const sortedPlayers = Object.values(api.players)
    .filter((x) => playerVisible(x))
    .sort((a, b) =>
      a.display_name.toUpperCase() > b.display_name?.toUpperCase() ? 1 : -1,
    );

  for (const player of sortedPlayers) {
    _subItems.push({
      label: player.display_name,
      action: () => {
        evt.preventDefault();
        store.activePlayerId = player.player_id;
        store.playMenuShown = true;
      },
      icon: player.icon,
      selected: store.activePlayerId == player.player_id,
      close_on_click: false,
    });
  }

  subMenuItems.value = _subItems;
  (subMenuPosX.value = (evt as PointerEvent).clientX),
    (subMenuPosY.value = (evt as PointerEvent).clientY),
    (showSubmenu.value = true);
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
  MediaItemType,
  PodcastEpisode,
  MediaItemTypeOrItemMapping,
  BrowseFolder,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { itemIsAvailable } from "@/plugins/api/helpers";
import { playerVisible } from "@/helpers/utils";

export interface ContextMenuItem {
  label: string;
  labelArgs?: Array<string | number>;
  action?: () => void;
  icon?: string;
  disabled?: boolean;
  hide?: boolean;
  selected?: boolean;
  subItems?: ContextMenuItem[];
  close_on_click?: boolean;
}

export const showContextMenuForMediaItem = async function (
  item: MediaItemTypeOrItemMapping | MediaItemTypeOrItemMapping[],
  parentItem?: MediaItem,
  posX = 0,
  posY = 0,
  includePlayMenuItems = false,
  showPlayMenuHeader = false,
) {
  // show ContextMenu for given MediaItem(s)
  const mediaItems: MediaItemTypeOrItemMapping[] = Array.isArray(item)
    ? item
    : [item];

  // return early if we dont have any items
  if (mediaItems.length == 0) return;

  if (
    mediaItems[0].media_type == MediaType.FOLDER &&
    mediaItems[0].name == ".."
  ) {
    return;
  }

  const menuItems = await getContextMenuItems(mediaItems, parentItem);
  if (
    includePlayMenuItems &&
    mediaItems[0].is_playable &&
    itemIsAvailable(mediaItems[0])
  ) {
    menuItems.push(...(await getPlayMenuItems(mediaItems, parentItem)));
  }

  if (menuItems.length == 0) return;

  // open the contextmenu by emitting the event
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: posX,
    posY: posY,
    showPlayMenuHeader: showPlayMenuHeader,
  });
};

const queueOptionIconMap = {
  [QueueOption.NEXT]: "mdi-skip-next-circle-outline",
  [QueueOption.ADD]: "mdi-playlist-plus",
  [QueueOption.REPLACE]: "mdi-play-circle-outline",
  [QueueOption.REPLACE_NEXT]: "mdi-skip-next-circle-outline",
  [QueueOption.PLAY]: "mdi-play-circle-outline",
};

const queueOptionLabelMap = {
  [QueueOption.NEXT]: "play_next",
  [QueueOption.ADD]: "add_queue",
  [QueueOption.REPLACE]: "play_replace",
  [QueueOption.REPLACE_NEXT]: "play_replace_next",
  [QueueOption.PLAY]: "play_now",
};

export const showPlayMenuForMediaItem = async function (
  item: MediaItemTypeOrItemMapping | MediaItemTypeOrItemMapping[],
  parentItem?: MediaItem,
  posX = 0,
  posY = 0,
) {
  // open the play menu by emitting the event

  const mediaItems: MediaItemTypeOrItemMapping[] = Array.isArray(item)
    ? item
    : [item];
  if (mediaItems.length == 0) return;

  eventbus.emit("contextmenu", {
    items: await getPlayMenuItems(mediaItems, parentItem),
    posX: posX,
    posY: posY,
    showPlayMenuHeader: true,
  });
};

export const getPlayMenuItems = async function (
  items: MediaItemTypeOrItemMapping[],
  parentItem?: MediaItem,
) {
  const playMenuItems: ContextMenuItem[] = [];
  if (items.length == 0 || !itemIsAvailable(items[0])) {
    return playMenuItems;
  }

  const playableItems = items.filter((x) => x.is_playable);
  if (playableItems.length == 0) return playMenuItems;
  const firstItem = playableItems[0];

  const defaultEnqueueOption = (await api.getCoreConfigValue(
    "player_queues",
    `default_enqueue_option_${firstItem.media_type}`,
  )) as QueueOption;

  if (!store.activePlayer) return playMenuItems;

  // Default/configured enqueue option at the top
  playMenuItems.push({
    label: queueOptionLabelMap[defaultEnqueueOption],
    action: () => {
      api.playMedia(
        playableItems.map((x) => x.uri),
        defaultEnqueueOption,
      );
      // set flag in store that we have (at least once) shown the play menu
      store.playMenuShown = true;
    },
    icon: queueOptionIconMap[defaultEnqueueOption],
    labelArgs: [],
    disabled: !store.activePlayer,
  });

  // Play from here...
  if (
    playableItems.length == 1 &&
    parentItem &&
    parentItem.uri != firstItem.uri
  ) {
    // Play from here (playlist track)
    if (parentItem.media_type == MediaType.PLAYLIST) {
      playMenuItems.push({
        label: "play_playlist_from",
        action: () => {
          api.playMedia(
            parentItem.uri,
            undefined,
            false,
            playableItems[0].item_id,
          );
          store.playMenuShown = true;
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
          api.playMedia(parentItem.uri, undefined, false, firstItem.item_id);
          store.playMenuShown = true;
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
          api.playMedia(parentItem.uri, undefined, false, firstItem.item_id);
          store.playMenuShown = true;
        },
        icon: "mdi-play-circle-outline",
        labelArgs: [],
        disabled: !store.activePlayer,
      });
    }
  }

  // Start Radio
  if (radioModeSupported(firstItem)) {
    playMenuItems.push({
      label: "play_radio",
      action: () => {
        api.playMedia(
          items.map((x) => x.uri),
          QueueOption.REPLACE,
          true,
        );
        store.playMenuShown = true;
      },
      icon: "mdi-radio-tower",
      labelArgs: [],
      disabled: !store.activePlayer,
    });
  }

  // add all/other options as submenu
  const subItems: ContextMenuItem[] = [];
  for (const option of [
    QueueOption.PLAY,
    QueueOption.NEXT,
    QueueOption.ADD,
    QueueOption.REPLACE,
    QueueOption.REPLACE_NEXT,
  ]) {
    subItems.push({
      label: queueOptionLabelMap[option],
      action: () => {
        api.playMedia(
          items.map((x) => x.uri),
          option,
        );
        store.playMenuShown = true;
      },
      icon: queueOptionIconMap[option],
      labelArgs: [],
      disabled: !store.activePlayer,
      selected: option == defaultEnqueueOption,
    });
  }
  playMenuItems.push({
    label: "all_enqueue_options",
    subItems: subItems,
    icon: "mdi-playlist-play",
    labelArgs: [],
    disabled: !store.activePlayer,
  });

  return playMenuItems;
};

export const getContextMenuItems = async function (
  items: MediaItemTypeOrItemMapping[],
  parentItem?: MediaItem,
) {
  const contextMenuItems: ContextMenuItem[] = [];
  if (items.length == 0) {
    return contextMenuItems;
  }

  const firstItem = items[0];

  // show info
  if (
    items.length === 1 &&
    firstItem !== parentItem &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.TRACK,
    ].includes(items[0].media_type) &&
    itemIsAvailable(items[0])
  ) {
    contextMenuItems.push({
      label: "show_info",
      labelArgs: [],
      action: () => {
        router.push({
          name: firstItem.media_type,
          params: {
            itemId: firstItem.item_id,
            provider: firstItem.provider,
          },
          query: {
            album: "album" in items[0] ? (items[0].album as Album)?.uri : "",
          },
        });
      },
      icon: "mdi-information-outline",
    });
  }

  // browse folder
  if (
    items.length === 1 &&
    items[0] !== parentItem &&
    items[0].media_type == MediaType.FOLDER &&
    itemIsAvailable(items[0])
  ) {
    contextMenuItems.push({
      label: "browse",
      labelArgs: [],
      action: () => {
        router.push({
          name: "browse",
          query: {
            path: (items[0] as BrowseFolder).path,
          },
        });
      },
      icon: "mdi-folder",
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

  let resolvedItem = firstItem;
  if (
    (firstItem.provider != "library" || !("provider_mappings" in firstItem)) &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(firstItem.media_type)
  ) {
    // resolve itemmapping or non-library item
    resolvedItem =
      (await api.getLibraryItem(
        firstItem.media_type,
        firstItem.item_id,
        firstItem.provider,
      )) || firstItem;
  }

  // add to library
  if (
    resolvedItem.provider != "library" &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(resolvedItem.media_type) &&
    itemIsAvailable(resolvedItem)
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
    resolvedItem.provider == "library" &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(resolvedItem.media_type)
  ) {
    contextMenuItems.push({
      label: "remove_library",
      labelArgs: [],
      action: () => {
        if (!confirm($t("confirm_library_remove"))) return;
        for (const item of items)
          api.removeItemFromLibrary(item.media_type, item.item_id);
        if (resolvedItem.item_id == parentItem?.item_id) router.go(-1);
      },
      icon: "mdi-bookshelf",
    });
  }
  // add to favorites
  if (
    "favorite" in resolvedItem &&
    !resolvedItem.favorite &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(resolvedItem.media_type) &&
    itemIsAvailable(resolvedItem)
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
    items.length === 1 &&
    "favorite" in resolvedItem &&
    resolvedItem.favorite &&
    resolvedItem.provider == "library" &&
    [
      MediaType.ALBUM,
      MediaType.ARTIST,
      MediaType.AUDIOBOOK,
      MediaType.PLAYLIST,
      MediaType.PODCAST,
      MediaType.RADIO,
      MediaType.TRACK,
    ].includes(resolvedItem.media_type)
  ) {
    contextMenuItems.push({
      label: "favorites_remove",
      labelArgs: [],
      action: () => {
        api.removeItemFromFavorites(
          resolvedItem.media_type,
          resolvedItem.item_id,
        );
        resolvedItem.favorite = false;
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
    items[0].media_type === MediaType.TRACK ||
    items[0].media_type === MediaType.ALBUM
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

  if (
    items.length === 1 &&
    "fully_played" in items[0] &&
    "resume_position_ms" in items[0]
  ) {
    // mark unplayed
    if (items[0].fully_played || items[0].resume_position_ms) {
      contextMenuItems.push({
        label: "mark_unplayed",
        icon: "mdi-clock-fast",
        action: async () => {
          await api.markItemUnPlayed(items[0]);
          (items[0] as PodcastEpisode).fully_played = false;
        },
      });
    } else {
      // mark played
      contextMenuItems.push({
        label: "mark_played",
        icon: "mdi-clock-fast",
        action: async () => {
          await api.markItemPlayed(items[0], true);
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

const radioModeSupported = function (item: MediaItemTypeOrItemMapping) {
  if (
    ![
      MediaType.TRACK,
      MediaType.ARTIST,
      MediaType.ALBUM,
      MediaType.PLAYLIST,
    ].includes(item.media_type)
  ) {
    return;
  }
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
