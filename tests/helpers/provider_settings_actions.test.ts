import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  getProviderAccessLabel,
  getProviderSettingsMenuItems,
  getProviderSettingsSections,
  type ProviderSettingsMenuOptions,
} from "@/helpers/provider_settings_actions";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderFeature,
  type ProviderInstance,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../fixtures/providerConfig";

const { apiMock, hasScope, openLinkInNewTab, permissionsMock, routerMock } =
  vi.hoisted(() => ({
    apiMock: {
      getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
      providerManifests: {} as Record<string, TestProviderManifest>,
      startSync: vi.fn<MusicAssistantApi["startSync"]>(),
    },
    openLinkInNewTab: vi.fn(),
    permissionsMock: {
      canConfigureSourceAccess: vi.fn<(config: ProviderConfig) => boolean>(),
      canReconfigureSource: vi.fn<(config: ProviderConfig) => boolean>(),
      canToggleSource: vi.fn<(config: ProviderConfig) => boolean>(),
      managesAllSources: vi.fn<() => boolean>(),
    },
    routerMock: { push: vi.fn() },
    hasScope: vi.fn<(scope: Scope) => boolean>(),
  }));

interface TestProviderManifest {
  allow_disable: boolean;
  builtin: boolean;
  documentation: string | null;
}

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/router", () => ({ default: routerMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/helpers/utils", () => ({ openLinkInNewTab }));
// the permission rules are covered where they live
vi.mock("@/helpers/provider_permissions", () => permissionsMock);

let callbacks: ReturnType<typeof createCallbacks>;

beforeEach(() => {
  vi.clearAllMocks();
  callbacks = createCallbacks();
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.providerManifests = { sonos: manifest(), spotify: manifest() };
  apiMock.startSync.mockResolvedValue([]);
  permissionsMock.canConfigureSourceAccess.mockReturnValue(true);
  permissionsMock.canReconfigureSource.mockReturnValue(false);
  permissionsMock.canToggleSource.mockReturnValue(true);
  permissionsMock.managesAllSources.mockReturnValue(true);
  hasScope.mockReturnValue(true);
});

describe("menu item order", () => {
  it("lists the list actions in order", () => {
    apiMock.getProvider.mockReturnValue(providerInstance());

    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(labelsOf(items)).toEqual([
      "settings.options",
      "settings.source_access.action",
      "settings.disable",
      "settings.documentation",
      "settings.sync",
      "settings.reload",
      "settings.remove_provider",
    ]);
  });

  it("prepends reconfigure when the source may be reconfigured", () => {
    permissionsMock.canReconfigureSource.mockReturnValue(true);

    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(labelsOf(items)[0]).toBe("settings.reconfigure");
  });

  it("leaves out what the settings page shows itself", () => {
    permissionsMock.canReconfigureSource.mockReturnValue(true);
    apiMock.getProvider.mockReturnValue(
      providerInstance({
        instance_id: "sonos--1",
        supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
        type: ProviderType.PLAYER,
      }),
    );

    const items = getProviderSettingsMenuItems(
      providerConfig({ domain: "sonos", type: ProviderType.PLAYER }),
      callbacks,
    );

    expect(labelsOf(items)).toEqual([
      "settings.disable",
      "settings.reload",
      "settings.add_group_player",
      "settings.remove_provider",
    ]);
  });
});

describe("access item", () => {
  it("labels the access action for an admin", () => {
    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(findItem(items, "settings.source_access.action")).toBeTruthy();
  });

  it("labels the access action for a member", () => {
    permissionsMock.managesAllSources.mockReturnValue(false);

    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(findItem(items, "settings.source_access.share_action")).toBeTruthy();
  });

  it("hides the access item when access may not be configured", () => {
    permissionsMock.canConfigureSourceAccess.mockReturnValue(false);

    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(findItem(items, "settings.source_access.action").hide).toBe(true);
  });
});

describe("disable/enable item", () => {
  it("hides it from whoever may not enable and disable the source", () => {
    permissionsMock.canToggleSource.mockReturnValue(false);

    const items = listMenu(
      providerConfig({ domain: "spotify", enabled: true }),
    );

    expect(findItem(items, "settings.disable").hide).toBe(true);
  });

  it("disables disabling when the manifest disallows it", () => {
    apiMock.providerManifests.spotify = manifest({ allow_disable: false });

    const items = listMenu(
      providerConfig({ domain: "spotify", enabled: true }),
    );

    expect(findItem(items, "settings.disable").disabled).toBe(true);
  });

  it("still offers to enable a disabled source the manifest disallows disabling", () => {
    apiMock.providerManifests.spotify = manifest({ allow_disable: false });

    const items = listMenu(
      providerConfig({ domain: "spotify", enabled: false }),
    );

    expect(findItem(items, "settings.enable").disabled).toBe(false);
  });

  it.each([
    [true, "settings.disable"],
    [false, "settings.enable"],
  ])(
    "labels it by the source's enabled state (enabled=%s)",
    (enabled, expectedLabel) => {
      const items = listMenu(providerConfig({ domain: "spotify", enabled }));

      expect(labelsOf(items)).toContain(expectedLabel);
    },
  );
});

