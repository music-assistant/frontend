import {
  COMMUNITY_CATALOG_AUTO_UPDATE_KEY,
  COMMUNITY_CATALOG_DOMAIN,
  COMMUNITY_CATALOG_ENABLED_KEY,
  COMMUNITY_NOTICE_MOVED,
  getCommunityUpdateOutcome,
  getInstalledCommunityProviders,
  hasCommunityUpdate,
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
 * The community catalog for an admin: its switch, what it lists, and installing,
 * updating and removing from it, kept in step with the server. For anyone else
 * it stays empty and makes no call.
 */
export function useCommunityCatalog() {
  // the commands need the system manage scope
  const isAdmin = authManager.hasScope(Scope.SYSTEM_MANAGE);

  const providers = ref<CommunityProvider[]>([]);
  // the switch: its value, and the own-risk text the server gives it
  const switchEntry = ref<ConfigEntry | null>(null);
  const autoUpdateEntry = ref<ConfigEntry | null>(null);
  const status = ref<CommunityCatalogStatus>(isAdmin ? "loading" : "ready");
  const saving = ref(false);
  const savingAutoUpdate = ref(false);
  const refreshing = ref(false);
  const installing = ref(new Set<string>());
  const removing = ref(new Set<string>());
  const updating = ref(new Set<string>());
  const updatingAll = ref(false);

  // whether the page has what it needs from the community catalog, either way
  const settled = computed(() => status.value !== "loading");
  const available = computed(() => isAdmin && status.value === "ready");
  const enabled = computed(() => switchEntry.value?.value === true);
  const autoUpdate = computed(() => autoUpdateEntry.value?.value === true);
  const installed = computed(() =>
    available.value ? getInstalledCommunityProviders(providers.value) : [],
  );
  const updateCount = computed(
    () => installed.value.filter(hasCommunityUpdate).length,
  );
  // the ones the server installed by itself because they moved here
  const moved = computed(() =>
    installed.value.filter(
      (provider) => provider.notice === COMMUNITY_NOTICE_MOVED,
    ),
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
      autoUpdateEntry.value =
        config.values[COMMUNITY_CATALOG_AUTO_UPDATE_KEY] ?? null;
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

  /**
   * Whether an installed one is being updated, on its own or with all the others.
   *
   * @param domain - The domain of the installed one.
   */
  const isUpdating = function (domain: string): boolean {
    if (updating.value.has(domain)) return true;
    const provider = providers.value.find((item) => item.domain === domain);
    return updatingAll.value && !!provider && hasCommunityUpdate(provider);
  };

  /**
   * Update an installed one to the version on offer, also when that version
   * failed to load before; nothing happens while it is being updated already.
   *
   * @param provider - The installed one.
   */
  const update = async function (provider: CommunityProvider) {
    const { domain } = provider;
    if (isUpdating(domain)) return;
    const name = provider.manifest.name;
    const version = provider.latest_version;
    updating.value.add(domain);
    try {
      providers.value = await api.updateCommunityProviders(domain);
    } catch (err) {
      toast.error(String(err));
      return;
    } finally {
      updating.value.delete(domain);
    }
    const result = providers.value.find((item) => item.domain === domain);
    const outcome = getCommunityUpdateOutcome(result, version);
    if (outcome === "failed") {
      toast.error(
        $t("settings.catalog.community.update_failed_toast", { name, version }),
      );
      return;
    }
    toast.success(
      outcome === "restart"
        ? $t("settings.catalog.community.restart_hint", { version })
        : $t("settings.catalog.community.updated_toast", { name }),
    );
  };

  /** Update every installed one that has an update on offer. */
  const updateAll = async function () {
    if (updatingAll.value) return;
    // the version each one is to get
    const targets = installed.value
      .filter(hasCommunityUpdate)
      .map((provider) => [provider.domain, provider.latest_version] as const);
    updatingAll.value = true;
    try {
      providers.value = await api.updateCommunityProviders();
    } catch (err) {
      toast.error(String(err));
      return;
    } finally {
      updatingAll.value = false;
    }
    // the server skips one it cannot update, and puts one that does not load
    // back on its previous version
    const outcomes = targets.map(([domain, version]) =>
      getCommunityUpdateOutcome(
        providers.value.find((provider) => provider.domain === domain),
        version,
      ),
    );
    if (outcomes.includes("failed")) {
      toast.error($t("settings.catalog.community.update_all_failed"));
      return;
    }
    toast.success(
      $t(
        outcomes.includes("restart")
          ? "settings.catalog.community.updated_all_restart"
          : "settings.catalog.community.updated_all_toast",
      ),
    );
  };

  /**
   * Turn automatic updates on or off.
   *
   * @param value - Whether updates install by themselves.
   */
  const setAutoUpdate = async function (value: boolean) {
    savingAutoUpdate.value = true;
    try {
      const config = await api.saveCoreConfig(COMMUNITY_CATALOG_DOMAIN, {
        [COMMUNITY_CATALOG_AUTO_UPDATE_KEY]: value,
      });
      autoUpdateEntry.value =
        config.values[COMMUNITY_CATALOG_AUTO_UPDATE_KEY] ?? null;
    } catch {
      // the api reports a failed save itself, and the switch keeps its state
      return;
    } finally {
      savingAutoUpdate.value = false;
    }
    toast.success(
      $t(
        value
          ? "settings.catalog.community.auto_update_on_toast"
          : "settings.catalog.community.auto_update_off_toast",
      ),
    );
  };

  /**
   * Dismiss the notice of an installed one.
   *
   * @param provider - The installed one with a notice.
   */
  const dismissNotice = async function (provider: CommunityProvider) {
    try {
      await api.dismissCommunityNotice(provider.domain);
    } catch (err) {
      toast.error(String(err));
      return;
    }
    replaceProvider({ ...provider, notice: null });
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
    autoUpdate,
    listed,
    installed,
    updateCount,
    moved,
    saving,
    savingAutoUpdate,
    refreshing,
    installing,
    removing,
    updating,
    updatingAll,
    isUpdating,
    retry,
    setEnabled,
    setAutoUpdate,
    install,
    update,
    updateAll,
    remove,
    dismissNotice,
    refresh,
  };
}
