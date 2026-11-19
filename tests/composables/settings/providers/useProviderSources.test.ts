import { useProviderSources } from "@/composables/settings/providers/useProviderSources";
import type { SourceLabel } from "@/helpers/source_labels";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  MediaType,
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
      providerManifests: {} as Record<
        string,
        { builtin: boolean; media_types?: MediaType[] }
      >,
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
// what each source offers, by its instance id; nothing by default
let sourceLabels: Record<string, SourceLabel[]> = {};
const getSourceLabels = (config: ProviderConfig) =>
  sourceLabels[config.instance_id] ?? [];

function mountSources(
  overrides: { managesAllSources?: boolean; listTypes?: string[] } = {},
) {
  return withComposable(() =>
    useProviderSources({
      listTypes: () => overrides.listTypes ?? [ProviderType.MUSIC],
      getProviderName,
      getSourceLabels,
      isErrorStatus,
      managesAllSources: () => overrides.managesAllSources ?? true,
    }),
  );
}

type Sources = ReturnType<typeof mountSources>["result"];

/** The only list of a page showing a single one. */
function onlyList(result: Sources) {
  return result.lists.value[0];
}

/** The instance ids a list shows, in their order. */
function listedIds(result: Sources, index = 0) {
  return result.lists.value[index].filteredProviders.map(
    (config) => config.instance_id,
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
  sourceLabels = {};
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

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(
      undefined,
      undefined,
      true,
    );
    expect(result.loaded.value).toBe(true);
  });

  it("loads only music sources for a role that manages its own sources", async () => {
    const { result } = mountSources({ managesAllSources: false });
    await flushPromises();

    await result.loadItems();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(
      ProviderType.MUSIC,
      undefined,
      true,
    );
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
  it("keeps only the music sources on their list", async () => {
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

    expect(listedIds(result)).toEqual(["spotify--1"]);
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
    const { result } = mountSources({ listTypes: [ProviderType.PLAYER] });
    await flushPromises();

    expect(listedIds(result)).toEqual(["sonos--1"]);
  });

  it("excludes a builtin provider for a role that manages only its own sources", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
      providerConfig({ domain: "library", instance_id: "library--1" }),
    ]);
    const { result } = mountSources({ managesAllSources: false });
    await flushPromises();

    expect(listedIds(result)).toEqual(["spotify--1"]);
  });

  it("keeps a builtin provider for a role that manages all sources", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
      providerConfig({ domain: "library", instance_id: "library--1" }),
    ]);
    const { result } = mountSources({ managesAllSources: true });
    await flushPromises();

    // alphabetical by name, which falls back to the domain here
    expect(listedIds(result)).toEqual(["library--1", "spotify--1"]);
  });

  it("narrows the list by the search query", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      ...musicConfigs(9),
      providerConfig({
        domain: "tidal",
        instance_id: "tidal--1",
        name: "Tidal",
      }),
    ]);
    const { result } = mountSources();
    await flushPromises();

    result.setSearchQuery(ProviderType.MUSIC, "tid");

    expect(listedIds(result)).toEqual(["tidal--1"]);
  });

  it("ignores a search while the list offers none", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(2));
    const { result } = mountSources();
    await flushPromises();

    result.setSearchQuery(ProviderType.MUSIC, "spotify 1");

    expect(listedIds(result)).toHaveLength(2);
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

    expect(listedIds(result)).toEqual(["c--1", "a--1", "b--1"]);
  });
});

