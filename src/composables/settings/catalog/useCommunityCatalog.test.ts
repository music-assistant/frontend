import {
  type CommunityProvider,
  CommunityProviderState,
  type CoreConfig,
  EventType,
  type ProviderConfig,
  type Scope,
} from "@/plugins/api/interfaces";
import {
  type DeleteConfirmationDialogEvent,
  eventbus,
} from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { communityProvider } from "../../../../tests/fixtures/communityProvider";
import { providerConfig } from "../../../../tests/fixtures/providerConfig";
import {
  BUILTIN_ROLE_SCOPES,
  scopeChecker,
} from "../../../../tests/fixtures/scopes";
import { useCommunityCatalog } from "./useCommunityCatalog";

const { apiMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn(),
    saveCoreConfig: vi.fn(),
    getCommunityProviders: vi.fn(),
    refreshCommunityProviders: vi.fn(),
    installCommunityProvider: vi.fn(),
    removeCommunityProvider: vi.fn(),
    updateCommunityProviders: vi.fn(),
    dismissCommunityNotice: vi.fn(),
    fetchProviderManifests: vi.fn(),
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
// a translation shows its key followed by the values it names
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, named?: Record<string, unknown>) =>
    [key, ...Object.values(named ?? {})].join(" "),
}));

const OWN_RISK = "They run as part of your server, at your own risk.";

const coreConfig = (enabled: boolean, autoUpdate = false) =>
  ({
    domain: "community_catalog",
    last_error: null,
    values: {
      community_catalog_enabled: {
        key: "community_catalog_enabled",
        label: "Community catalog",
        description: OWN_RISK,
        value: enabled,
      },
      auto_update: { key: "auto_update", value: autoUpdate },
    },
  }) as unknown as CoreConfig;

const RADIO = communityProvider("radio");

// the settings entries the server holds
let configs: ProviderConfig[] = [];

// saves the switch the way the server does, so a later read returns it
async function saveSwitch(
  _domain: string,
  values: Record<string, boolean>,
): Promise<CoreConfig> {
  apiMock.getCoreConfig.mockResolvedValue(
    coreConfig(values.community_catalog_enabled),
  );
  return coreConfig(values.community_catalog_enabled);
}

let confirmations: DeleteConfirmationDialogEvent[] = [];
const onConfirmation = (event: DeleteConfirmationDialogEvent) =>
  confirmations.push(event);

function mountCatalog() {
  let catalog!: ReturnType<typeof useCommunityCatalog>;
  const wrapper = mount(
    defineComponent({
      setup() {
        catalog = useCommunityCatalog();
        return () => h("div");
      },
    }),
  );
  return { wrapper, catalog };
}

beforeEach(() => {
  vi.resetAllMocks();
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  apiMock.getCoreConfig.mockResolvedValue(coreConfig(false));
  apiMock.getCommunityProviders.mockResolvedValue([RADIO]);
  apiMock.subscribe.mockReturnValue(vi.fn());
  configs = [providerConfig({ domain: "spotify" })];
  apiMock.getProviderConfigs.mockImplementation(
    async (_type: unknown, domain?: string) =>
      configs.filter((config) => !domain || config.domain === domain),
  );
  confirmations = [];
  eventbus.on("deleteConfirmationDialog", onConfirmation);
});

afterEach(() => {
  eventbus.off("deleteConfirmationDialog", onConfirmation);
});

