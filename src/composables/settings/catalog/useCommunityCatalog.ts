import {
  COMMUNITY_CATALOG_DOMAIN,
  COMMUNITY_CATALOG_ENABLED_KEY,
  getInstalledCommunityProviders,
} from "@/helpers/community_catalog";
import { getCatalogType } from "@/helpers/provider_catalog";
import { api } from "@/plugins/api";
import {
  type CommunityProvider,
  type ConfigEntry,
  EventType,
  type ProviderManifest,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

/** Where the community catalog stands for the current user. */
export type CommunityCatalogStatus = "loading" | "ready" | "unavailable";

/**
 * The community catalog for an admin: its switch, what it lists, and installing
 * and removing from it, kept in step with the server. For anyone else it stays
 * empty and makes no call.
 */
export function useCommunityCatalog() {
  // the commands need the system manage scope
  const isAdmin = authManager.hasScope(Scope.SYSTEM_MANAGE);

  const providers = ref<CommunityProvider[]>([]);
  // the switch: its value, and the own-risk text the server gives it
  const switchEntry = ref<ConfigEntry | null>(null);
  const status = ref<CommunityCatalogStatus>(isAdmin ? "loading" : "ready");
  const saving = ref(false);
  const refreshing = ref(false);
  const installing = ref(new Set<string>());
  const removing = ref(new Set<string>());

  // whether the page has what it needs from the community catalog, either way
  const settled = computed(() => status.value !== "loading");
  const available = computed(() => isAdmin && status.value === "ready");
  const enabled = computed(() => switchEntry.value?.value === true);
  const installed = computed(() =>
    available.value ? getInstalledCommunityProviders(providers.value) : [],
  );
  // what joins the Catalog's list; nothing while it is not available
  const listed = computed(() => (available.value ? providers.value : []));

  const load = async function () {
    if (!isAdmin) return;
    try {
      const [config, list] = await Promise.all([
        api.getCoreConfig(COMMUNITY_CATALOG_DOMAIN),
        api.getCommunityProviders(),
      ]);
      switchEntry.value = config.values[COMMUNITY_CATALOG_ENABLED_KEY];
      providers.value = list;
      status.value = "ready";
    } catch {
      // refused in safe mode, or out of reach: the page says it is not available
      status.value = "unavailable";
    }
  };

  /** Load again after it was not available, waiting as on the first load. */
  const retry = async function () {
    status.value = "loading";
    await load();
  };

  /**
   * Switch the community catalog on, after the user confirmed the own-risk text,
   * or off.
   *
   * @param value - Whether to switch it on.
   */
  const setEnabled = function (value: boolean) {
    if (!value) {
      void saveEnabled(false);
      return;
    }
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("settings.catalog.community.confirm_title"),
      message: switchEntry.value?.description ?? "",
      confirmLabel: $t("settings.catalog.community.confirm"),
      destructive: false,
      onConfirm: () => saveEnabled(true),
    });
  };

  /**
   * Install one from the community catalog; nothing happens while it is being
   * installed already.
   *
   * @param provider - What the community catalog offers.
   * @returns The manifest to add it with, or undefined when the install failed
   *   or was already running.
   */
  const install = async function (
    provider: CommunityProvider,
  ): Promise<ProviderManifest | undefined> {
    if (installing.value.has(provider.domain)) return undefined;
    const name = provider.manifest.name;
    installing.value.add(provider.domain);
    try {
      const result = await api.installCommunityProvider(provider.domain);
      replaceProvider(result);
      toast.success($t("settings.catalog.community.installed_toast", { name }));
      // the add flow reads the manifest the server just registered
      await api.fetchProviderManifests();
      return result.manifest;
    } catch (err) {
      toast.error(String(err));
      return undefined;
    } finally {
      installing.value.delete(provider.domain);
    }
  };

  /**
   * Remove an installed one, after a confirmation that its settings stay.
   *
   * @param provider - The installed one.
   */
  const remove = function (provider: CommunityProvider) {
    const name = provider.manifest.name;
    const type = getCatalogType(provider.manifest.type);
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("settings.catalog.community.remove_title", { name }),
      message: $t("settings.catalog.community.remove_message", {
        name,
        page: type ? $t(type.label) : "",
      }),
      confirmLabel: $t("settings.catalog.community.remove"),
      onConfirm: () => removeConfirmed(provider),
    });
  };

  /** Fetch the community catalog from the project now. */
  const refresh = async function () {
    refreshing.value = true;
    try {
      providers.value = await api.refreshCommunityProviders();
      toast.success($t("settings.catalog.community.refreshed"));
    } catch (err) {
      toast.error(String(err));
    } finally {
      refreshing.value = false;
    }
  };

  let unsubCatalogUpdated: (() => void) | undefined;

  onMounted(() => {
    if (!isAdmin) return;
    void load();
    unsubCatalogUpdated = api.subscribe(
      EventType.COMMUNITY_CATALOG_UPDATED,
      load,
    );
  });

  onBeforeUnmount(() => {
    unsubCatalogUpdated?.();
  });

  async function saveEnabled(value: boolean) {
    saving.value = true;
    try {
      const config = await api.saveCoreConfig(COMMUNITY_CATALOG_DOMAIN, {
        [COMMUNITY_CATALOG_ENABLED_KEY]: value,
      });
      switchEntry.value = config.values[COMMUNITY_CATALOG_ENABLED_KEY];
    } catch {
      // the api reports a failed save itself, and the switch keeps its state
      return;
    } finally {
      saving.value = false;
    }
    toast.success(
      $t(
        value
          ? "settings.catalog.community.enabled_toast"
          : "settings.catalog.community.disabled_toast",
      ),
    );
    // what the list offers depends on the switch
    await load();
  }

  async function removeConfirmed(provider: CommunityProvider) {
    const name = provider.manifest.name;
    removing.value.add(provider.domain);
    try {
      await api.removeCommunityProvider(provider.domain);
    } catch (err) {
      toast.error(String(err));
      return;
    } finally {
      removing.value.delete(provider.domain);
    }
    toast.success($t("settings.catalog.community.removed_toast", { name }));
    // while the switch is on, the catalog offers it again
    await load();
  }

  function replaceProvider(provider: CommunityProvider) {
    providers.value = providers.value.map((item) =>
      item.domain === provider.domain ? provider : item,
    );
  }

  return {
    isAdmin,
    status,
    settled,
    available,
    enabled,
    listed,
    installed,
    saving,
    refreshing,
    installing,
    removing,
    retry,
    setEnabled,
    install,
    remove,
    refresh,
  };
}
