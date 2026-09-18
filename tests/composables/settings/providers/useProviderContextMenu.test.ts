import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { useProviderContextMenu } from "@/composables/settings/providers/useProviderContextMenu";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderFeature,
  type ProviderInstance,
  ProviderType,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../../fixtures/providerConfig";

const { apiMock, eventbusMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    providerManifests: {} as Record<string, TestProviderManifest>,
    startSync: vi.fn<MusicAssistantApi["startSync"]>(),
  },
  eventbusMock: { emit: vi.fn() },
  routerMock: { push: vi.fn() },
}));

interface TestProviderManifest {
  allow_disable: boolean;
  builtin: boolean;
  documentation: string | null;
}

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
vi.mock("@/helpers/utils", () => ({ openLinkInNewTab: vi.fn() }));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => routerMock,
}));

enableAutoUnmount(afterEach);

// useRouter() needs a host component instance to run in
function withComposable<T>(setup: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        result = setup();
        return () => null;
      },
    }),
  );
  return { result, unmount: () => wrapper.unmount() };
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

function pointerEvent(x = 5, y = 7): Event {
  return { clientX: x, clientY: y } as unknown as Event;
}

function lastMenuItems(): ContextMenuItem[] {
  const call = eventbusMock.emit.mock.calls
    .filter(([event]) => event === "contextmenu")
    .at(-1);
  if (!call) throw new Error("contextmenu was not emitted");
  return call[1].items;
}

function findItem(label: string): ContextMenuItem {
  const item = lastMenuItems().find((candidate) => candidate.label === label);
  if (!item) throw new Error(`no menu item labeled ${label}`);
  return item;
}

function labelsOf(items: ContextMenuItem[]): string[] {
  return items.map((item) => item.label);
}

function createCallbacks() {
  return {
    onAccess: vi.fn<(item: ProviderConfig) => void>(),
    onOptions: vi.fn<(instanceId: string) => void>(),
    onReconfigure: vi.fn<(instanceId: string) => void>(),
    onReload: vi.fn<(instanceId: string) => void>(),
    onRemove: vi.fn<(item: ProviderConfig) => void>(),
    onToggleEnabled: vi.fn<(item: ProviderConfig) => void>(),
  };
}

let callbacks: ReturnType<typeof createCallbacks>;

function mountMenu(
  overrides: {
    canConfigureAccess?: boolean;
    canReconfigure?: boolean;
    managesAllSources?: boolean;
  } = {},
) {
  return withComposable(() =>
    useProviderContextMenu({
      canConfigureAccess: () => overrides.canConfigureAccess ?? true,
      canReconfigure: () => overrides.canReconfigure ?? false,
      managesAllSources: () => overrides.managesAllSources ?? true,
      onAccess: callbacks.onAccess,
      onOptions: callbacks.onOptions,
      onReconfigure: callbacks.onReconfigure,
      onReload: callbacks.onReload,
      onRemove: callbacks.onRemove,
      onToggleEnabled: callbacks.onToggleEnabled,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  callbacks = createCallbacks();
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.providerManifests = { sonos: manifest(), spotify: manifest() };
  apiMock.startSync.mockResolvedValue([]);
});

describe("opening the menu", () => {
  it("warns and does not emit while the provider manifest has not loaded yet", () => {
    apiMock.providerManifests = {};
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = mountMenu();

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(warnSpy).toHaveBeenCalled();
    expect(eventbusMock.emit).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("emits the menu items at the pointer position", () => {
    const { result } = mountMenu();

    result.openMenu(pointerEvent(5, 7), providerConfig({ domain: "spotify" }));

    expect(eventbusMock.emit).toHaveBeenCalledWith("contextmenu", {
      items: expect.any(Array),
      posX: 5,
      posY: 7,
    });
  });
});

describe("menu item order", () => {
  it("lists the admin actions in order", () => {
    const { result } = mountMenu({
      canConfigureAccess: true,
      managesAllSources: true,
    });

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(labelsOf(lastMenuItems())).toEqual([
      "settings.options",
      "settings.source_access.action",
      "settings.disable",
      "settings.documentation",
      "settings.sync",
      "settings.remove_provider",
      "settings.reload",
    ]);
  });

  it("prepends reconfigure when the source may be reconfigured", () => {
    const { result } = mountMenu({ canReconfigure: true });

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(labelsOf(lastMenuItems())[0]).toBe("settings.reconfigure");
  });
});

describe("access item", () => {
  it("labels the access action for an admin", () => {
    const { result } = mountMenu({ managesAllSources: true });

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(findItem("settings.source_access.action")).toBeTruthy();
  });

  it("labels the access action for a member", () => {
    const { result } = mountMenu({ managesAllSources: false });

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(findItem("settings.source_access.share_action")).toBeTruthy();
  });

  it("hides the access item when access may not be configured", () => {
    const { result } = mountMenu({ canConfigureAccess: false });

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(findItem("settings.source_access.action").hide).toBe(true);
  });
});

describe("disable/enable item", () => {
  it("hides it for a member", () => {
    const { result } = mountMenu({ managesAllSources: false });

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "spotify", enabled: true }),
    );

    expect(findItem("settings.disable").hide).toBe(true);
  });

  it("disables it when the manifest disallows disabling", () => {
    apiMock.providerManifests.spotify = manifest({ allow_disable: false });
    const { result } = mountMenu();

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(findItem("settings.disable").disabled).toBe(true);
  });

  it.each([
    [true, "settings.disable"],
    [false, "settings.enable"],
  ])(
    "labels it by the source's enabled state (enabled=%s)",
    (enabled, expectedLabel) => {
      const { result } = mountMenu();

      result.openMenu(
        pointerEvent(),
        providerConfig({ domain: "spotify", enabled }),
      );

      const item = lastMenuItems().find(
        (candidate) =>
          candidate.label === "settings.disable" ||
          candidate.label === "settings.enable",
      );
      expect(item?.label).toBe(expectedLabel);
    },
  );
});

describe("sync item", () => {
  it("syncs just this source when managing all sources for an available music provider", () => {
    apiMock.getProvider.mockReturnValue(providerInstance({ available: true }));
    const { result } = mountMenu({ managesAllSources: true });
    const item = providerConfig({
      domain: "spotify",
      instance_id: "spotify--1",
      type: ProviderType.MUSIC,
    });

    result.openMenu(pointerEvent(), item);

    expect(findItem("settings.sync").hide).toBe(false);
    findItem("settings.sync").action?.();
    expect(apiMock.startSync).toHaveBeenCalledWith(undefined, ["spotify--1"]);
  });

  it("hides it for a member", () => {
    apiMock.getProvider.mockReturnValue(providerInstance({ available: true }));
    const { result } = mountMenu({ managesAllSources: false });

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "spotify", type: ProviderType.MUSIC }),
    );

    expect(findItem("settings.sync").hide).toBe(true);
  });

  it("hides it for an unavailable provider", () => {
    apiMock.getProvider.mockReturnValue(providerInstance({ available: false }));
    const { result } = mountMenu({ managesAllSources: true });

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "spotify", type: ProviderType.MUSIC }),
    );

    expect(findItem("settings.sync").hide).toBe(true);
  });

  it("hides it for a non-music source", () => {
    apiMock.getProvider.mockReturnValue(providerInstance({ available: true }));
    const { result } = mountMenu({ managesAllSources: true });

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "spotify", type: ProviderType.PLAYER }),
    );

    expect(findItem("settings.sync").hide).toBe(true);
  });
});