describe("the audio sources", () => {
  const PAGE_LISTS = [ProviderType.MUSIC, ProviderType.PLUGIN];

  beforeEach(() => {
    apiMock.providerManifests = {
      airplay_receiver: {
        builtin: false,
        media_types: [MediaType.AUDIO_SOURCE],
      },
      // a manifest from a server that does not say what a provider offers
      lastfm_scrobble: { builtin: false },
      hass: { builtin: false, media_types: [MediaType.AUDIO_SOURCE] },
      spotify: { builtin: false },
    };
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
      providerConfig({
        domain: "airplay_receiver",
        instance_id: "airplay_receiver--1",
        type: ProviderType.PLUGIN,
      }),
      // not loaded, so only its manifest tells what it offers
      providerConfig({
        domain: "airplay_receiver",
        enabled: false,
        instance_id: "airplay_receiver--2",
        status: ProviderStatus.DISABLED,
        type: ProviderType.PLUGIN,
      }),
      providerConfig({
        domain: "lastfm_scrobble",
        instance_id: "lastfm_scrobble--1",
        type: ProviderType.PLUGIN,
      }),
      providerConfig({
        domain: "hass",
        instance_id: "hass",
        type: ProviderType.PLUGIN,
      }),
    ]);
  });

  it("lists a plugin offering audio sources with the music sources, not with the plugins", async () => {
    const { result } = mountSources({ listTypes: PAGE_LISTS });
    await flushPromises();

    expect(result.lists.value.map((list) => list.type)).toEqual(PAGE_LISTS);
    expect(listedIds(result, 0)).toEqual([
      "airplay_receiver--1",
      "airplay_receiver--2",
      "spotify--1",
    ]);
    expect(listedIds(result, 1)).toEqual(["lastfm_scrobble--1"]);
  });

  it("lists a player provider offering audio sources with the players", async () => {
    // the Sendspin player provider names audio sources for its line-ins
    apiMock.providerManifests.sendspin = {
      builtin: false,
      media_types: [MediaType.AUDIO_SOURCE],
    };
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        domain: "sendspin",
        instance_id: "sendspin--1",
        type: ProviderType.PLAYER,
      }),
    ]);
    const { result } = mountSources({
      listTypes: [ProviderType.MUSIC, ProviderType.PLAYER],
    });
    await flushPromises();

    expect(listedIds(result, 0)).toEqual([]);
    expect(listedIds(result, 1)).toEqual(["sendspin--1"]);
  });

  it("leaves a provider with a settings page of its own off every list", async () => {
    const { result } = mountSources({ listTypes: PAGE_LISTS });
    await flushPromises();

    expect(
      result.lists.value.flatMap((list) =>
        list.filteredProviders.map((config) => config.domain),
      ),
    ).not.toContain("hass");
  });

  it("searches each list on its own", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      ...musicConfigs(10),
      ...Array.from({ length: 10 }, (_, index) =>
        providerConfig({
          domain: "lastfm_scrobble",
          instance_id: `lastfm_scrobble--${index}`,
          name: `Last.fm ${index}`,
          type: ProviderType.PLUGIN,
        }),
      ),
    ]);
    const { result } = mountSources({ listTypes: PAGE_LISTS });
    await flushPromises();

    result.setSearchQuery(ProviderType.PLUGIN, "last.fm 3");

    expect(listedIds(result, 0)).toHaveLength(10);
    expect(listedIds(result, 1)).toEqual(["lastfm_scrobble--3"]);
  });
});

describe("the label filter", () => {
  beforeEach(() => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        domain: "spotify",
        instance_id: "spotify--1",
        name: "Spotify",
      }),
      providerConfig({
        domain: "spotify",
        instance_id: "radio--1",
        name: "Radio Browser",
      }),
      providerConfig({
        domain: "spotify",
        instance_id: "connect--1",
        name: "Spotify Connect",
      }),
    ]);
    sourceLabels = {
      "spotify--1": ["library", "podcasts"],
      "radio--1": ["radio"],
      "connect--1": ["live"],
    };
  });

  it("offers the labels the listed sources have, with all of them listed", async () => {
    const { result } = mountSources();
    await flushPromises();

    expect(onlyList(result).labels).toEqual([
      "library",
      "radio",
      "podcasts",
      "live",
    ]);
    expect(onlyList(result).labelFilter).toBeNull();
    expect(listedIds(result)).toHaveLength(3);
  });

  it("offers none while the listed sources have fewer than two labels between them", async () => {
    sourceLabels = { "spotify--1": ["library"], "radio--1": ["library"] };
    const { result } = mountSources();
    await flushPromises();

    expect(onlyList(result).labels).toEqual([]);
  });

  it("narrows the list down to the sources offering the label picked, and back", async () => {
    const { result } = mountSources();
    await flushPromises();

    result.setLabelFilter(ProviderType.MUSIC, "podcasts");
    expect(onlyList(result).labelFilter).toBe("podcasts");
    expect(listedIds(result)).toEqual(["spotify--1"]);
    // the labels stay on offer while one is picked
    expect(onlyList(result).labels).toHaveLength(4);

    result.setLabelFilter(ProviderType.MUSIC, null);
    expect(listedIds(result)).toHaveLength(3);
  });

  it("combines the label with the search", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    sourceLabels = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `spotify--${index}`,
        index % 2 ? ["live"] : ["library"],
      ]),
    );
    const { result } = mountSources();
    await flushPromises();

    result.setLabelFilter(ProviderType.MUSIC, "live");
    expect(listedIds(result)).toEqual([
      "spotify--1",
      "spotify--3",
      "spotify--5",
      "spotify--7",
      "spotify--9",
    ]);

    result.setSearchQuery(ProviderType.MUSIC, "spotify 3");
    expect(listedIds(result)).toEqual(["spotify--3"]);

    result.setSearchQuery(ProviderType.MUSIC, "spotify 4");
    expect(listedIds(result)).toEqual([]);
    // a search that leaves nothing is no invitation to add a first source
    expect(onlyList(result).showMusicEmptyState).toBe(false);
  });

  it("lets go of a label no listed source offers any more", async () => {
    const { result } = mountSources();
    await flushPromises();
    result.setLabelFilter(ProviderType.MUSIC, "radio");

    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        domain: "spotify",
        instance_id: "spotify--1",
        name: "Spotify",
      }),
      providerConfig({
        domain: "spotify",
        instance_id: "connect--1",
        name: "Spotify Connect",
      }),
    ]);
    await result.loadItems();

    expect(onlyList(result).labelFilter).toBeNull();
    expect(listedIds(result)).toEqual(["spotify--1", "connect--1"]);
  });

  it("narrows a member's own and shared sources down alike", async () => {
    storeMock.currentUser = user({ user_id: "user-me" });
    const access = (owner: string) => ({
      owner,
      shared_users: ["user-me"],
      sharing: ProviderSharing.SELECTED,
    });
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        access: access("user-me"),
        domain: "spotify",
        instance_id: "spotify--own",
      }),
      providerConfig({
        access: access("user-me"),
        domain: "spotify",
        instance_id: "radio--own",
      }),
      providerConfig({
        access: access("user-other"),
        domain: "spotify",
        instance_id: "spotify--shared",
      }),
      providerConfig({
        access: access("user-other"),
        domain: "spotify",
        instance_id: "radio--shared",
      }),
    ]);
    sourceLabels = {
      "spotify--own": ["library"],
      "radio--own": ["radio"],
      "spotify--shared": ["library"],
      "radio--shared": ["radio"],
    };
    const { result } = mountSources({ managesAllSources: false });
    await flushPromises();

    result.setLabelFilter(ProviderType.MUSIC, "radio");

    expect(
      onlyList(result).sections.map((section) => [
        section.key,
        section.items.map((item) => item.instance_id),
      ]),
    ).toEqual([
      ["own", ["radio--own"]],
      ["shared", ["radio--shared"]],
    ]);
  });
});

