import { useProviderSources } from "@/composables/settings/providers/useProviderSources";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderSharing,
  ProviderStatus,
  ProviderType,
  type User,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../../fixtures/providerConfig";
import { user } from "../../../fixtures/user";

const { apiMock, eventbusMock, i18nMock, storeMock, toastMock } = vi.hoisted(
  () => ({
    apiMock: {
      getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
      providerManifests: {} as Record<string, { builtin: boolean }>,
      providers: {} as Record<string, unknown>,
      removeProviderConfig: vi.fn<MusicAssistantApi["removeProviderConfig"]>(),
      subscribe: vi.fn<MusicAssistantApi["subscribe"]>(),
    },
    eventbusMock: { emit: vi.fn() },
    i18nMock: { $t: vi.fn((key: string) => key) },
    storeMock: { currentUser: undefined as User | undefined },
    toastMock: { error: vi.fn() },
  }),
);

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
vi.mock("@/plugins/i18n", () => i18nMock);
vi.mock("vue-sonner", () => ({ toast: toastMock }));

enableAutoUnmount(afterEach);

// onMounted/watch need a host component instance to run in
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

const getProviderName = (config: ProviderConfig) =>
  config.name ?? config.domain;
const isErrorStatus = (status?: ProviderStatus | null) =>
  status === ProviderStatus.ERROR;

function mountSources(
  overrides: { managesAllSources?: boolean; currentType?: string } = {},
) {
  return withComposable(() =>
    useProviderSources({
      currentType: () => overrides.currentType,
      getProviderName,
      isErrorStatus,
      managesAllSources: () => overrides.managesAllSources ?? true,
    }),
  );
}

/** The given number of loaded music sources, each with its own name. */
function musicConfigs(count: number): ProviderConfig[] {
  return Array.from({ length: count }, (_, index) =>
    providerConfig({
      domain: "spotify",
      instance_id: `spotify--${index}`,
      name: `Spotify ${index}`,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getProviderConfigs.mockResolvedValue([]);
  apiMock.providerManifests = {
    library: { builtin: true },
    spotify: { builtin: false },
  };
  // truthy so the immediate watch on api.providers loads on mount, like the real api
  apiMock.providers = {};
  apiMock.removeProviderConfig.mockResolvedValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  storeMock.currentUser = undefined;
});

describe("loadItems", () => {
  it("does nothing while the provider manifests have not loaded yet", async () => {
    apiMock.providerManifests = {};
    const { result } = mountSources();
    await flushPromises();

    await result.loadItems();

    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
    expect(result.loaded.value).toBe(false);
  });

  it("loads every provider type for a role that manages all sources", async () => {
    const { result } = mountSources({ managesAllSources: true });
    await flushPromises();

    await result.loadItems();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(undefined);
    expect(result.loaded.value).toBe(true);
  });

  it("loads only music sources for a role that manages its own sources", async () => {
    const { result } = mountSources({ managesAllSources: false });
    await flushPromises();

    await result.loadItems();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(ProviderType.MUSIC);
  });

  it("toasts when the load fails", async () => {
    apiMock.getProviderConfigs.mockRejectedValue(new Error("offline"));
    const { result } = mountSources();
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: offline");
    expect(result.loaded.value).toBe(false);
  });
});

describe("filteredProviders", () => {
  it("keeps only music sources by default", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
      providerConfig({
        domain: "sonos",
        instance_id: "sonos--1",
        type: ProviderType.PLAYER,
      }),
    ]);
    const { result } = mountSources();
    await flushPromises();

    expect(result.filteredProviders.value.map((c) => c.instance_id)).toEqual([
      "spotify--1",
    ]);
  });

  it("keeps only the given type", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
      providerConfig({
        domain: "sonos",
        instance_id: "sonos--1",
        type: ProviderType.PLAYER,
      }),
    ]);
    const { result } = mountSources({ currentType: ProviderType.PLAYER });
    await flushPromises();

    expect(result.filteredProviders.value.map((c) => c.instance_id)).toEqual([
      "sonos--1",
    ]);
  });

  it("excludes a builtin provider for a role that manages only its own sources", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
      providerConfig({ domain: "library", instance_id: "library--1" }),
    ]);
    const { result } = mountSources({ managesAllSources: false });
    await flushPromises();

    expect(result.filteredProviders.value.map((c) => c.instance_id)).toEqual([
      "spotify--1",
    ]);
  });

  it("keeps a builtin provider for a role that manages all sources", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
      providerConfig({ domain: "library", instance_id: "library--1" }),
    ]);
    const { result } = mountSources({ managesAllSources: true });
    await flushPromises();

    // alphabetical by name, which falls back to the domain here
    expect(result.filteredProviders.value.map((c) => c.instance_id)).toEqual([
      "library--1",
      "spotify--1",
    ]);
  });

  it("narrows the list by the search query", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        domain: "spotify",
        instance_id: "spotify--1",
        name: "Spotify",
      }),
      providerConfig({
        domain: "tidal",
        instance_id: "tidal--1",
        name: "Tidal",
      }),
    ]);
    const { result } = mountSources();
    await flushPromises();

    result.searchQuery.value = "tid";

    expect(result.filteredProviders.value.map((c) => c.instance_id)).toEqual([
      "tidal--1",
    ]);
  });

  it("sorts sources needing attention before the rest, then alphabetically", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        domain: "a_provider",
        instance_id: "a--1",
        name: "Alpha",
        status: ProviderStatus.LOADED,
      }),
      providerConfig({
        domain: "b_provider",
        instance_id: "b--1",
        name: "Bravo",
        status: ProviderStatus.LOADED,
      }),
      providerConfig({
        domain: "c_provider",
        instance_id: "c--1",
        name: "Charlie",
        status: ProviderStatus.ERROR,
      }),
    ]);
    const { result } = mountSources();
    await flushPromises();

    expect(result.filteredProviders.value.map((c) => c.instance_id)).toEqual([
      "c--1",
      "a--1",
      "b--1",
    ]);
  });
});

