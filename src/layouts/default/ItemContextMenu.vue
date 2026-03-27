<!--
  Global contextmenu for a (media) item.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <!-- Main menu scrim -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show && !store.showPlayersMenu"
        class="context-menu-scrim"
        @click="closeMenu"
      />
    </Transition>
    <Transition name="fade">
      <div
        v-if="show"
        class="context-menu"
        :style="menuStyle"
      >
        <div class="context-menu-card">
          <!-- play menu header -->
          <div v-if="showPlayMenuHeader" class="menurow">
            <button
              class="context-menu-item"
              @click.stop="playMenuHeaderClicked"
            >
              <span class="context-menu-item-icon">
                <component
                  :is="typeof playerIcon === 'string' ? resolveIconHelper(playerIcon) : playerIcon"
                  v-if="playerIcon"
                  class="w-5 h-5"
                />
                <Speaker v-else class="w-10 h-10 -ml-2" />
              </span>
              <span class="context-menu-item-content">
                <span class="context-menu-item-title">{{ $t('play_on') }}</span>
                <span class="context-menu-item-subtitle">{{ store.activePlayer?.name || $t('no_player') }}</span>
              </span>
              <ChevronRight class="h-4 w-4 ml-auto opacity-50" />
            </button>
          </div>
          <Separator
            v-if="showPlayMenuHeader"
            class="my-1"
          />
          <div
            v-for="menuItem of items.filter((x) => !x.hide)"
            :key="menuItem.label"
            class="menurow"
            :class="{ 'menu-item-error': menuItem.color === 'error' }"
          >
            <button
              class="context-menu-item"
              :disabled="menuItem.disabled == true"
              @click.stop="(e) => menuItemClicked(e, menuItem)"
            >
              <span class="context-menu-item-icon">
                <component
                  :is="typeof menuItem.icon === 'string' ? resolveIconHelper(menuItem.icon) : menuItem.icon"
                  v-if="menuItem.icon"
                  class="w-5 h-5"
                />
              </span>
              <span class="context-menu-item-title">{{ $t(menuItem.label, menuItem.labelArgs || []) }}</span>
              <Check
                v-if="menuItem.selected"
                class="h-4 w-4 ml-auto"
              />
              <ChevronRight
                v-else-if="menuItem.subItems?.length"
                class="h-4 w-4 ml-auto opacity-50"
              />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  <!-- submenu -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showSubmenu"
        class="context-menu-scrim"
        @click="showSubmenu = false"
      />
    </Transition>
    <Transition name="fade">
      <div
        v-if="showSubmenu"
        class="context-menu"
        :style="subMenuStyle"
      >
        <div class="context-menu-card" style="min-width: 260px">
          <div
            v-for="subMenuItem of subMenuItems.filter((x) => !x.hide)"
            :key="subMenuItem.label"
            class="menurow"
            :class="{ 'menu-item-error': subMenuItem.color === 'error' }"
          >
            <button
              class="context-menu-item"
              :disabled="subMenuItem.disabled == true"
              @click.stop="(e) => menuItemClicked(e, subMenuItem)"
            >
              <span class="context-menu-item-icon">
                <component
                  :is="typeof subMenuItem.icon === 'string' ? resolveIconHelper(subMenuItem.icon) : subMenuItem.icon"
                  v-if="subMenuItem.icon"
                  class="w-5 h-5"
                />
              </span>
              <span class="context-menu-item-title">{{ $t(subMenuItem.label, subMenuItem.labelArgs || []) }}</span>
              <Check
                v-if="subMenuItem.selected"
                class="h-4 w-4 ml-auto"
              />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { resolveIcon as resolveIconHelper } from "@/helpers/iconMapping";
import api from "@/plugins/api";
import { ContextMenuDialogEvent, eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check, ChevronRight, Speaker } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const show = ref<boolean>(false);
const items = ref<ContextMenuItem[]>([]);
const posX = ref(0);
const posY = ref(0);
const showPlayMenuHeader = ref<boolean>(false);

const showSubmenu = ref<boolean>(false);
const subMenuItems = ref<ContextMenuItem[]>([]);
const subMenuPosX = ref(0);
const subMenuPosY = ref(0);

const playerIcon = computed(() => {
  return store.activePlayer ? store.activePlayer.icon : undefined;
});

