import {
  EventType,
  type ProviderManifest,
  ProviderSharing,
  ProviderType,
  type Scope,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { providerConfig } from "../../../../tests/fixtures/providerConfig";
import { providerManifest } from "../../../../tests/fixtures/providerManifest";
import {
  BUILTIN_ROLE_SCOPES,
  scopeChecker,
} from "../../../../tests/fixtures/scopes";
import { useProviderCatalog } from "./useProviderCatalog";

const { apiMock, hasScope, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, ProviderManifest>,
    providers: {} as Record<string, unknown>,
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  storeMock: { currentUser: { user_id: "jane" } },
  toastMock: { error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const MANIFESTS = [
  providerManifest({
    domain: "spotify",
    name: "Spotify",
    multi_instance: true,
  }),
  providerManifest({ domain: "plex", name: "Plex" }),
  providerManifest({
    domain: "sonos",
    name: "Sonos",
    type: ProviderType.PLAYER,
  }),
  providerManifest({
    domain: "builtin_player",
    name: "Built-in player",
    type: ProviderType.PLAYER,
    builtin: true,
  }),
];

const CONFIGS = [
  providerConfig({ domain: "spotify", instance_id: "spotify--a" }),
  providerConfig({
    domain: "builtin_player",
    type: ProviderType.PLAYER,
    instance_id: "builtin_player",
  }),
];

function mountCatalog() {
  let catalog!: ReturnType<typeof useProviderCatalog>;
  const wrapper = mount(
    defineComponent({
      setup() {
        catalog = useProviderCatalog();
        return () => h("div");
      },
    }),
  );
  return { wrapper, catalog };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.providerManifests = Object.fromEntries(
    MANIFESTS.map((manifest) => [manifest.domain, manifest]),
  );
  apiMock.getProviderConfigs.mockResolvedValue(CONFIGS);
  apiMock.subscribe.mockReturnValue(vi.fn());
});

describe("useProviderCatalog for an admin", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  });

  it("lists every type and marks what is set up", async () => {
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(undefined);
    expect(catalog.loaded.value).toBe(true);
    expect(
      catalog.entries.value.map((entry) => [
        entry.manifest.domain,
        entry.instances.length,
        entry.canAdd,
      ]),
    ).toEqual([
      ["plex", 0, true],
      ["sonos", 0, true],
      ["spotify", 1, true],
    ]);
  });

  it("lists the providers that ship with the server as installed", async () => {
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(
      catalog.installed.value.map((group) => [
        group.type.type,
        group.items.map((item) => item.name),
      ]),
    ).toEqual([
      [ProviderType.MUSIC, ["Spotify"]],
      [ProviderType.PLAYER, ["Built-in player"]],
    ]);
  });

  it("loads again when the providers change, and stops listening once gone", async () => {
    const unsubscribe = vi.fn();
    apiMock.subscribe.mockReturnValue(unsubscribe);
    const { wrapper, catalog } = mountCatalog();
    await flushPromises();
    expect(apiMock.subscribe).toHaveBeenCalledWith(
      EventType.PROVIDERS_UPDATED,
      expect.any(Function),
    );

    apiMock.getProviderConfigs.mockResolvedValue([
      ...CONFIGS,
      providerConfig({
        domain: "sonos",
        type: ProviderType.PLAYER,
        instance_id: "sonos--a",
      }),
    ]);
    await apiMock.subscribe.mock.calls[0][1]();
    await flushPromises();

    const sonos = catalog.entries.value.find(
      (entry) => entry.manifest.domain === "sonos",
    );
    expect(sonos?.canAdd).toBe(false);

    wrapper.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports a failing load", async () => {
    apiMock.getProviderConfigs.mockRejectedValue(new Error("refused"));
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: refused");
    expect(catalog.loaded.value).toBe(false);
    expect(catalog.failed.value).toBe(true);
  });

  it("loads again after a failing load", async () => {
    apiMock.getProviderConfigs.mockRejectedValueOnce(new Error("refused"));
    const { catalog } = mountCatalog();
    await flushPromises();

    await catalog.reload();

    expect(catalog.loaded.value).toBe(true);
    expect(catalog.failed.value).toBe(false);
  });
});

describe("useProviderCatalog for a member", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  });

  it("loads the music sources and offers only what a member may add", async () => {
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(ProviderType.MUSIC);
    expect(catalog.entries.value.map((entry) => entry.manifest.domain)).toEqual(
      ["spotify"],
    );
  });

  it("only counts its own sources as set up, and lists shared ones without managing them", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        domain: "spotify",
        instance_id: "spotify--own",
        access: {
          owner: "jane",
          sharing: ProviderSharing.PRIVATE,
          shared_users: [],
        },
      }),
      providerConfig({
        domain: "spotify",
        instance_id: "spotify--shared",
        access: {
          owner: null,
          sharing: ProviderSharing.EVERYONE,
          shared_users: [],
        },
      }),
    ]);
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(
      catalog.entries.value[0].instances.map((config) => config.instance_id),
    ).toEqual(["spotify--own"]);
    expect(
      catalog.installed.value[0].items.map((item) => [
        item.config.instance_id,
        item.manageable,
      ]),
    ).toEqual([
      ["spotify--own", true],
      ["spotify--shared", false],
    ]);
  });

  it("leaves the providers that ship with the server out of what is installed", async () => {
    const { catalog } = mountCatalog();
    await flushPromises();

    expect(catalog.installed.value.map((group) => group.type.type)).toEqual([
      ProviderType.MUSIC,
    ]);
  });
});
