import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaType,
  Scope,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Share2 } from "@lucide/vue";

const SHAREABLE_MEDIA_TYPES: MediaType[] = [
  MediaType.TRACK,
  MediaType.ALBUM,
  MediaType.ARTIST,
  MediaType.PLAYLIST,
];

export function useShareLinkPreviewMenuItem(
  item: MediaItemTypeOrItemMapping,
): ContextMenuItem | undefined {
  const uri = item.uri;
  const canShare = () =>
    store.enabledPlugins?.has("share_provider") === true &&
    authManager.hasScope(Scope.LIBRARY_READ) &&
    itemIsAvailable(item) &&
    SHAREABLE_MEDIA_TYPES.includes(item.media_type) &&
    typeof item.uri === "string" &&
    item.uri === uri;

  if (!canShare()) return;

  return {
    label: "share.open_preview",
    labelArgs: [],
    action: () => {
      if (!canShare() || !uri) return;
      eventbus.emit("shareLinkPreview", { uri });
    },
    icon: Share2,
  };
}