describe("showSearch", () => {
  it("appears from ten listed providers on", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    const { result } = mountSources();
    await flushPromises();

    expect(result.showSearch.value).toBe(true);
  });

  it("stays hidden below ten listed providers", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(9));
    const { result } = mountSources();
    await flushPromises();

    expect(result.showSearch.value).toBe(false);
  });

  it("clears the search query once the list drops below the threshold", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    const { result } = mountSources();
    await flushPromises();
    result.searchQuery.value = "spotify 1";
    expect(result.searchQuery.value).not.toBe("");

    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(5));
    await result.loadItems();

    expect(result.showSearch.value).toBe(false);
    expect(result.searchQuery.value).toBe("");
  });
});

describe("sections", () => {
  it("lists every source in a single section for a role that manages all sources", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
    ]);
    const { result } = mountSources({ managesAllSources: true });
    await flushPromises();

    expect(result.sections.value.map((section) => section.key)).toEqual([
      "all",
    ]);
    expect(result.sections.value[0].items).toHaveLength(1);
  });

  it("splits a member's own sources from the ones shared with it", async () => {
    storeMock.currentUser = user({ user_id: "user-me" });
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        access: {
          owner: "user-me",
          shared_users: [],
          sharing: ProviderSharing.PRIVATE,
        },
        domain: "spotify",
        instance_id: "spotify--own",
      }),
      providerConfig({
        access: {
          owner: "user-other",
          shared_users: ["user-me"],
          sharing: ProviderSharing.SELECTED,
        },
        domain: "spotify",
        instance_id: "spotify--other",
      }),
    ]);
    const { result } = mountSources({ managesAllSources: false });
    await flushPromises();

    expect(result.sections.value.map((section) => section.key)).toEqual([
      "own",
      "shared",
    ]);
    expect(
      result.sections.value[0].items.map((item) => item.instance_id),
    ).toEqual(["spotify--own"]);
    expect(
      result.sections.value[1].items.map((item) => item.instance_id),
    ).toEqual(["spotify--other"]);
  });

  it("drops the shared section when every source belongs to the member", async () => {
    storeMock.currentUser = user({ user_id: "user-me" });
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        access: {
          owner: "user-me",
          shared_users: [],
          sharing: ProviderSharing.PRIVATE,
        },
        domain: "spotify",
        instance_id: "spotify--own",
      }),
    ]);
    const { result } = mountSources({ managesAllSources: false });
    await flushPromises();

    expect(result.sections.value.map((section) => section.key)).toEqual([
      "own",
    ]);
  });
});