describe("documentation item", () => {
  it("opens the documentation of the provider", () => {
    const items = listMenu(providerConfig({ domain: "spotify" }));

    findItem(items, "settings.documentation").action?.();

    expect(openLinkInNewTab).toHaveBeenCalledWith("https://example.com");
  });

  it("disables it without documentation", () => {
    apiMock.providerManifests.spotify = manifest({ documentation: null });

    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(findItem(items, "settings.documentation").disabled).toBe(true);
  });
});

describe("sync item", () => {
  it("syncs just this source", () => {
    apiMock.getProvider.mockReturnValue(providerInstance());

    const items = listMenu(
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
    );

    expect(findItem(items, "settings.sync").hide).toBe(false);
    // the menu handles a failing sync, so the action hands it the command
    expect(findItem(items, "settings.sync").action?.()).toBeInstanceOf(Promise);
    expect(apiMock.startSync).toHaveBeenCalledWith(undefined, ["spotify--1"]);
  });

  it("hides it when the source has no library to sync", () => {
    apiMock.getProvider.mockReturnValue(providerInstance({ available: false }));

    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(findItem(items, "settings.sync").hide).toBe(true);
  });
});

describe("remove item", () => {
  it("hides it for a builtin provider", () => {
    apiMock.providerManifests.spotify = manifest({ builtin: true });

    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(findItem(items, "settings.remove_provider").hide).toBe(true);
  });

  it("shows it for a provider the user set up", () => {
    const items = listMenu(providerConfig({ domain: "spotify" }));

    expect(findItem(items, "settings.remove_provider").hide).toBe(false);
  });
});

describe("player extras", () => {
  it("offers to view players for a player-type source with a running instance", () => {
    apiMock.getProvider.mockReturnValue(
      providerInstance({ instance_id: "sonos--1", type: ProviderType.PLAYER }),
    );

    const items = listMenu(
      providerConfig({
        domain: "sonos",
        instance_id: "sonos--1",
        type: ProviderType.PLAYER,
      }),
    );
    findItem(items, "settings.view_players").action?.();

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "playersettings",
      query: { providers: "sonos--1" },
    });
  });

  it("offers to add a group player when the instance supports it", () => {
    apiMock.getProvider.mockReturnValue(
      providerInstance({
        instance_id: "sonos--1",
        supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
        type: ProviderType.PLAYER,
      }),
    );

    const items = listMenu(
      providerConfig({
        domain: "sonos",
        instance_id: "sonos--1",
        type: ProviderType.PLAYER,
      }),
    );
    findItem(items, "settings.add_group_player").action?.();

    expect(routerMock.push).toHaveBeenCalledWith("/settings/addgroup/sonos--1");
  });

  it("leaves adding a group player to a role that may change player settings", () => {
    hasScope.mockImplementation(
      (scope) => scope !== Scope.CONFIG_PLAYERS_WRITE,
    );
    apiMock.getProvider.mockReturnValue(
      providerInstance({
        instance_id: "sonos--1",
        supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
        type: ProviderType.PLAYER,
      }),
    );

    const labels = labelsOf(
      listMenu(providerConfig({ domain: "sonos", type: ProviderType.PLAYER })),
    );

    expect(labels).not.toContain("settings.add_group_player");
  });

  it("omits both extras without a running provider instance", () => {
    const labels = labelsOf(
      listMenu(providerConfig({ domain: "sonos", type: ProviderType.PLAYER })),
    );

    expect(labels).not.toContain("settings.view_players");
    expect(labels).not.toContain("settings.add_group_player");
  });
});