describe("showSearch", () => {
  it("appears from ten listed providers on", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    const { result } = mountSources();
    await flushPromises();

    expect(onlyList(result).showSearch).toBe(true);
  });

  it("stays hidden below ten listed providers", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(9));
    const { result } = mountSources();
    await flushPromises();

    expect(onlyList(result).showSearch).toBe(false);
  });

  it("clears the search query once the list drops below the threshold", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    const { result } = mountSources();
    await flushPromises();
    result.setSearchQuery(ProviderType.MUSIC, "spotify 1");
    expect(onlyList(result).searchQuery).not.toBe("");

    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(5));
    await result.loadItems();

    expect(onlyList(result).showSearch).toBe(false);
    expect(onlyList(result).searchQuery).toBe("");
    expect(listedIds(result)).toHaveLength(5);
  });
});

describe("sections", () => {
  it("lists every source in a single section for a role that manages all sources", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({ domain: "spotify", instance_id: "spotify--1" }),
    ]);
    const { result } = mountSources({ managesAllSources: true });
    await flushPromises();

    expect(onlyList(result).sections.map((section) => section.key)).toEqual([
      "all",
    ]);
    expect(onlyList(result).sections[0].items).toHaveLength(1);
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

    expect(onlyList(result).sections.map((section) => section.key)).toEqual([
      "own",
      "shared",
    ]);
    expect(
      onlyList(result).sections[0].items.map((item) => item.instance_id),
    ).toEqual(["spotify--own"]);
    expect(
      onlyList(result).sections[1].items.map((item) => item.instance_id),
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

    expect(onlyList(result).sections.map((section) => section.key)).toEqual([
      "own",
    ]);
  });
});

describe("showMusicEmptyState", () => {
  it("is true once loaded with no music sources and no search query", async () => {
    const { result } = mountSources();
    await flushPromises();

    expect(onlyList(result).showMusicEmptyState).toBe(true);
  });

  it("stays false before the list has loaded", async () => {
    apiMock.getProviderConfigs.mockReturnValue(new Promise(() => {}));
    const { result } = mountSources();
    await flushPromises();

    expect(result.loaded.value).toBe(false);
    expect(onlyList(result).showMusicEmptyState).toBe(false);
  });

  it("stays false while a search query is active", async () => {
    const { result } = mountSources();
    await flushPromises();

    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    await result.loadItems();
    result.setSearchQuery(ProviderType.MUSIC, "nothing matches this");

    expect(listedIds(result)).toEqual([]);
    expect(onlyList(result).showMusicEmptyState).toBe(false);
  });

  it("stays false for a type other than music", async () => {
    const { result } = mountSources({ listTypes: [ProviderType.PLAYER] });
    await flushPromises();

    expect(onlyList(result).showMusicEmptyState).toBe(false);
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
      "settings.remove_provider_confirm_music",
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
    expect(listedIds(result)).toHaveLength(1);

    result.removeSource(config);
    await confirmRemoval();

    expect(apiMock.removeProviderConfig).toHaveBeenCalledWith("spotify--1");
    expect(listedIds(result)).toHaveLength(0);
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
    expect(listedIds(result)).toHaveLength(1);
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