describe("showMusicEmptyState", () => {
  it("is true once loaded with no music sources and no search query", async () => {
    const { result } = mountSources();
    await flushPromises();

    expect(result.showMusicEmptyState.value).toBe(true);
  });

  it("stays false before the list has loaded", async () => {
    apiMock.getProviderConfigs.mockReturnValue(new Promise(() => {}));
    const { result } = mountSources();
    await flushPromises();

    expect(result.loaded.value).toBe(false);
    expect(result.showMusicEmptyState.value).toBe(false);
  });

  it("stays false while a search query is active", async () => {
    const { result } = mountSources();
    await flushPromises();

    result.searchQuery.value = "spotify";

    expect(result.showMusicEmptyState.value).toBe(false);
  });

  it("stays false for a type other than music", async () => {
    const { result } = mountSources({ currentType: ProviderType.PLAYER });
    await flushPromises();

    expect(result.showMusicEmptyState.value).toBe(false);
  });
});

describe("removeSource", () => {
  it("asks for confirmation with a message built from the provider name", async () => {
    const { result } = mountSources();
    await flushPromises();
    const config = providerConfig({
      domain: "spotify",
      instance_id: "spotify--1",
      name: "My Spotify",
    });

    result.removeSource(config);

    expect(eventbusMock.emit).toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.objectContaining({ onConfirm: expect.any(Function) }),
    );
    expect(i18nMock.$t).toHaveBeenCalledWith(
      "settings.remove_provider_confirm",
      ["My Spotify"],
    );
    expect(apiMock.removeProviderConfig).not.toHaveBeenCalled();
  });

  it("drops the source from the list once the server confirms removal", async () => {
    const config = providerConfig({
      domain: "spotify",
      instance_id: "spotify--1",
      name: "My Spotify",
    });
    apiMock.getProviderConfigs.mockResolvedValue([config]);
    const { result } = mountSources();
    await flushPromises();
    expect(result.filteredProviders.value).toHaveLength(1);

    result.removeSource(config);
    await confirmRemoval();

    expect(apiMock.removeProviderConfig).toHaveBeenCalledWith("spotify--1");
    expect(result.filteredProviders.value).toHaveLength(0);
  });

  it("keeps the source listed and toasts when removal fails", async () => {
    const config = providerConfig({
      domain: "spotify",
      instance_id: "spotify--1",
      name: "My Spotify",
    });
    apiMock.getProviderConfigs.mockResolvedValue([config]);
    apiMock.removeProviderConfig.mockRejectedValue(new Error("nope"));
    const { result } = mountSources();
    await flushPromises();

    result.removeSource(config);
    await confirmRemoval();

    expect(toastMock.error).toHaveBeenCalledWith("Error: nope");
    expect(result.filteredProviders.value).toHaveLength(1);
  });
});

// invokes the onConfirm handed to the most recent deleteConfirmationDialog emit
async function confirmRemoval() {
  const call = eventbusMock.emit.mock.calls
    .filter(([event]) => event === "deleteConfirmationDialog")
    .at(-1);
  if (!call) throw new Error("deleteConfirmationDialog was not emitted");
  await call[1].onConfirm();
  await flushPromises();
}
