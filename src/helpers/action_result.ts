// What the user is told after a one-shot action ran: an action button of a
// settings form, or a menu entry a provider declares.
import { isHomeAssistantIngressSession } from "@/helpers/ingress";
import { isCommunityProvider } from "@/helpers/provider_config";
import { openActionResultUrl } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { ConfigActionResult, Player } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { toast } from "vue-sonner";

// prefixes an action of one of a player's protocols with that protocol's output id
const PROTOCOL_ACTION_SPLITTER = "||protocol||";

/**
 * Show the outcome of a one-shot action: open its url or page once, and say
 * what happened in its own message or, without one, that it is done.
 *
 * @param result - What the action answered, if anything.
 * @param provider - Domain or instance id of the provider that answered, if a provider did.
 */
export const showActionResult = (
  result: ConfigActionResult | null,
  provider?: string,
) => {
  const title = result?.message || $t("settings.action_completed");
  if (result?.open_page) {
    openPage(result.open_page, title);
    return;
  }
  if (
    result?.open_url &&
    isCommunity(provider) &&
    isOwnOrigin(result.open_url)
  ) {
    toast.warning(title, { description: $t("settings.action_link_refused") });
    return;
  }
  openActionResultUrl(result?.open_url);
  toast.success(title);
};

/**
 * The provider that answers an action of a player's settings: the protocol the
 * action belongs to, or else the player's own provider.
 *
 * @param player - The player whose settings hold the action.
 * @param action - The id of the action.
 */
export const getPlayerActionProvider = (
  player: Player | undefined,
  action: string,
): string | undefined => {
  if (!action.includes(PROTOCOL_ACTION_SPLITTER)) return player?.provider;
  const protocolId = action.split(PROTOCOL_ACTION_SPLITTER)[0];
  return player?.output_protocols.find(
    (protocol) => protocol.output_protocol_id === protocolId,
  )?.protocol_domain;
};

const openPage = (page: string, title: string) => {
  if (
    !api.isRemoteConnection.value &&
    !isHomeAssistantIngressSession(api.serverInfo.value)
  ) {
    openActionResultUrl(resolveAgainst(page, api.baseUrl));
    toast.success(title);
    return;
  }
  // Ingress and Remote Access cannot carry a page opened in its own tab, so
  // it can only open on the server's own address on the home network
  const internalUrl = api.serverInfo.value?.internal_url;
  if (!internalUrl) {
    toast.warning(title, {
      description: $t("settings.action_page_unavailable"),
    });
    return;
  }
  openActionResultUrl(resolveAgainst(page, internalUrl));
  toast.success(title, {
    description: $t("settings.action_page_home_network"),
  });
};

// the page's address is relative to the server's, which may carry a base path
const resolveAgainst = (page: string, base = ""): string =>
  new URL(page, base.endsWith("/") ? base : `${base}/`).href;

const isCommunity = (provider?: string): boolean =>
  !!provider && isCommunityProvider(api.getProviderManifest(provider));

// A page on one of these origins shares the storage a copy of the app keeps
// its login in: the app's own, and the server's addresses it can be opened on.
const isOwnOrigin = (url: string): boolean => {
  const own = [
    window.location.href,
    api.baseUrl,
    api.serverInfo.value?.internal_url,
  ].map(originOf);
  const origin = originOf(url);
  return !!origin && own.includes(origin);
};

const originOf = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};