describe("useCommunityCatalog", () => {
  it("loads the switch and the list for an admin", async () => {
    const { catalog } = mountCatalog();
    expect(catalog.settled.value).toBe(false);
    await flushPromises();

    expect(apiMock.getCoreConfig).toHaveBeenCalledWith("community_catalog");
    expect(catalog.status.value).toBe("ready");
    expect(catalog.settled.value).toBe(true);
    expect(catalog.enabled.value).toBe(false);
    expect(catalog.listed.value).toEqual([RADIO]);
  });

  it("makes no call and lists nothing for anyone else", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(catalog.isAdmin).toBe(false);
    expect(catalog.settled.value).toBe(true);
    expect(catalog.available.value).toBe(false);
    expect(catalog.listed.value).toEqual([]);
    expect(catalog.updateCount.value).toBe(0);
    expect(catalog.moved.value).toEqual([]);
    expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
    expect(apiMock.getCommunityProviders).not.toHaveBeenCalled();
    expect(apiMock.subscribe).not.toHaveBeenCalled();
  });

  it("is not available when the server refuses it, as in safe mode", async () => {
    apiMock.getCommunityProviders.mockRejectedValue(
      new Error("not available in safe mode"),
    );
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(catalog.status.value).toBe("unavailable");
    expect(catalog.settled.value).toBe(true);
    expect(catalog.listed.value).toEqual([]);
    expect(catalog.installed.value).toEqual([]);
  });

  it("waits again on retry, and is ready once the server answers", async () => {
    apiMock.getCommunityProviders.mockRejectedValueOnce(new Error("refused"));
    const { catalog } = mountCatalog();
    await flushPromises();

    const retry = catalog.retry();
    expect(catalog.settled.value).toBe(false);
    await retry;

    expect(catalog.status.value).toBe("ready");
    expect(catalog.listed.value).toEqual([RADIO]);
  });

  it("loads again when the community catalog changes, and stops listening once gone", async () => {
    const unsubscribe = vi.fn();
    apiMock.subscribe.mockReturnValue(unsubscribe);
    const { wrapper, catalog } = mountCatalog();
    await flushPromises();
    expect(apiMock.subscribe).toHaveBeenCalledWith(
      EventType.COMMUNITY_CATALOG_UPDATED,
      expect.any(Function),
    );

    apiMock.getCommunityProviders.mockResolvedValue([]);
    await apiMock.subscribe.mock.calls[0][1]();

    expect(catalog.listed.value).toEqual([]);
    wrapper.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  describe("the switch", () => {
    it("is only saved once the own-risk text is confirmed", async () => {
      apiMock.saveCoreConfig.mockImplementation(saveSwitch);
      const { catalog } = mountCatalog();
      await flushPromises();

      catalog.setEnabled(true);

      expect(confirmations).toHaveLength(1);
      expect(confirmations[0]).toMatchObject({
        message: OWN_RISK,
        destructive: false,
      });
      expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();

      await confirmations[0].onConfirm();

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        community_catalog_enabled: true,
      });
      expect(catalog.enabled.value).toBe(true);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.enabled_toast",
      );
      // what the list offers depends on the switch
      expect(apiMock.getCommunityProviders).toHaveBeenCalledTimes(2);
    });

    it("is switched off without a confirmation", async () => {
      apiMock.getCoreConfig.mockResolvedValue(coreConfig(true));
      apiMock.saveCoreConfig.mockImplementation(saveSwitch);
      const { catalog } = mountCatalog();
      await flushPromises();

      catalog.setEnabled(false);
      await flushPromises();

      expect(confirmations).toHaveLength(0);
      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        community_catalog_enabled: false,
      });
      expect(catalog.enabled.value).toBe(false);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.disabled_toast",
      );
    });

    it("keeps its state when saving fails", async () => {
      // the api shows the error toast of a failed save itself
      apiMock.saveCoreConfig.mockRejectedValue(new Error("refused"));
      const { catalog } = mountCatalog();
      await flushPromises();

      catalog.setEnabled(true);
      await confirmations[0].onConfirm();

      expect(catalog.enabled.value).toBe(false);
      expect(catalog.saving.value).toBe(false);
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it("stays on when the server refuses to switch it off", async () => {
      // the api shows the server's reason, such as what is still installed
      apiMock.getCoreConfig.mockResolvedValue(coreConfig(true));
      apiMock.saveCoreConfig.mockRejectedValue(
        new Error("Remove what you installed from the community catalog first"),
      );
      const { catalog } = mountCatalog();
      await flushPromises();

      catalog.setEnabled(false);
      await flushPromises();

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        community_catalog_enabled: false,
      });
      expect(catalog.enabled.value).toBe(true);
      expect(catalog.saving.value).toBe(false);
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
    });
  });

  describe("installing", () => {
    it("installs, reports it and hands back the manifest to add it with", async () => {
      const installed = communityProvider("radio", {
        state: CommunityProviderState.INSTALLED,
        installed_version: "1.2.0",
      });
      let finishInstall!: (value: CommunityProvider) => void;
      apiMock.installCommunityProvider.mockReturnValue(
        new Promise((resolve) => (finishInstall = resolve)),
      );
      const { catalog } = mountCatalog();
      await flushPromises();

      const result = catalog.install(RADIO);
      expect(catalog.installing.value.has("radio")).toBe(true);
      finishInstall(installed);

      await expect(result).resolves.toEqual(installed.manifest);
      expect(apiMock.installCommunityProvider).toHaveBeenCalledWith("radio");
      expect(apiMock.fetchProviderManifests).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.installed_toast radio",
      );
      expect(catalog.installing.value.has("radio")).toBe(false);
      expect(catalog.installed.value).toEqual([installed]);
    });

    it("reports the settings it had before are back and hands back nothing to add", async () => {
      configs.push(providerConfig({ domain: "radio" }));
      apiMock.installCommunityProvider.mockResolvedValue(
        communityProvider("radio", { state: CommunityProviderState.INSTALLED }),
      );
      const { catalog } = mountCatalog();
      await flushPromises();

      await expect(catalog.install(RADIO)).resolves.toBe(undefined);

      expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(
        undefined,
        "radio",
      );
      expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
        "settings.catalog.community.installed_restored_toast radio",
      );
      expect(apiMock.fetchProviderManifests).toHaveBeenCalled();
    });

    it("does nothing while it is being installed already", async () => {
      let finishInstall!: (value: CommunityProvider) => void;
      apiMock.installCommunityProvider.mockReturnValue(
        new Promise((resolve) => (finishInstall = resolve)),
      );
      const { catalog } = mountCatalog();
      await flushPromises();

      const first = catalog.install(RADIO);
      const second = catalog.install(RADIO);
      finishInstall(
        communityProvider("radio", { state: CommunityProviderState.INSTALLED }),
      );

      await expect(second).resolves.toBe(undefined);
      await first;

      expect(apiMock.installCommunityProvider).toHaveBeenCalledOnce();
      expect(toastMock.success).toHaveBeenCalledOnce();
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it("reports the server's error and hands back nothing", async () => {
      apiMock.installCommunityProvider.mockRejectedValue({
        toString: () => "Its requirements clash with dj",
      });
      const { catalog } = mountCatalog();
      await flushPromises();

      await expect(catalog.install(RADIO)).resolves.toBe(undefined);

      expect(toastMock.error).toHaveBeenCalledWith(
        "Its requirements clash with dj",
      );
      expect(apiMock.fetchProviderManifests).not.toHaveBeenCalled();
      expect(catalog.installing.value.has("radio")).toBe(false);
    });
  });

  describe("removing", () => {
    const installed = communityProvider("radio", {
      state: CommunityProviderState.INSTALLED,
    });

    beforeEach(() => {
      apiMock.getCommunityProviders.mockResolvedValue([installed]);
    });

    it("says its settings stay and removes it once confirmed", async () => {
      const { catalog } = mountCatalog();
      await flushPromises();

      catalog.remove(installed);

      expect(confirmations[0].message).toBe(
        "settings.catalog.community.remove_message radio settings.music_sources",
      );
      expect(apiMock.removeCommunityProvider).not.toHaveBeenCalled();

      apiMock.getCommunityProviders.mockResolvedValue([RADIO]);
      await confirmations[0].onConfirm();

      expect(apiMock.removeCommunityProvider).toHaveBeenCalledWith("radio");
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.removed_toast radio",
      );
      expect(catalog.installed.value).toEqual([]);
    });

    it("reports a failed removal", async () => {
      apiMock.removeCommunityProvider.mockRejectedValue(new Error("busy"));
      const { catalog } = mountCatalog();
      await flushPromises();

      catalog.remove(installed);
      await confirmations[0].onConfirm();

      expect(toastMock.error).toHaveBeenCalledWith("Error: busy");
      expect(catalog.installed.value).toEqual([installed]);
    });
  });

  describe("refreshing", () => {
    it("fetches the list now and reports it", async () => {
      const { catalog } = mountCatalog();
      await flushPromises();
      apiMock.refreshCommunityProviders.mockResolvedValue([]);

      await catalog.refresh();

      expect(catalog.listed.value).toEqual([]);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.refreshed",
      );
      expect(catalog.refreshing.value).toBe(false);
    });

    it("reports a failed refresh", async () => {
      const { catalog } = mountCatalog();
      await flushPromises();
      apiMock.refreshCommunityProviders.mockRejectedValue(new Error("offline"));

      await catalog.refresh();

      expect(toastMock.error).toHaveBeenCalledWith("Error: offline");
      expect(catalog.listed.value).toEqual([RADIO]);
    });
  });

  describe("updating", () => {
    const current = communityProvider("radio", {
      state: CommunityProviderState.UPDATE_AVAILABLE,
      installed_version: "1.1.0",
      latest_version: "1.2.0",
    });
    const updated = communityProvider("radio", {
      state: CommunityProviderState.INSTALLED,
      installed_version: "1.2.0",
    });
    const other = communityProvider("dj", {
      state: CommunityProviderState.UPDATE_AVAILABLE,
      installed_version: "0.1.0",
      latest_version: "0.2.0",
    });
    const otherUpdated = communityProvider("dj", {
      state: CommunityProviderState.INSTALLED,
      installed_version: "0.2.0",
      latest_version: "0.2.0",
    });
    // what the server lists once it put 1.1.0 back because 1.2.0 did not load
    const wentBack = communityProvider("radio", {
      state: CommunityProviderState.INSTALLED,
      installed_version: "1.1.0",
      latest_version: "1.2.0",
      failed_version: "1.2.0",
    });

    beforeEach(() => {
      apiMock.getCommunityProviders.mockResolvedValue([current, other]);
    });

    it("counts the updates that wait", async () => {
      const { catalog } = mountCatalog();
      await flushPromises();

      expect(catalog.updateCount.value).toBe(2);
    });

    it("updates one by its domain, with progress, and reports it", async () => {
      let finish!: (value: CommunityProvider[]) => void;
      apiMock.updateCommunityProviders.mockReturnValue(
        new Promise((resolve) => (finish = resolve)),
      );
      const { catalog } = mountCatalog();
      await flushPromises();

      const result = catalog.update(current);
      expect(catalog.updating.value.has("radio")).toBe(true);
      // a second click while it runs asks nothing more of the server
      void catalog.update(current);
      finish([updated, other]);
      await result;

      expect(apiMock.updateCommunityProviders).toHaveBeenCalledOnce();
      expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith("radio");
      expect(catalog.updating.value.has("radio")).toBe(false);
      expect(catalog.installed.value).toEqual([other, updated]);
      expect(catalog.updateCount.value).toBe(1);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.updated_toast radio",
      );
    });

    it("says a restart finishes an update that waits for it", async () => {
      apiMock.updateCommunityProviders.mockResolvedValue([
        communityProvider("radio", {
          state: CommunityProviderState.RESTART_REQUIRED,
          installed_version: "1.1.0",
          pending_version: "1.2.0",
        }),
      ]);
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.update(current);

      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.restart_hint 1.2.0",
      );
    });

    it("says the server put the previous version back when the update did not load", async () => {
      apiMock.updateCommunityProviders.mockResolvedValue([wentBack, other]);
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.update(current);

      expect(toastMock.error).toHaveBeenCalledWith(
        "settings.catalog.community.update_failed_toast radio 1.2.0",
      );
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(catalog.installed.value).toEqual([other, wentBack]);
    });

    it("tries a version that did not load again, and says how it went", async () => {
      apiMock.getCommunityProviders.mockResolvedValue([wentBack]);
      apiMock.updateCommunityProviders.mockResolvedValueOnce([wentBack]);
      apiMock.updateCommunityProviders.mockResolvedValueOnce([updated]);
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.update(wentBack);

      expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith("radio");
      expect(toastMock.error).toHaveBeenCalledWith(
        "settings.catalog.community.update_failed_toast radio 1.2.0",
      );
      expect(toastMock.success).not.toHaveBeenCalled();

      await catalog.update(wentBack);

      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.updated_toast radio",
      );
    });

    it("keeps the result when the change event arrives while it runs", async () => {
      let finish!: (value: CommunityProvider[]) => void;
      apiMock.updateCommunityProviders.mockReturnValue(
        new Promise((resolve) => (finish = resolve)),
      );
      const { catalog } = mountCatalog();
      await flushPromises();

      const result = catalog.update(current);
      // the server tells about the change once the new version is live, and
      // only then finds that it does not load and puts the previous one back
      apiMock.getCommunityProviders.mockResolvedValue([updated, other]);
      await apiMock.subscribe.mock.calls[0][1]();
      expect(catalog.installed.value).toEqual([other, updated]);
      expect(catalog.updating.value.has("radio")).toBe(true);
      finish([wentBack, other]);
      await result;

      // the command answers last, with the list after all of it
      expect(catalog.installed.value).toEqual([other, wentBack]);
      expect(catalog.updating.value.has("radio")).toBe(false);
    });

    it("reports the server's error and keeps the list", async () => {
      apiMock.updateCommunityProviders.mockRejectedValue({
        toString: () => "Its requirements clash with dj",
      });
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.update(current);

      expect(toastMock.error).toHaveBeenCalledWith(
        "Its requirements clash with dj",
      );
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(catalog.updateCount.value).toBe(2);
      expect(catalog.updating.value.has("radio")).toBe(false);
    });

    it("updates all at once and reports it", async () => {
      apiMock.updateCommunityProviders.mockResolvedValue([
        updated,
        otherUpdated,
      ]);
      const { catalog } = mountCatalog();
      await flushPromises();

      const result = catalog.updateAll();
      expect(catalog.updatingAll.value).toBe(true);
      expect(catalog.isUpdating("radio")).toBe(true);
      expect(catalog.isUpdating("dj")).toBe(true);
      // updating one of them on its own meanwhile asks nothing more of the server
      void catalog.update(current);
      await result;

      expect(apiMock.updateCommunityProviders).toHaveBeenCalledOnce();
      expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith();
      expect(catalog.updatingAll.value).toBe(false);
      expect(catalog.isUpdating("radio")).toBe(false);
      expect(catalog.updateCount.value).toBe(0);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.updated_all_toast",
      );
    });

    it("says when not every update could be installed", async () => {
      // the server skips the one it cannot update
      apiMock.updateCommunityProviders.mockResolvedValue([updated, other]);
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.updateAll();

      expect(toastMock.error).toHaveBeenCalledWith(
        "settings.catalog.community.update_all_failed",
      );
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it("says not every update could be installed when one was put back", async () => {
      apiMock.updateCommunityProviders.mockResolvedValue([
        wentBack,
        otherUpdated,
      ]);
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.updateAll();

      expect(toastMock.error).toHaveBeenCalledWith(
        "settings.catalog.community.update_all_failed",
      );
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it("says a restart finishes the updates when only that is left", async () => {
      apiMock.updateCommunityProviders.mockResolvedValue([
        communityProvider("radio", {
          state: CommunityProviderState.RESTART_REQUIRED,
          installed_version: "1.1.0",
          pending_version: "1.2.0",
        }),
        otherUpdated,
      ]);
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.updateAll();

      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.updated_all_restart",
      );
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it("reports a failed update of all", async () => {
      apiMock.updateCommunityProviders.mockRejectedValue(new Error("busy"));
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.updateAll();

      expect(toastMock.error).toHaveBeenCalledWith("Error: busy");
      expect(catalog.updatingAll.value).toBe(false);
      expect(catalog.updateCount.value).toBe(2);
    });
  });

  describe("automatic updates", () => {
    it("reads the setting next to the switch", async () => {
      apiMock.getCoreConfig.mockResolvedValue(coreConfig(true, true));
      const { catalog } = mountCatalog();
      await flushPromises();

      expect(catalog.autoUpdate.value).toBe(true);
    });

    it("saves the setting and reports it", async () => {
      apiMock.saveCoreConfig.mockResolvedValue(coreConfig(true, true));
      const { catalog } = mountCatalog();
      await flushPromises();

      const result = catalog.setAutoUpdate(true);
      expect(catalog.savingAutoUpdate.value).toBe(true);
      await result;

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        auto_update: true,
      });
      expect(catalog.autoUpdate.value).toBe(true);
      expect(catalog.savingAutoUpdate.value).toBe(false);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.auto_update_on_toast",
      );
    });

    it("reports turning it off", async () => {
      apiMock.getCoreConfig.mockResolvedValue(coreConfig(true, true));
      apiMock.saveCoreConfig.mockResolvedValue(coreConfig(true, false));
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.setAutoUpdate(false);

      expect(catalog.autoUpdate.value).toBe(false);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.auto_update_off_toast",
      );
    });

    it("keeps its state when saving fails", async () => {
      apiMock.saveCoreConfig.mockRejectedValue(new Error("denied"));
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.setAutoUpdate(true);

      expect(catalog.autoUpdate.value).toBe(false);
      expect(catalog.savingAutoUpdate.value).toBe(false);
      expect(toastMock.success).not.toHaveBeenCalled();
    });
  });

  describe("the notice that one moved", () => {
    const moved = communityProvider("radio", {
      state: CommunityProviderState.INSTALLED,
      notice: "moved",
    });

    beforeEach(() => {
      apiMock.getCommunityProviders.mockResolvedValue([
        moved,
        communityProvider("dj", { state: CommunityProviderState.INSTALLED }),
      ]);
    });

    it("lists the ones that moved, also while the switch is off", async () => {
      const { catalog } = mountCatalog();
      await flushPromises();

      expect(catalog.enabled.value).toBe(false);
      expect(catalog.moved.value).toEqual([moved]);
    });

    it("is dismissed with the server and no longer listed", async () => {
      apiMock.dismissCommunityNotice.mockResolvedValue(undefined);
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.dismissNotice(moved);

      expect(apiMock.dismissCommunityNotice).toHaveBeenCalledWith("radio");
      expect(catalog.moved.value).toEqual([]);
    });

    it("stays when dismissing fails", async () => {
      apiMock.dismissCommunityNotice.mockRejectedValue(new Error("offline"));
      const { catalog } = mountCatalog();
      await flushPromises();

      await catalog.dismissNotice(moved);

      expect(toastMock.error).toHaveBeenCalledWith("Error: offline");
      expect(catalog.moved.value).toEqual([moved]);
    });
  });
});