/** Clamp a menu position so the menu stays within the viewport. */
const clampToViewport = (
  x: number,
  y: number,
  menuWidth = 300,
  menuHeight = 450,
) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  return {
    left: Math.min(x, vw - menuWidth - pad) < pad ? pad : Math.min(x, vw - menuWidth - pad),
    top: Math.min(y, vh - menuHeight - pad) < pad ? pad : Math.min(y, vh - menuHeight - pad),
  };
};

const menuStyle = computed(() => {
  const { left, top } = clampToViewport(posX.value, posY.value);
  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

const subMenuStyle = computed(() => {
  const { left, top } = clampToViewport(subMenuPosX.value, subMenuPosY.value);
  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

const closeMenu = () => {
  show.value = false;
  store.dialogActive = false;
};

onMounted(() => {
  eventbus.on("contextmenu", async (evt: ContextMenuDialogEvent) => {
    items.value = evt.items;
    posX.value = evt.posX || 0;
    posY.value = evt.posY || 0;
    showPlayMenuHeader.value = evt.showPlayMenuHeader || false;
    nextTick(() => {
      show.value = true;
      store.dialogActive = true;
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
    ((subMenuPosX.value = (evt as PointerEvent).clientX),
      (subMenuPosY.value = (evt as PointerEvent).clientY),
      (showSubmenu.value = true));
    return;
  } else if (menuItem.action) {
    menuItem.action();
    // Toggle selected state for multi-select menus (optimistic update)
    if (menuItem.close_on_click === false) {
      menuItem.selected = !menuItem.selected;
      // Trigger reactivity by reassigning the array
      items.value = [...items.value];
    }
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
    .sort((a, b) => (a.name.toUpperCase() > b.name?.toUpperCase() ? 1 : -1));

  for (const player of sortedPlayers) {
    _subItems.push({
      label: player.name,
      action: () => {
        evt.preventDefault();
        store.activePlayerId = player.player_id;
      },
      icon: player.icon,
      selected: store.activePlayerId == player.player_id,
      close_on_click: false,
    });
  }

  subMenuItems.value = _subItems;
  ((subMenuPosX.value = (evt as PointerEvent).clientX),
    (subMenuPosY.value = (evt as PointerEvent).clientY),
    (showSubmenu.value = true));
};
</script>

<script lang="ts">
// Helpers and utilities for Contextmenu items

import router from "@/plugins/router";

import { playerVisible } from "@/helpers/utils";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  Album,
  BrowseFolder,
  EventType,
  MediaItemType,
  MediaItemTypeOrItemMapping,
  MediaType,
  Playlist,
  PodcastEpisode,
  ProviderFeature,
  ProviderMapping,
  QueueOption,
  Track,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";

import type { Component } from "vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";

export interface ContextMenuItem {
  label: string;
  labelArgs?: Array<string | number>;
  action?: () => void;
  icon?: string | Component;
  disabled?: boolean;
  hide?: boolean;
  selected?: boolean;
  subItems?: ContextMenuItem[];
  close_on_click?: boolean;
  color?: string;
}

export const showContextMenuForMediaItem = async function (
  item: MediaItemTypeOrItemMapping | MediaItemTypeOrItemMapping[],
  parentItem?: MediaItemType,
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

  const contextMenuItems = await getContextMenuItems(mediaItems, parentItem);

  let menuItems: ContextMenuItem[] = [];

  if (
    includePlayMenuItems &&
    mediaItems[0].is_playable &&
    itemIsAvailable(mediaItems[0])
  ) {
    // Play menu items first, then context items
    menuItems = await getPlaybackContextMenuItems(mediaItems, parentItem);
    menuItems.push(...contextMenuItems);
  } else {
    // No play items - just show context menu items directly
    menuItems = contextMenuItems;
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

export const showPlayMenuForMediaItem = async function (
  item: MediaItemTypeOrItemMapping | MediaItemTypeOrItemMapping[],
  parentItem?: MediaItemType,
  posX = 0,
  posY = 0,
) {
  // open the play menu by emitting the event

  const mediaItems: MediaItemTypeOrItemMapping[] = Array.isArray(item)
    ? item
    : [item];
  if (mediaItems.length == 0) return;
  const playableItems = mediaItems.filter((x) => x.is_playable);
  const firstItem = playableItems[0];

  let playMenuItems: ContextMenuItem[] = [];
  const defaultEnqueueOption = (await api.getCoreConfigValue(
    "player_queues",
    `default_enqueue_option_${firstItem.media_type}`,
  )) as QueueOption;
  // Start Radio
  if (radioModeSupported(firstItem)) {
    playMenuItems.push({
      label: "play_radio",
      action: () => {
        api.playMedia(
          playableItems.map((x) => x.uri),
          QueueOption.REPLACE,
          true,
        );
      },
      icon: "mdi-radio-tower",
      labelArgs: [],
      disabled: !store.activePlayer,
    });
  }
  for (const option of [
    QueueOption.PLAY,
    QueueOption.NEXT,
    QueueOption.ADD,
    QueueOption.REPLACE,
    QueueOption.REPLACE_NEXT,
  ]) {
    playMenuItems.push({
      label: $t(`queue_option.${option}`),
      action: () => {
        api.playMedia(
          playableItems.map((x) => x.uri),
          option,
        );
      },
      icon: queueOptionIconMap[option],
      labelArgs: [],
      disabled: !store.activePlayer,
      selected: option === defaultEnqueueOption,
    });
  }

  if (playMenuItems.length == 0) playMenuItems = [];

  eventbus.emit("contextmenu", {
    items: playMenuItems,
    posX: posX,
    posY: posY,
    showPlayMenuHeader: true,
  });
};

export const getContextMenuItems = async function (
  items: MediaItemTypeOrItemMapping[],
  parentItem?: MediaItemType,
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
      MediaType.GENRE,
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
      MediaType.GENRE,
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
      MediaType.GENRE,
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
        // Clear the multi-select after action
        eventbus.emit("clearSelection");
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
        // Clear the multi-select after action
        eventbus.emit("clearSelection");
      },
      icon: "mdi-bookshelf",
    });
  }
  // Favorites handling - supports mixed states like played/unplayed
  if (items.length > 0 && items.every((item) => "favorite" in item)) {
    const favoritableItems = items.filter(
      (item) =>
        [
          MediaType.ALBUM,
          MediaType.ARTIST,
          MediaType.AUDIOBOOK,
          MediaType.GENRE,
          MediaType.PLAYLIST,
          MediaType.PODCAST,
          MediaType.RADIO,
          MediaType.TRACK,
        ].includes(item.media_type) && itemIsAvailable(item),
    );

    if (favoritableItems.length > 0) {
      const allFavorited = favoritableItems.every((item) => item.favorite);
      const allNotFavorited = favoritableItems.every((item) => !item.favorite);

      // If all items are favorited, show "remove from favorites"
      if (allFavorited) {
        contextMenuItems.push({
          label: "favorites_remove",
          labelArgs: [],
          action: () => {
            for (const item of favoritableItems) {
              api.removeItemFromFavorites(item.media_type, item.item_id);
            }
            // Clear the multi-select after action
            eventbus.emit("clearSelection");
          },
          icon: "mdi-heart",
        });
      }
      // If all items are not favorited, show "add to favorites"
      else if (allNotFavorited) {
        contextMenuItems.push({
          label: "favorites_add",
          labelArgs: [],
          action: () => {
            for (const item of favoritableItems) {
              api.addItemToFavorites(item);
            }
            // Clear the multi-select after action
            eventbus.emit("clearSelection");
          },
          icon: "mdi-heart-outline",
        });
      }
      // If mixed state, show both options
      else {
        contextMenuItems.push({
          label: "favorites_add",
          labelArgs: [],
          action: () => {
            for (const item of favoritableItems.filter(
              (item) => !item.favorite,
            )) {
              api.addItemToFavorites(item);
            }
            // Clear the multi-select after action
            eventbus.emit("clearSelection");
          },
          icon: "mdi-heart-outline",
        });

        contextMenuItems.push({
          label: "favorites_remove",
          labelArgs: [],
          action: () => {
            for (const item of favoritableItems.filter(
              (item) => item.favorite,
            )) {
              api.removeItemFromFavorites(item.media_type, item.item_id);
            }
            // Clear the multi-select after action
            eventbus.emit("clearSelection");
          },
          icon: "mdi-heart",
        });
      }
    }
  }

  // remove from playlist (playlist tracks, radio, podcast, podcast episode, and audiobook items)
  if (parentItem && parentItem.media_type === MediaType.PLAYLIST) {
    const playlist = parentItem as Playlist;
    if (
      (firstItem.media_type === MediaType.TRACK ||
        firstItem.media_type === MediaType.RADIO ||
        firstItem.media_type === MediaType.PODCAST_EPISODE ||
        firstItem.media_type === MediaType.AUDIOBOOK) &&
      playlist.is_editable
    ) {
      contextMenuItems.push({
        label: "remove_playlist",
        labelArgs: [],
        action: () => {
          api.removePlaylistTracks(
            playlist.item_id,
            items.map((x) => ("position" in x ? x.position : 0) as number),
          );
        },
        icon: "mdi-minus-circle-outline",
      });
    }
  }
  // add to playlist action (tracks, albums, radios, podcasts, podcast episodes, and audiobooks)
  if (
    firstItem.media_type === MediaType.TRACK ||
    firstItem.media_type === MediaType.ALBUM ||
    firstItem.media_type === MediaType.RADIO ||
    firstItem.media_type === MediaType.PODCAST_EPISODE ||
    firstItem.media_type === MediaType.AUDIOBOOK
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
          // Emit synthetic MEDIA_ITEM_UPDATED event to trigger UI refresh
          // This ensures child components (like track listings) also refresh
          api.signalEvent({
            event: EventType.MEDIA_ITEM_UPDATED,
            object_id: updatedInfo.uri,
            data: updatedInfo,
          });
        }
      },
      icon: "mdi-refresh",
    });
  }
  // map to main item (add provider mapping)
  if (
    items.length === 1 &&
    parentItem &&
    parentItem.provider == "library" &&
    parentItem.item_id != resolvedItem.item_id &&
    parentItem.media_type == resolvedItem.media_type
  ) {
    const mapping: ProviderMapping =
      "provider_mappings" in items[0]
        ? items[0].provider_mappings[0]
        : {
            provider_instance: resolvedItem.provider,
            provider_domain:
              api.providers[resolvedItem.provider]?.domain ||
              resolvedItem.provider.split("--")[0],
            item_id: resolvedItem.item_id,
            available: true,
          };
    contextMenuItems.push({
      label: "map_provider_mapping",
      labelArgs: [],
      action: async () => {
        api.sendCommand("music/add_provider_mapping", {
          media_type: items[0].media_type,
          db_id: parentItem.item_id,
          mapping: mapping,
        });
      },
      icon: "mdi-link",
    });
  }
  // link to genre (library items only, non-genre)
  if (
    items.every(
      (i) => i.media_type !== MediaType.GENRE && i.provider === "library",
    )
  ) {
    contextMenuItems.push({
      label: "link_to_genre",
      labelArgs: [],
      action: () => {
        eventbus.emit("linkGenreDialog", {
          items: items as MediaItemType[],
        });
        eventbus.emit("clearSelection");
      },
      icon: GenreIcon,
    });
  }
  // merge genres (admin only, all items must be library genres)
  if (
    items.every(
      (i) => i.media_type === MediaType.GENRE && i.provider === "library",
    ) &&
    authManager.isAdmin()
  ) {
    contextMenuItems.push({
      label: "merge_into",
      labelArgs: [],
      action: () => {
        eventbus.emit("mergeGenreDialog", {
          genreIds: items.map((i) => i.item_id),
          genreNames: items.map((i) => i.name),
        });
        eventbus.emit("clearSelection");
      },
      icon: "mdi-merge",
    });
  }
  // delete genre(s) (admin only, all items must be library genres)
  if (
    items.every(
      (i) => i.media_type === MediaType.GENRE && i.provider === "library",
    ) &&
    authManager.isAdmin()
  ) {
    contextMenuItems.push({
      label: "delete_genre",
      labelArgs: [],
      action: () => {
        eventbus.emit("deleteGenreDialog", {
          genreIds: items.map((i) => i.item_id),
          navigateBack: items.length === 1 && items[0] === parentItem,
        });
        eventbus.emit("clearSelection");
      },
      icon: "mdi-delete",
    });
  }
  return contextMenuItems;
};

/**
  Generates playback-related context menu items based on the given media items and their parent.
  This includes options like "Play now", "Enqueue", "Play radio", and "Play from here" (for playlists/albums).
*/
export const getPlaybackContextMenuItems = async function (
  items: MediaItemTypeOrItemMapping[],
  parentItem?: MediaItemType,
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
        },
        icon: "mdi-play-circle-outline",
        labelArgs: [],
        disabled: !store.activePlayer,
      });
    }
  }
  // Default/configured enqueue option at the top (if play from here is not applicable)
  else if (
    [QueueOption.PLAY, QueueOption.REPLACE].includes(defaultEnqueueOption)
  ) {
    playMenuItems.push({
      label: "play_now",
      action: () => {
        api.playMedia(
          playableItems.map((x) => x.uri),
          defaultEnqueueOption,
        );
      },
      icon: "mdi-play-circle-outline",
      labelArgs: [],
      disabled: !store.activePlayer,
    });
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
      },
      icon: "mdi-radio-tower",
      labelArgs: [],
      disabled: !store.activePlayer,
    });
  }

  // "Enqueue..." submenu with all enqueue options
  const enqueueSubItems: ContextMenuItem[] = [];
  for (const option of [
    QueueOption.PLAY,
    QueueOption.NEXT,
    QueueOption.ADD,
    QueueOption.REPLACE,
    QueueOption.REPLACE_NEXT,
  ]) {
    enqueueSubItems.push({
      label: $t(`queue_option.${option}`),
      action: () => {
        api.playMedia(
          items.map((x) => x.uri),
          option,
        );
      },
      icon: queueOptionIconMap[option],
      labelArgs: [],
      disabled: !store.activePlayer,
      selected: option === defaultEnqueueOption,
    });
  }
  playMenuItems.push({
    label: "enqueue",
    subItems: enqueueSubItems,
    icon: "mdi-playlist-music",
    labelArgs: [],
  });
  // Multi-select mark as played/unplayed for podcast episodes
  if (
    items.length > 1 &&
    items.every(
      (item) =>
        item.media_type === MediaType.PODCAST_EPISODE &&
        "fully_played" in item &&
        "resume_position_ms" in item,
    )
  ) {
    const podcastEpisodes = items as PodcastEpisode[];

    // Helper functions for clearer state detection
    const hasProgress = (item: PodcastEpisode) =>
      (item.resume_position_ms || 0) > 0;
    const isFullyPlayed = (item: PodcastEpisode) => item.fully_played;
    const isUnplayed = (item: PodcastEpisode) =>
      !item.fully_played && !hasProgress(item);

    const allFullyPlayed = podcastEpisodes.every(isFullyPlayed);
    const allUnplayed = podcastEpisodes.every(isUnplayed);

    // If all items are fully played, show "mark unplayed" option
    if (allFullyPlayed) {
      playMenuItems.push({
        label: "mark_unplayed",
        icon: "mdi-clock-fast",
        action: async () => {
          await Promise.all(
            podcastEpisodes.map(async (item: PodcastEpisode) => {
              await api.markItemUnPlayed(item);
              item.fully_played = false;
              item.resume_position_ms = 0;
            }),
          );
        },
      });
    }
    // If all items are unplayed, show "mark played" option
    else if (allUnplayed) {
      playMenuItems.push({
        label: "mark_played",
        icon: "mdi-clock-fast",
        action: async () => {
          await Promise.all(
            podcastEpisodes.map(async (item: PodcastEpisode) => {
              await api.markItemPlayed(item, true);
              item.fully_played = true;
            }),
          );
        },
      });
    }
    // If mixed state, show both options
    else {
      playMenuItems.push({
        label: "mark_played",
        icon: "mdi-clock-fast",
        action: async () => {
          await Promise.all(
            podcastEpisodes.map(async (item: PodcastEpisode) => {
              await api.markItemPlayed(item, true);
              item.fully_played = true;
            }),
          );
        },
      });

      playMenuItems.push({
        label: "mark_unplayed",
        icon: "mdi-clock-fast",
        action: async () => {
          await Promise.all(
            podcastEpisodes.map(async (item: PodcastEpisode) => {
              await api.markItemUnPlayed(item);
              item.fully_played = false;
              item.resume_position_ms = 0;
            }),
          );
        },
      });
    }
  }
  return playMenuItems;
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
.context-menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 999998;
  background: rgba(0, 0, 0, 0.3);
}

.context-menu {
  position: fixed;
  z-index: 999999;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
}

.context-menu-card {
  min-width: 300px;
  max-height: 450px;
  overflow-y: auto;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 38px -10px rgba(0, 0, 0, 0.35), 0 10px 20px -15px rgba(0, 0, 0, 0.2);
  padding: 4px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--foreground);
  font-size: 0.875rem;
  line-height: 1.25rem;
  text-align: left;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.context-menu-item:hover:not(:disabled) {
  background: var(--accent);
}

.context-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-menu-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  flex-shrink: 0;
}

.context-menu-item-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.context-menu-item-title {
  flex: 1;
}

.context-menu-item-subtitle {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.menu-item-error .context-menu-item {
  color: var(--destructive);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