describe("menu item actions", () => {
  const item = providerConfig({ domain: "spotify", instance_id: "spotify--1" });

  it("options opens the settings page of the source", () => {
    findItem(listMenu(item), "settings.options").action?.();

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--1",
    );
  });

  it("access calls onAccess with the source", () => {
    findItem(listMenu(item), "settings.source_access.action").action?.();

    expect(callbacks.onAccess).toHaveBeenCalledWith(item);
  });

  it("disable calls onToggleEnabled with the source", () => {
    findItem(listMenu(item), "settings.disable").action?.();

    expect(callbacks.onToggleEnabled).toHaveBeenCalledWith(item);
  });

  it("remove calls onRemove with the source", () => {
    findItem(listMenu(item), "settings.remove_provider").action?.();

    expect(callbacks.onRemove).toHaveBeenCalledWith(item);
  });

  it("reload calls onReload with the instance id", () => {
    findItem(listMenu(item), "settings.reload").action?.();

    expect(callbacks.onReload).toHaveBeenCalledWith("spotify--1");
  });

  it("reconfigure calls onReconfigure with the source", () => {
    permissionsMock.canReconfigureSource.mockReturnValue(true);

    findItem(listMenu(item), "settings.reconfigure").action?.();

    expect(callbacks.onReconfigure).toHaveBeenCalledWith(item);
  });
});

describe("getProviderSettingsSections", () => {
  it("follows the access rule for the access section", () => {
    permissionsMock.canConfigureSourceAccess.mockReturnValue(false);

    expect(getProviderSettingsSections(providerConfig()).access).toBe(false);
  });

  it("offers a library sync of an available music source to an admin", () => {
    apiMock.getProvider.mockReturnValue(providerInstance());

    expect(getProviderSettingsSections(providerConfig()).sync).toBe(true);
  });

  it.each<
    [
      string,
      {
        managesAll?: boolean;
        libraryManage?: boolean;
        available?: boolean;
        type?: ProviderType;
      },
    ]
  >([
    ["a member", { managesAll: false }],
    ["a role that may not manage the library", { libraryManage: false }],
    ["an unavailable source", { available: false }],
    ["a source that is not a music source", { type: ProviderType.PLAYER }],
  ])("offers no library sync to %s", (_label, overrides) => {
    permissionsMock.managesAllSources.mockReturnValue(
      overrides.managesAll ?? true,
    );
    hasScope.mockImplementation(
      (scope) =>
        scope !== Scope.LIBRARY_MANAGE || (overrides.libraryManage ?? true),
    );
    apiMock.getProvider.mockReturnValue(
      providerInstance({ available: overrides.available ?? true }),
    );

    expect(
      getProviderSettingsSections(
        providerConfig({ type: overrides.type ?? ProviderType.MUSIC }),
      ).sync,
    ).toBe(false);
  });

  it("offers the players of a loaded player provider only", () => {
    const config = providerConfig({ type: ProviderType.PLAYER });
    expect(getProviderSettingsSections(config).players).toBe(false);

    apiMock.getProvider.mockReturnValue(
      providerInstance({ type: ProviderType.PLAYER }),
    );
    expect(getProviderSettingsSections(config).players).toBe(true);
  });
});

describe("getProviderAccessLabel", () => {
  it.each([
    [true, "settings.source_access.action"],
    [false, "settings.source_access.share_action"],
  ])("names the action by the viewer's role (admin=%s)", (admin, label) => {
    permissionsMock.managesAllSources.mockReturnValue(admin);

    expect(getProviderAccessLabel()).toBe(label);
  });
});

function createCallbacks() {
  return {
    onAccess: vi.fn<(item: ProviderConfig) => void>(),
    onReconfigure: vi.fn<(config: ProviderConfig) => void>(),
    onReload: vi.fn<(instanceId: string) => void>(),
    onRemove: vi.fn<(item: ProviderConfig) => void>(),
    onToggleEnabled: vi.fn<(item: ProviderConfig) => void>(),
  } satisfies ProviderSettingsMenuOptions;
}

function listMenu(config: ProviderConfig): ContextMenuItem[] {
  return getProviderSettingsMenuItems(config, {
    ...callbacks,
    includeSections: true,
  });
}

function findItem(items: ContextMenuItem[], label: string): ContextMenuItem {
  const item = items.find((candidate) => candidate.label === label);
  if (!item) throw new Error(`no menu item labeled ${label}`);
  return item;
}

function labelsOf(items: ContextMenuItem[]): string[] {
  return items.filter((item) => !item.hide).map((item) => item.label);
}

function manifest(
  overrides: Partial<TestProviderManifest> = {},
): TestProviderManifest {
  return {
    allow_disable: true,
    builtin: false,
    documentation: "https://example.com",
    ...overrides,
  };
}

function providerInstance(
  overrides: Partial<ProviderInstance> = {},
): ProviderInstance {
  return {
    available: true,
    domain: "spotify",
    instance_id: "spotify--1",
    is_streaming_provider: null,
    name: "Spotify",
    supported_features: [],
    type: ProviderType.MUSIC,
    ...overrides,
  };
}
