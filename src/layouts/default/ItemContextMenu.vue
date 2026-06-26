<!--
  Global contextmenu for a (media) item.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <DropdownMenu
    :open="show"
    :modal="!store.showPlayersMenu"
    @update:open="onOpenChange"
  >
    <DropdownMenuContent
      :reference="reference"
      align="end"
      :side-offset="0"
      class="z-[999999] min-w-[300px] max-w-[350px] max-h-[85vh] overflow-y-auto"
    >
      <!-- play menu header -->
      <template v-if="showPlayMenuHeader">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger class="gap-3 py-2">
            <PlayerIcon :icon="store.activePlayer?.icon" :size="32" />
            <div class="flex flex-col">
              <span>{{ $t("play_on") }}</span>
              <span class="text-muted-foreground text-xs">{{
                store.activePlayer?.name || $t("no_player")
              }}</span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            align="start"
            :align-offset="-5"
            :side-offset="6"
            class="max-h-[70vh] overflow-y-auto"
          >
            <DropdownMenuItem
              v-for="player of playerSubItems"
              :key="player.label"
              @select="onSelect($event, player)"
            >
              <MenuItemIcon :icon="player.icon" />
              <span class="flex-1 truncate min-w-0">{{ player.label }}</span>
              <Check v-if="player.selected" class="ml-auto size-4" />
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
      </template>

      <template v-for="menuItem of visibleItems" :key="menuItem.label">
        <!-- item with submenu -->
        <DropdownMenuSub v-if="menuItem.subItems && menuItem.subItems.length">
          <DropdownMenuSubTrigger
            :class="[
              'gap-3',
              { 'text-destructive': menuItem.color === 'error' },
            ]"
          >
            <MenuItemIcon :icon="menuItem.icon" />
            <span class="flex-1 truncate min-w-0">{{
              $t(menuItem.label, menuItem.labelArgs || [])
            }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            align="start"
            :align-offset="-5"
            :side-offset="6"
          >
            <DropdownMenuItem
              v-for="subMenuItem of menuItem.subItems.filter((x) => !x.hide)"
              :key="subMenuItem.label"
              :disabled="subMenuItem.disabled === true"
              :variant="
                subMenuItem.color === 'error' ? 'destructive' : 'default'
              "
              @select="onSelect($event, subMenuItem)"
            >
              <MenuItemIcon :icon="subMenuItem.icon" />
              <span class="flex-1 truncate min-w-0">{{
                $t(subMenuItem.label, subMenuItem.labelArgs || [])
              }}</span>
              <Check v-if="subMenuItem.selected" class="ml-auto size-4" />
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <!-- leaf item -->
        <DropdownMenuItem
          v-else
          :disabled="menuItem.disabled === true"
          :variant="menuItem.color === 'error' ? 'destructive' : 'default'"
          @select="onSelect($event, menuItem)"
        >
          <MenuItemIcon :icon="menuItem.icon" />
          <span class="flex-1 truncate min-w-0">{{
            $t(menuItem.label, menuItem.labelArgs || [])
          }}</span>
          <Check v-if="menuItem.selected" class="ml-auto size-4" />
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { getLucideIcon } from "@/helpers/icon";
import api from "@/plugins/api";
import { ContextMenuDialogEvent, eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check } from "@lucide/vue";
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { VIcon } from "vuetify/components";

const show = ref<boolean>(false);
const items = ref<ContextMenuItem[]>([]);
const posX = ref(0);
const posY = ref(0);
const showPlayMenuHeader = ref<boolean>(false);

const visibleItems = computed(() => items.value.filter((x) => !x.hide));

const reference = computed(() => ({
  getBoundingClientRect: () => new DOMRect(posX.value, posY.value, 0, 0),
}));

const MenuItemIcon = (props: { icon?: string | Component; size?: number }) => {
  if (!props.icon) return null;
  return typeof props.icon === "string"
    ? h(VIcon, {
        icon: props.icon,
        size: props.size ?? 20,
        class: "shrink-0",
      })
    : h(props.icon, { class: "size-4 shrink-0" });
};

const playerSubItems = computed<ContextMenuItem[]>(() => {
  const sortedPlayers = Object.values(api.players)
    .filter((x) => playerVisible(x))
    .sort((a, b) => (a.name.toUpperCase() > b.name?.toUpperCase() ? 1 : -1));
  return sortedPlayers.map((player) => ({
    label: player.name,
    action: () => {
      store.activePlayerId = player.player_id;
    },
    icon: getLucideIcon(player.icon) ?? player.icon,
    selected: store.activePlayerId == player.player_id,
    close_on_click: false,
  }));
});

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

const onOpenChange = function (value: boolean) {
  show.value = value;
  store.dialogActive = value;
};

const onSelect = function (evt: Event, menuItem: ContextMenuItem) {
  if (menuItem.action) {
    menuItem.action();
  }
  // Keep the menu open for multi-select style items (optimistic update).
  if (menuItem.close_on_click === false) {
    evt.preventDefault();
    menuItem.selected = !menuItem.selected;
    // Trigger reactivity by reassigning the array
    items.value = [...items.value];
  }
};
</script>

<script lang="ts">
// Helpers and utilities for Contextmenu items

import router from "@/plugins/router";

import {
  getShortcutMoveAvailability,
  isShortcutCapReached,
  isShortcutMediaType,
  isShortcutPinnedItem,
  moveShortcutStandaloneItem,
  pinShortcutStandalone,
  unpinShortcutStandaloneItem,
} from "@/composables/useShortcuts";
import { radioModeSupported } from "@/helpers/radio";
import { playerVisible } from "@/helpers/utils";
import { isItemInLibrary, itemIsAvailable } from "@/plugins/api/helpers";
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
  Radio,
  Track,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";

import GenreIcon from "@/components/icons/GenreIcon.vue";
import {
  ArrowDown,
  ArrowUp,
  Disc3,
  Download,
  Folder,
  Heart,
  History,
  Image,
  Info,
  LibraryBig,
  Link,
  ListMusic,
  ListPlus,
  Merge,
  MicVocal,
  MinusCircle,
  Pencil,
  Pin,
  PinOff,
  PlayCircle,
  PlusCircle,
  RadioTower,
  RefreshCw,
  SkipForward,
  Trash2,
} from "@lucide/vue";
import type { Component } from "vue";

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
  sortBy?: string,
  options?: ContextMenuOptions,
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

  const contextMenuItems = await getContextMenuItems(
    mediaItems,
    parentItem,
    options,
  );

  let menuItems: ContextMenuItem[] = [];

  if (
    includePlayMenuItems &&
    mediaItems[0].is_playable &&
    itemIsAvailable(mediaItems[0])
  ) {
    // Play menu items first, then context items
    menuItems = await getPlaybackContextMenuItems(
      mediaItems,
      parentItem,
      sortBy,
    );
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
  [QueueOption.NEXT]: SkipForward,
  [QueueOption.ADD]: ListPlus,
  [QueueOption.REPLACE]: PlayCircle,
  [QueueOption.REPLACE_NEXT]: SkipForward,
  [QueueOption.PLAY]: PlayCircle,
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
  const LiveSourceTypes = [MediaType.RADIO, MediaType.AUDIO_SOURCE];
  const enqueueConfigKey = LiveSourceTypes.includes(firstItem.media_type)
    ? "default_enqueue_option_live_sources"
    : `default_enqueue_option_${firstItem.media_type}`;
  const defaultEnqueueOption = (await api.getCoreConfigValue(
    "player_queues",
    enqueueConfigKey,
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
      icon: RadioTower,
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

export interface ContextMenuOptions {
  // true when the menu is opened from the sidebar shortcuts list,
  // enabling actions that only make sense there (e.g. move up/down).
  shortcutContext?: boolean;
}

export const getContextMenuItems = async function (
  items: MediaItemTypeOrItemMapping[],
  parentItem?: MediaItemType,
  options?: ContextMenuOptions,
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
      icon: Info,
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
      icon: Folder,
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
        icon: MicVocal,
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
      icon: Disc3,
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
    !isItemInLibrary(resolvedItem) &&
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
        for (const item of items) {
          api.addItemToLibrary(item);
          // optimistically flag the mappings so the derived state re-evaluates
          if ("provider_mappings" in item)
            item.provider_mappings.forEach((pm) => (pm.in_library = true));
        }
        // Clear the multi-select after action
        eventbus.emit("clearSelection");
      },
      icon: LibraryBig,
    });
  }
  // remove from library
  if (
    isItemInLibrary(resolvedItem) &&
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
        eventbus.emit("deleteConfirmationDialog", {
          title: $t("remove_library"),
          message: $t("confirm_library_remove"),
          confirmLabel: $t("remove"),
          onConfirm: () => {
            for (const item of items) {
              api.removeItemFromLibrary(item.media_type, item.item_id);
              // optimistically clear membership so the derived state re-evaluates;
              // favorite implies membership, so it must clear too
              if ("favorite" in item) item.favorite = false;
              if ("provider_mappings" in item)
                item.provider_mappings.forEach((pm) => (pm.in_library = false));
            }
            if (resolvedItem.item_id == parentItem?.item_id) router.go(-1);
            // Clear the multi-select after action
            eventbus.emit("clearSelection");
          },
        });
      },
      icon: LibraryBig,
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
          icon: Heart,
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
          icon: Heart,
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
          icon: Heart,
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
          icon: Heart,
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
        icon: MinusCircle,
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
      icon: PlusCircle,
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
        icon: History,
        action: async () => {
          await api.markItemUnPlayed(items[0]);
          (items[0] as PodcastEpisode).fully_played = false;
        },
      });
    } else {
      // mark played
      contextMenuItems.push({
        label: "mark_played",
        icon: History,
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
      icon: Image,
    });
  }
  // edit item (for builtin provider items that support editing)
  if (
    items.length === 1 &&
    items[0] == parentItem &&
    items[0].provider === "library" &&
    "provider_mappings" in items[0] &&
    [MediaType.RADIO, MediaType.TRACK, MediaType.PLAYLIST].includes(
      items[0].media_type,
    )
  ) {
    const item = items[0] as Radio | Track | Playlist;
    const hasBuiltinProvider = item.provider_mappings?.some(
      (pm) => pm.provider_domain === "builtin",
    );
    const builtinProvider = api.getProvider("builtin");
    const featureMap: Record<string, ProviderFeature> = {
      [MediaType.RADIO]: ProviderFeature.LIBRARY_RADIOS_EDIT,
      [MediaType.TRACK]: ProviderFeature.LIBRARY_TRACKS_EDIT,
      [MediaType.PLAYLIST]: ProviderFeature.LIBRARY_PLAYLISTS_EDIT,
    };
    const labelMap: Record<string, string> = {
      [MediaType.RADIO]: "edit_radio",
      [MediaType.TRACK]: "edit_track",
      [MediaType.PLAYLIST]: "edit_playlist",
    };
    const supportsEdit = builtinProvider?.supported_features?.includes(
      featureMap[item.media_type],
    );
    // For playlists, also check is_editable flag (builtin special playlists are not editable)
    const isEditablePlaylist =
      item.media_type !== MediaType.PLAYLIST ||
      (item as Playlist).is_editable !== false;
    if (hasBuiltinProvider && supportsEdit && isEditablePlaylist) {
      contextMenuItems.push({
        label: labelMap[item.media_type],
        labelArgs: [],
        action: () => {
          eventbus.emit("editItemDialog", item);
        },
        icon: Pencil,
      });
    }
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
      icon: RefreshCw,
    });
  }
  // export playlist
  if (
    items.length === 1 &&
    items[0] == parentItem &&
    items[0].media_type === MediaType.PLAYLIST &&
    items[0].provider === "library"
  ) {
    contextMenuItems.push({
      label: "export_playlist",
      labelArgs: [],
      action: async () => {
        const playlist = items[0] as Playlist;
        const m3uData = await api.exportPlaylist(playlist.item_id);
        const blob = new Blob([m3uData], { type: "audio/x-mpegurl" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${playlist.name.replace(/[\\/:*?"<>|]/g, "_")}.m3u8`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      icon: Download,
    });
  }
  // pin / unpin shortcut in sidebar (playlist, artist, album, track, radio, podcast, audiobook, genre)
  if (
    items.length === 1 &&
    isShortcutMediaType(items[0].media_type) &&
    !!items[0].uri
  ) {
    const shortcutItem = items[0];
    if (isShortcutPinnedItem(shortcutItem)) {
      // move up/down only make sense when the menu is opened on the
      // sidebar shortcuts list itself
      if (options?.shortcutContext) {
        const { canMoveUp, canMoveDown } =
          getShortcutMoveAvailability(shortcutItem);
        contextMenuItems.push({
          label: "queue_move_up",
          labelArgs: [],
          action: () => moveShortcutStandaloneItem(shortcutItem, "up"),
          icon: ArrowUp,
          disabled: !canMoveUp,
        });
        contextMenuItems.push({
          label: "queue_move_down",
          labelArgs: [],
          action: () => moveShortcutStandaloneItem(shortcutItem, "down"),
          icon: ArrowDown,
          disabled: !canMoveDown,
        });
      }
      contextMenuItems.push({
        label: "shortcut.remove_from",
        labelArgs: [],
        action: () => unpinShortcutStandaloneItem(shortcutItem),
        icon: PinOff,
      });
    } else {
      contextMenuItems.push({
        label: "shortcut.add_to",
        labelArgs: [],
        action: () => pinShortcutStandalone(shortcutItem),
        icon: Pin,
        disabled: isShortcutCapReached(),
      });
    }
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
      icon: Link,
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
      icon: Merge,
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
      icon: Trash2,
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
  sortBy?: string,
) {
  const playMenuItems: ContextMenuItem[] = [];
  if (items.length == 0 || !itemIsAvailable(items[0])) {
    return playMenuItems;
  }

  const playableItems = items.filter((x) => x.is_playable);
  if (playableItems.length == 0) return playMenuItems;
  const firstItem = playableItems[0];

  const LiveSourceTypes = [MediaType.RADIO, MediaType.AUDIO_SOURCE];
  const enqueueConfigKey = LiveSourceTypes.includes(firstItem.media_type)
    ? "default_enqueue_option_live_sources"
    : `default_enqueue_option_${firstItem.media_type}`;
  const defaultEnqueueOption = (await api.getCoreConfigValue(
    "player_queues",
    enqueueConfigKey,
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
            undefined,
            sortBy,
          );
        },
        icon: PlayCircle,
        labelArgs: [],
        disabled: !store.activePlayer,
      });
    }
    // Play from here (album track)
    if (parentItem.media_type == MediaType.ALBUM) {
      playMenuItems.push({
        label: "play_album_from",
        action: () => {
          api.playMedia(
            parentItem.uri,
            undefined,
            false,
            firstItem.item_id,
            undefined,
            sortBy,
          );
        },
        icon: PlayCircle,
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
        icon: PlayCircle,
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
      icon: PlayCircle,
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
      icon: RadioTower,
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
    icon: ListMusic,
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
        icon: History,
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
        icon: History,
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
        icon: History,
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
        icon: History,
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
</script>