describe("remove item", () => {
  it("hides it for a builtin provider", () => {
    apiMock.providerManifests.spotify = manifest({ builtin: true });
    const { result } = mountMenu();

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(findItem("settings.remove_provider").hide).toBe(true);
  });

  it("shows it for a provider the user set up", () => {
    const { result } = mountMenu();

    result.openMenu(pointerEvent(), providerConfig({ domain: "spotify" }));

    expect(findItem("settings.remove_provider").hide).toBe(false);
  });
});

describe("player extras", () => {
  it("offers to view players for a player-type source with a running instance", () => {
    apiMock.getProvider.mockReturnValue(
      providerInstance({ instance_id: "sonos--1", type: ProviderType.PLAYER }),
    );
    const { result } = mountMenu();

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "sonos", type: ProviderType.PLAYER }),
    );

    findItem("settings.view_players").action?.();

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "playersettings",
      query: { providers: "sonos--1" },
    });
  });

  it("offers to add a group player when the instance supports it", () => {
    apiMock.getProvider.mockReturnValue(
      providerInstance({
        available: true,
        instance_id: "sonos--1",
        supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
        type: ProviderType.PLAYER,
      }),
    );
    const { result } = mountMenu();

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "sonos", type: ProviderType.PLAYER }),
    );

    findItem("settings.add_group_player").action?.();

    expect(routerMock.push).toHaveBeenCalledWith("/settings/addgroup/sonos--1");
  });

  it("omits both extras without a running provider instance", () => {
    apiMock.getProvider.mockReturnValue(undefined);
    const { result } = mountMenu();

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "sonos", type: ProviderType.PLAYER }),
    );

    const labels = labelsOf(lastMenuItems());
    expect(labels).not.toContain("settings.view_players");
    expect(labels).not.toContain("settings.add_group_player");
  });
});

describe("menu item actions", () => {
  it("options action calls onOptions with the instance id", () => {
    const { result } = mountMenu();

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
    );
    findItem("settings.options").action?.();

    expect(callbacks.onOptions).toHaveBeenCalledWith("spotify--1");
  });

  it("access action calls onAccess with the source", () => {
    const { result } = mountMenu();
    const item = providerConfig({
      domain: "spotify",
      instance_id: "spotify--1",
    });

    result.openMenu(pointerEvent(), item);
    findItem("settings.source_access.action").action?.();

    expect(callbacks.onAccess).toHaveBeenCalledWith(item);
  });

  it("disable action calls onToggleEnabled with the source", () => {
    const { result } = mountMenu();
    const item = providerConfig({
      domain: "spotify",
      enabled: true,
      instance_id: "spotify--1",
    });

    result.openMenu(pointerEvent(), item);
    findItem("settings.disable").action?.();

    expect(callbacks.onToggleEnabled).toHaveBeenCalledWith(item);
  });

  it("remove action calls onRemove with the source", () => {
    const { result } = mountMenu();
    const item = providerConfig({
      domain: "spotify",
      instance_id: "spotify--1",
    });

    result.openMenu(pointerEvent(), item);
    findItem("settings.remove_provider").action?.();

    expect(callbacks.onRemove).toHaveBeenCalledWith(item);
  });

  it("reload action calls onReload with the instance id", () => {
    const { result } = mountMenu();

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
    );
    findItem("settings.reload").action?.();

    expect(callbacks.onReload).toHaveBeenCalledWith("spotify--1");
  });

  it("reconfigure action calls onReconfigure with the instance id", () => {
    const { result } = mountMenu({ canReconfigure: true });

    result.openMenu(
      pointerEvent(),
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
    );
    findItem("settings.reconfigure").action?.();

    expect(callbacks.onReconfigure).toHaveBeenCalledWith("spotify--1");
  });
});
