// Shared handlers for the click/play/menu interactions on a media item,
// dispatching to the details views and the item context menu.
import {
  showContextMenuForMediaItem,
  showPlayMenuForMediaItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  BrowseFolder,
  MediaItemType,
  MediaItemTypeOrItemMapping,
  MediaType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import { toast } from "vue-sonner";

// Click behaviour is configured on the queue controller so every client resolves it
// the same way; these are the values that differ from the (server) default.
const CLICK_ACTION_PLAY = "play";
const PLAY_ACTION_PLAY_TRACK = "play_track";

// media types for which clicking the item itself is configurable
const CLICK_ACTION_CONFIG_KEYS: Partial<Record<MediaType, string>> = {
  [MediaType.ARTIST]: "default_click_action_artist",
  [MediaType.ALBUM]: "default_click_action_album",
  [MediaType.PLAYLIST]: "default_click_action_playlist",
};

/**
 * Handle a click on the play button of a media item.
 *
 * posX/posY anchor the play menu, which is shown instead of playing directly
 * when there is no usable active player or when forceMenu is set. sortBy is the
 * sort order of the list the item was played from. A track within an album or
 * playlist follows the configured play action: continue from that track, or
 * play only the track itself.
 */
export const handlePlayBtnClick = async function (
  item: MediaItemTypeOrItemMapping,
  posX: number,
  posY: number,
  parentItem?: MediaItemType,
  forceMenu?: boolean,
  sortBy?: string,
) {
  // a failed play action must never be silent: without feedback the play
  // button appears dead (e.g. while the connection is re-establishing)
  const onPlayError = (err: Error) => {
    console.error("Play action failed:", err);
    toast.error($t("play_failed"));
  };
  // we show the play menu for the item once (if playerTip has not been dismissed)
  if (!forceMenu && store.activePlayer?.available) {
    if (
      item.media_type == MediaType.TRACK &&
      (parentItem?.media_type == MediaType.PLAYLIST ||
        parentItem?.media_type == MediaType.ALBUM) &&
      store.activePlayerQueue
    ) {
      // special case: playing a track within a playlist/album - continue from
      // there, unless the user configured the play button to play just the track
      const playAction = await readClickSetting(
        parentItem.media_type == MediaType.PLAYLIST
          ? "default_play_action_playlist_track"
          : "default_play_action_album_track",
      );
      if (playAction != PLAY_ACTION_PLAY_TRACK) {
        api
          .playMedia(parentItem.uri, undefined, item.item_id, undefined, sortBy)
          .catch(onPlayError);
        return;
      }
    }
    // else: play the item directly
    api.playMedia(item).catch(onPlayError);
    return;
  }
  showPlayMenuForMediaItem(item, parentItem, posX, posY).catch(onPlayError);
};

/**
 * Handle a click on a media item, opening its details view or playing it.
 *
 * posX/posY anchor the menu for item types that show one instead.
 */
export const handleMediaItemClick = async function (
  item: MediaItemTypeOrItemMapping,
  posX: number,
  posY: number,
  parentItem?: MediaItemType,
) {
  // open menu when item is unavailable so the user has a way to remove/refresh the item
  if (!itemIsAvailable(item)) {
    handleMenuBtnClick(item, posX, posY, undefined, false);
    return;
  }

  // folder items always open in browse view
  if (item.media_type == MediaType.FOLDER) {
    router.push({
      name: "browse",
      query: {
        path: (item as BrowseFolder).path,
      },
    });
    return;
  }

  // podcast episode has no details view so show play menu directly
  // TODO: revisit this once we have a proper podcast episode details view
  if (item.media_type == MediaType.PODCAST_EPISODE) {
    return handlePlayBtnClick(item, posX, posY, parentItem, true);
  }

  // open menu for collection items
  if (item.media_type == MediaType.COLLECTION) {
    router.push({
      name: "collection",
      params: {
        itemId: item.item_id,
        provider: item.provider,
      },
    });
    return;
  }

  // artist/album/playlist: play the item straight away if configured to do so
  const clickActionKey = CLICK_ACTION_CONFIG_KEYS[item.media_type];
  if (
    clickActionKey &&
    (await readClickSetting(clickActionKey)) == CLICK_ACTION_PLAY
  ) {
    return handlePlayBtnClick(item, posX, posY, parentItem);
  }

  // all other: go to details view
  router.push({
    name: item.media_type,
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};

/**
 * Handle a click on the context menu button of one or more media items.
 *
 * posX/posY anchor the menu. Set includePlayMenuItems to false to leave out the
 * play actions. sortBy is the sort order of the list the items came from.
 */
export const handleMenuBtnClick = function (
  item: MediaItemTypeOrItemMapping | MediaItemTypeOrItemMapping[],
  posX: number,
  posY: number,
  parentItem?: MediaItemType,
  includePlayMenuItems = true,
  sortBy?: string,
) {
  const mediaItems: MediaItemTypeOrItemMapping[] = Array.isArray(item)
    ? item
    : [item];
  showContextMenuForMediaItem(
    mediaItems,
    parentItem,
    posX,
    posY,
    includePlayMenuItems,
    includePlayMenuItems,
    sortBy,
  );
};

/**
 * Read one of the click-behaviour settings from the queue controller.
 *
 * Returns undefined when the setting can not be read, so the caller keeps
 * its default behaviour.
 */
const readClickSetting = async function (
  key: string,
): Promise<string | undefined> {
  try {
    return (await api.getCoreConfigValue("player_queues", key)) as string;
  } catch (err) {
    console.error("[media_item_actions] failed to read setting '%s'", key, err);
    return undefined;
  }
};
