import { useProviderSources } from "@/composables/settings/providers/useProviderSources";
import type { ProviderLabel } from "@/helpers/provider_labels";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ProviderOffering,
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
        { builtin: boolean; provides?: ProviderOffering[] }
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
let sourceLabels: Record<string, ProviderLabel[]> = {};
const getLabels = (config: ProviderConfig) =>
  sourceLabels[config.instance_id] ?? [];

function mountSources(
  overrides: { managesAllSources?: boolean; listType?: string } = {},
) {
  return withComposable(() =>
    useProviderSources({
      listType: () => overrides.listType ?? ProviderType.MUSIC,
      getProviderName,
      getLabels,
      isErrorStatus,
      managesAllSources: () => overrides.managesAllSources ?? true,
    }),
  );
}

type Sources = ReturnType<typeof mountSources>["result"];

/** The instance ids the list shows, in their order. */
function listedIds(result: Sources) {
  return result.list.value.filteredProviders.map(
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
    const { result } = mountSources({ listType: ProviderType.PLAYER });
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

    result.setSearchQuery("tid");

    expect(listedIds(result)).toEqual(["tidal--1"]);
  });

  it("ignores a search while the list offers none", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(2));
    const { result } = mountSources();
    await flushPromises();

    result.setSearchQuery("spotify 1");

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
  beforeEach(() => {
    apiMock.providerManifests = {
      airplay_receiver: {
        builtin: false,
        provides: [ProviderOffering.AUDIO_SOURCE],
      },
      // a manifest from a server that does not say what a provider offers
      lastfm_scrobble: { builtin: false },
      hass: { builtin: false, provides: [ProviderOffering.AUDIO_SOURCE] },
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
    const music = mountSources({ listType: ProviderType.MUSIC });
    const plugins = mountSources({ listType: ProviderType.PLUGIN });
    await flushPromises();

    expect(listedIds(music.result)).toEqual([
      "airplay_receiver--1",
      "airplay_receiver--2",
      "spotify--1",
    ]);
    expect(listedIds(plugins.result)).toEqual(["lastfm_scrobble--1"]);
  });

  it("lists a player provider offering audio sources with the players", async () => {
    // the Sendspin player provider names audio sources for its line-ins
    apiMock.providerManifests.sendspin = {
      builtin: false,
      provides: [ProviderOffering.AUDIO_SOURCE],
    };
    apiMock.getProviderConfigs.mockResolvedValue([
      providerConfig({
        domain: "sendspin",
        instance_id: "sendspin--1",
        type: ProviderType.PLAYER,
      }),
    ]);
    const music = mountSources({ listType: ProviderType.MUSIC });
    const players = mountSources({ listType: ProviderType.PLAYER });
    await flushPromises();

    expect(listedIds(music.result)).toEqual([]);
    expect(listedIds(players.result)).toEqual(["sendspin--1"]);
  });

  it("leaves a provider with a settings page of its own off every list", async () => {
    const lists = [ProviderType.MUSIC, ProviderType.PLUGIN].map(
      (listType) => mountSources({ listType }).result,
    );
    await flushPromises();

    expect(
      lists.flatMap((result) =>
        result.list.value.filteredProviders.map((config) => config.domain),
      ),
    ).not.toContain("hass");
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

    expect(result.list.value.labels).toEqual([
      "library",
      "radio",
      "podcasts",
      "live",
    ]);
    expect(result.list.value.labelFilter).toBeNull();
    expect(listedIds(result)).toHaveLength(3);
  });

  it("offers none while the listed sources have fewer than two labels between them", async () => {
    sourceLabels = { "spotify--1": ["library"], "radio--1": ["library"] };
    const { result } = mountSources();
    await flushPromises();

    expect(result.list.value.labels).toEqual([]);
  });

  it("narrows the list down to the sources offering the label picked, and back", async () => {
    const { result } = mountSources();
    await flushPromises();

    result.setLabelFilter("podcasts");
    expect(result.list.value.labelFilter).toBe("podcasts");
    expect(listedIds(result)).toEqual(["spotify--1"]);
    // the labels stay on offer while one is picked
    expect(result.list.value.labels).toHaveLength(4);

    result.setLabelFilter(null);
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

    result.setLabelFilter("live");
    expect(listedIds(result)).toEqual([
      "spotify--1",
      "spotify--3",
      "spotify--5",
      "spotify--7",
      "spotify--9",
    ]);

    result.setSearchQuery("spotify 3");
    expect(listedIds(result)).toEqual(["spotify--3"]);

    result.setSearchQuery("spotify 4");
    expect(listedIds(result)).toEqual([]);
    // a search that leaves nothing is no invitation to add a first source
    expect(result.list.value.showMusicEmptyState).toBe(false);
  });

  it("lets go of a label no listed source offers any more", async () => {
    const { result } = mountSources();
    await flushPromises();
    result.setLabelFilter("radio");

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

    expect(result.list.value.labelFilter).toBeNull();
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

    result.setLabelFilter("radio");

    expect(
      result.list.value.sections.map((section) => [
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

    expect(result.list.value.showSearch).toBe(true);
  });

  it("stays hidden below ten listed providers", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(9));
    const { result } = mountSources();
    await flushPromises();

    expect(result.list.value.showSearch).toBe(false);
  });

  it("clears the search query once the list drops below the threshold", async () => {
    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    const { result } = mountSources();
    await flushPromises();
    result.setSearchQuery("spotify 1");
    expect(result.list.value.searchQuery).not.toBe("");

    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(5));
    await result.loadItems();

    expect(result.list.value.showSearch).toBe(false);
    expect(result.list.value.searchQuery).toBe("");
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

    expect(result.list.value.sections.map((section) => section.key)).toEqual([
      "all",
    ]);
    expect(result.list.value.sections[0].items).toHaveLength(1);
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

    expect(result.list.value.sections.map((section) => section.key)).toEqual([
      "own",
      "shared",
    ]);
    expect(
      result.list.value.sections[0].items.map((item) => item.instance_id),
    ).toEqual(["spotify--own"]);
    expect(
      result.list.value.sections[1].items.map((item) => item.instance_id),
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

    expect(result.list.value.sections.map((section) => section.key)).toEqual([
      "own",
    ]);
  });
});

describe("showMusicEmptyState", () => {
  it("is true once loaded with no music sources and no search query", async () => {
    const { result } = mountSources();
    await flushPromises();

    expect(result.list.value.showMusicEmptyState).toBe(true);
  });

  it("stays false before the list has loaded", async () => {
    apiMock.getProviderConfigs.mockReturnValue(new Promise(() => {}));
    const { result } = mountSources();
    await flushPromises();

    expect(result.loaded.value).toBe(false);
    expect(result.list.value.showMusicEmptyState).toBe(false);
  });

  it("stays false while a search query is active", async () => {
    const { result } = mountSources();
    await flushPromises();

    apiMock.getProviderConfigs.mockResolvedValue(musicConfigs(10));
    await result.loadItems();
    result.setSearchQuery("nothing matches this");

    expect(listedIds(result)).toEqual([]);
    expect(result.list.value.showMusicEmptyState).toBe(false);
  });

  it("stays false for a type other than music", async () => {
    const { result } = mountSources({ listType: ProviderType.PLAYER });
    await flushPromises();

    expect(result.list.value.showMusicEmptyState).toBe(false);
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
