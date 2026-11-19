// The pages provider instances serve, as the app's main menu lists them. A
// manifest may come from outside the project, so what it says is only ever
// shown as text, and a page only ever opens in a tab of its own.
import { isHomeAssistantIngressSession } from "@/helpers/ingress";
import { isPlainIconName } from "@/helpers/provider_menu_actions";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type {
  ProviderInstance,
  ProviderManifest,
  Scope,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { toast } from "vue-sonner";

/** A page the main menu offers. */
export interface ProviderPageEntry {
  instanceId: string;
  label: string;
  // a plain material design icon name, or null for the neutral icon
  icon: string | null;
  // the instance's name, set when more than one instance of its provider offers a page
  instanceName?: string;
}

/**
 * The pages the main menu offers: one per available instance whose provider
 * declares a page with a scope the user holds, sorted by label.
 *
 * @param providers - The provider instances the user sees.
 * @param manifests - The provider manifests, by domain.
 * @param hasScope - Whether the user holds a scope.
 */
export const getProviderPageEntries = (
  providers: readonly ProviderInstance[],
  manifests: Readonly<Record<string, ProviderManifest>>,
  hasScope: (scope: Scope) => boolean,
): ProviderPageEntry[] => {
  const offered = providers.flatMap((provider) => {
    const manifest = manifests[provider.domain];
    // an older server declares none
    const page = manifest?.page;
    if (!provider.available || !page || !hasScope(page.scope)) return [];
    return [{ provider, manifest, page }];
  });
  const perDomain = new Map<string, number>();
  for (const { provider } of offered) {
    perDomain.set(provider.domain, (perDomain.get(provider.domain) ?? 0) + 1);
  }
  return offered
    .map(({ provider, manifest, page }) => ({
      instanceId: provider.instance_id,
      label: page.label,
      icon: isPlainIconName(page.icon) ? page.icon : null,
      // an instance renamed to blanks is named after its provider
      instanceName:
        (perDomain.get(provider.domain) ?? 0) > 1
          ? provider.name.trim() || manifest.name.trim() || provider.domain
          : undefined,
    }))
    .sort(
      (a, b) =>
        compareText(a.label, b.label) ||
        compareText(a.instanceName ?? "", b.instanceName ?? ""),
    );
};

/**
 * Open the page a provider instance serves, in a new tab. On a direct
 * connection it opens on the server's address; under Home Assistant Ingress
 * or over Remote Access on the server's home network address, which the user
 * is told. A failure is reported by the api.
 *
 * @param instanceId - The provider instance that serves the page.
 */
export const openProviderPage = async (instanceId: string): Promise<void> => {
  let address: string;
  try {
    address = await api.openProviderPage(instanceId);
  } catch {
    // the api reports the failure itself
    return;
  }
  if (
    !api.isRemoteConnection.value &&
    !isHomeAssistantIngressSession(api.serverInfo.value)
  ) {
    openLinkInNewTab(resolveAgainst(address, api.baseUrl));
    return;
  }
  // Ingress and Remote Access cannot carry a page opened in its own tab, so
  // it can only open on the server's own address on the home network
  const internalUrl = api.serverInfo.value?.internal_url;
  if (!internalUrl) {
    toast.warning($t("provider_pages.unavailable"));
    return;
  }
  openLinkInNewTab(resolveAgainst(address, internalUrl));
  toast.info($t("provider_pages.home_network"));
};

const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

// the page's address is relative to the server's, which may carry a base path
const resolveAgainst = (page: string, base = ""): string =>
  new URL(page, base.endsWith("/") ? base : `${base}/`).href;
