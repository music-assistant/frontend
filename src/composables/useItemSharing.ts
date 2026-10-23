import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { IS_MOBILE_UA } from "@/helpers/device";
import { copyToClipboard } from "@/helpers/utils";
import api from "@/plugins/api";
import {
  MediaType,
  Scope,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import type { ItemShareInfo } from "@/plugins/api/sharing";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Share2 } from "@lucide/vue";
import { reactive, markRaw } from "vue";
import { toast } from "vue-sonner";

const SHARE_MEDIA_TYPES = [
  MediaType.ARTIST,
  MediaType.ALBUM,
  MediaType.TRACK,
  MediaType.PLAYLIST,
  MediaType.RADIO,
  MediaType.PODCAST,
  MediaType.PODCAST_EPISODE,
  MediaType.AUDIOBOOK,
];

/** Use only the payload prepared by the server before the final user click. */
export async function activateItemShare(payload: ShareData): Promise<void> {
  if (IS_MOBILE_UA && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      toast.success($t("provider_links.shared"));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.info($t("provider_links.cancelled"));
      } else toast.error($t("provider_links.share_failed"));
    }
    return;
  }
  try {
    if (await copyToClipboard(payload.url ?? payload.text ?? "")) {
      toast.success($t("provider_links.copied"));
    } else toast.error($t("provider_links.copy_failed"));
  } catch {
    toast.error($t("provider_links.copy_failed"));
  }
}

/** Build a share action that loads only when its containing overflow menu opens. */
export function getItemShareMenuItem(
  item: MediaItemTypeOrItemMapping,
): ContextMenuItem | undefined {
  if (
    !authManager.hasScope(Scope.LIBRARY_READ) ||
    !["authenticated", "initialized"].includes(api.state?.value) ||
    !item.uri ||
    !SHARE_MEDIA_TYPES.includes(item.media_type)
  )
    return;

  const menuItem: ContextMenuItem = reactive<ContextMenuItem>({
    label: "provider_links.share",
    icon: markRaw(Share2),
    disabled: true,
    prepare: async () => {
      menuItem.disabled = true;
      menuItem.hide = false;
      menuItem.action = undefined;
      menuItem.subItems = undefined;
      try {
        const info: ItemShareInfo = await api.getItemShareInfo(item.uri);
        const choices = info.links.map((link) => ({
          label: "provider_links.destination",
          labelArgs: {
            provider:
              api.getProviderManifest(link.provider_domain)?.name ??
              api.getProvider(link.provider_instance)?.name ??
              link.provider_domain,
          },
          icon: markRaw(Share2),
          action: () => activateItemShare({ url: link.url, title: info.title }),
        }));
        if (choices.length > 1) menuItem.subItems = choices;
        else if (choices.length === 1) menuItem.action = choices[0].action;
        else if (info.text) {
          const text = info.text;
          menuItem.action = () => activateItemShare({ text });
        } else menuItem.hide = true;
        menuItem.disabled = false;
      } catch {
        menuItem.hide = true;
        toast.error($t("provider_links.load_failed"));
      }
    },
  });
  return menuItem;
}
