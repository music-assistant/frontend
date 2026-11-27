import { SETTINGS_COLORS } from "@/helpers/settings_colors";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import Catalog from "@/views/settings/Catalog.vue";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  type CatalogRecommendation,
  CatalogRecommendationReason,
  type CommunityProvider,
  CommunityProviderState,
  type CoreConfig,
  EventType,
  ProviderOffering,
  type ProviderConfig,
  ProviderIconVariant,
  type ProviderManifest,
  ProviderSharing,
  ProviderStage,
  ProviderTier,
  ProviderType,
  type Scope,
  SharedPlayback,
} from "@/plugins/api/interfaces";
import {
  type ContextMenuDialogEvent,
  type DeleteConfirmationDialogEvent,
  eventbus,
} from "@/plugins/eventbus";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { defineComponent, h, reactive } from "vue";
import {
  COMMUNITY_ICON,
  communityProvider,
} from "../fixtures/communityProvider";
import { providerConfig } from "../fixtures/providerConfig";
import { providerManifest } from "../fixtures/providerManifest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, hasScope, routeMock, routerMock, storeMock, toastMock } =
  vi.hoisted(() => ({
    apiMock: {
      providerManifests: {} as Record<string, ProviderManifest>,
      providerIcons: {} as Record<string, string | null>,
      providers: {} as Record<string, unknown>,
      serverInfo: {
        value: undefined as { server_version: string } | undefined,
      },
      // the connection: reactive in each test, as the api's own
      state: { value: "initialized" },
      getProviderConfigs: vi.fn(),
      getProvider: vi.fn(),
      getProviderIcon: vi.fn(),
      getProviderName: vi.fn(),
      subscribe: vi.fn(),
      getCoreConfig: vi.fn(),
      saveCoreConfig: vi.fn(),
      getCatalogRecommendations: vi.fn(),
      getCommunityProviders: vi.fn(),
      refreshCommunityProviders: vi.fn(),
      installCommunityProvider: vi.fn(),
      removeCommunityProvider: vi.fn(),
      updateCommunityProviders: vi.fn(),
      dismissCommunityNotice: vi.fn(),
      fetchProviderManifests: vi.fn(),
      updateUser: vi.fn(),
    },
    hasScope: vi.fn<(scope: Scope) => boolean>(),
    routeMock: { query: {} as Record<string, string> },
    routerMock: { replace: vi.fn() },
    storeMock: {
      isTouchscreen: true,
      currentUser: {
        user_id: "jane",
        preferences: {} as Record<string, unknown>,
      },
    },
    toastMock: { success: vi.fn(), error: vi.fn() },
  }));

// a link that shows where it leads, so a jump can be asserted
const RouterLinkStub = vi.hoisted(() => ({
  name: "RouterLink",
  props: ["to"],
  template: `<a :data-to="JSON.stringify(to)"><slot /></a>`,
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
  ConnectionState: {
    INITIALIZED: "initialized",
    RECONNECTING: "reconnecting",
  },
}));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
// a translation shows its key followed by the values it names
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, named?: Record<string, unknown>) =>
    [key, ...Object.values(named ?? {})].join(" "),
  canonicalizeLocale: (locale: string) => locale,
  i18n: { global: { locale: { value: "en-US" } } },
}));
vi.mock("vue-router", () => ({
  RouterLink: RouterLinkStub,
  useRoute: () => routeMock,
  useRouter: () => routerMock,
}));

// renders the slots a translation fills in, after its key
const I18nTStub = defineComponent({
  props: { keypath: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h("p", [props.keypath, slots.link?.(), slots.maintainers?.()]);
  },
});

// a dialog keeps document-level focus trap listeners, so tear it down even
// when an assertion fails
enableAutoUnmount(afterEach);

const MANIFESTS = [
  providerManifest({
    domain: "spotify",
    name: "Spotify",
    description: "Stream from Spotify",
    multi_instance: true,
    codeowners: ["@music-assistant"],
    documentation: "https://music-assistant.io/music-providers/spotify/",
  }),
  providerManifest({
    domain: "soundcloud",
    name: "SoundCloud",
    stage: ProviderStage.BETA,
    codeowners: ["@jane"],
    credits: ["[soundcloudpy](https://example.org)"],
  }),
  providerManifest({
    domain: "chromecast",
    name: "Chromecast",
    type: ProviderType.PLAYER,
  }),
  providerManifest({
    domain: "sonos",
    name: "Sonos",
    type: ProviderType.PLAYER,
  }),
];

// an icon with one clear colour, as the server encodes it
const SVG_GREEN = `data:image/svg+xml;base64,${btoa(
  '<svg><circle fill="#1DB954"/><path fill="#fff"/></svg>',
)}`;

// an icon drawn in white only, as Bose SoundTouch's
const SVG_WHITE = `data:image/svg+xml;base64,${btoa(
  '<svg><path style="fill:#ffffff"/></svg>',
)}`;

let configs: ProviderConfig[] = [];
// what the server keeps of the community catalog
let communityEnabled = false;
let communityAutoUpdate = false;
let community: CommunityProvider[] = [];
// what the server suggests
let recommendations: CatalogRecommendation[] = [];
let confirmations: DeleteConfirmationDialogEvent[] = [];
const onConfirmation = (event: DeleteConfirmationDialogEvent) =>
  confirmations.push(event);
let menus: ContextMenuDialogEvent[] = [];
const onMenu = (event: ContextMenuDialogEvent) => menus.push(event);

beforeEach(() => {
  vi.resetAllMocks();
  routeMock.query = {};
  // reactive like the store's own, so a saved preference shows at once
  storeMock.currentUser = reactive({ user_id: "jane", preferences: {} });
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  // reactive like the api's own, so a manifest registered later shows
  apiMock.providerManifests = reactive(
    Object.fromEntries(
      MANIFESTS.map((manifest) => [manifest.domain, manifest]),
    ),
  );
  apiMock.providerIcons = reactive({});
  apiMock.state = reactive({ value: "initialized" });
  configs = [
    providerConfig({
      domain: "chromecast",
      type: ProviderType.PLAYER,
      instance_id: "chromecast--a",
    }),
    providerConfig({ domain: "spotify", instance_id: "spotify--a" }),
  ];
  // the server only hands a member its music sources
  apiMock.getProviderConfigs.mockImplementation(
    async (type?: ProviderType, domain?: string) =>
      configs.filter(
        (config) =>
          (!type || config.type === type) &&
          (!domain || config.domain === domain),
      ),
  );
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  communityEnabled = false;
  communityAutoUpdate = false;
  community = [];
  apiMock.serverInfo.value = undefined;
  recommendations = [
    suggest("spotify", CatalogRecommendationReason.POPULAR),
    suggest("sonos", CatalogRecommendationReason.POPULAR),
  ];
  apiMock.getCatalogRecommendations.mockImplementation(
    async () => recommendations,
  );
  // the server offers what is not installed only while the switch is on
  apiMock.getCommunityProviders.mockImplementation(async () =>
    community.filter(
      (provider) =>
        communityEnabled || provider.state !== CommunityProviderState.AVAILABLE,
    ),
  );
  apiMock.getCoreConfig.mockImplementation(async () =>
    communityCoreConfig(communityEnabled),
  );
  apiMock.saveCoreConfig.mockImplementation(
    async (_domain: string, values: Record<string, boolean>) => {
      communityEnabled = values.community_catalog_enabled ?? communityEnabled;
      communityAutoUpdate = values.auto_update ?? communityAutoUpdate;
      return communityCoreConfig(communityEnabled);
    },
  );
  confirmations = [];
  eventbus.on("deleteConfirmationDialog", onConfirmation);
  menus = [];
  eventbus.on("contextmenu", onMenu);
  document.body.innerHTML = "";
});

afterEach(() => {
  eventbus.off("deleteConfirmationDialog", onConfirmation);
  eventbus.off("contextmenu", onMenu);
});

describe("Catalog", () => {
  it("heads the Marketplace with its own header, in the orange of its banner, with the search beside the title", async () => {
    const wrapper = await mountCatalog();

    const header = wrapper.getComponent(SettingsPageHeader);
    expect(header.props("page")).toBe("catalog");
    expect(header.get("h1").text()).toBe("settings.catalog.title");
    expect(
      header.get('[data-testid="settings-page-icon"]').attributes("style"),
    ).toContain(`color: ${SETTINGS_COLORS.orange}`);
    expect(
      header.get("[data-slot='input-group-control']").attributes("placeholder"),
    ).toBe("settings.catalog.search");
  });

  it("offers Discover, a section per type with something to add with its count, and Installed with its own", async () => {
    await mountCatalog();

    expect(pickerLabel()).toBe("settings.catalog.discover");
    expect(await sectionLabels()).toEqual([
      "settings.catalog.discover",
      "settings.music_sources2",
      "settings.playerproviders2",
      "settings.catalog.installed2",
    ]);
  });

  describe("with plugins through which apps play to Music Assistant", () => {
    beforeEach(() => {
      for (const manifest of [
        providerManifest({
          domain: "airplay_receiver",
          name: "AirPlay Receiver",
          type: ProviderType.PLUGIN,
          provides: [ProviderOffering.AUDIO_SOURCE],
        }),
        providerManifest({
          domain: "party",
          name: "Party",
          type: ProviderType.PLUGIN,
        }),
      ]) {
        apiMock.providerManifests[manifest.domain] = manifest;
      }
    });

    it("counts them with the music sources, with no section of their own", async () => {
      await mountCatalog();

      expect(await sectionLabels()).toEqual([
        "settings.catalog.discover",
        "settings.music_sources3",
        "settings.playerproviders2",
        "settings.plugins1",
        "settings.catalog.installed2",
      ]);
    });

    it("lists them with the music sources and labels them as live sources", async () => {
      await mountList(ProviderType.MUSIC);

      expect(cardNames("[data-testid='catalog-list']").sort()).toEqual([
        "AirPlay Receiver",
        "SoundCloud",
        "Spotify",
      ]);
      expect(cardLabels("airplay_receiver")).toEqual(["live"]);
      expect(cardLabels("spotify")).toEqual([]);
    });

    it("leaves the list of plugins to the other plugins", async () => {
      await mountList(ProviderType.PLUGIN);

      expect(cardNames("[data-testid='catalog-list']")).toEqual(["Party"]);
    });

    it("offers no pills while the live sources are the only label", async () => {
      await mountList(ProviderType.MUSIC);

      expect(
        document.querySelector("[data-testid='provider-label-filter']"),
      ).toBeNull();
      // nothing to set apart from the picker either
      expect(
        document.querySelector(
          "[data-testid='catalog-toolbar'] [data-slot='separator']",
        ),
      ).toBeNull();
    });
  });

  describe("with music sources saying in their manifest what they offer", () => {
    beforeEach(() => {
      const withOfferings = (domain: string, provides: ProviderOffering[]) => {
        apiMock.providerManifests[domain] = {
          ...apiMock.providerManifests[domain],
          provides,
        };
      };
      withOfferings("spotify", [
        ProviderOffering.TRACK,
        ProviderOffering.PODCAST,
      ]);
      withOfferings("soundcloud", [ProviderOffering.TRACK]);
      apiMock.providerManifests.airplay_receiver = providerManifest({
        domain: "airplay_receiver",
        name: "AirPlay Receiver",
        type: ProviderType.PLUGIN,
        provides: [ProviderOffering.AUDIO_SOURCE],
      });
    });

    it("labels each card with what it offers", async () => {
      await mountList(ProviderType.MUSIC);

      expect(cardLabels("spotify")).toEqual(["library", "podcasts"]);
      expect(cardLabels("soundcloud")).toEqual(["library"]);
      expect(cardLabels("airplay_receiver")).toEqual(["live"]);
    });

    it("offers a pill for every label of the music sources, after All, beside the picker", async () => {
      await mountList(ProviderType.MUSIC);

      const toolbar = document.querySelector(
        "[data-testid='catalog-toolbar']",
      )!;
      expect(
        toolbar.querySelector("[data-testid='catalog-section-picker']"),
      ).not.toBeNull();
      expect(
        toolbar.querySelector("[data-testid='provider-label-filter']"),
      ).not.toBeNull();
      expect(chipStates()).toEqual([
        ["all", "true"],
        ["library", "false"],
        ["podcasts", "false"],
        ["live", "false"],
      ]);
    });

    it("narrows the list down to the pill picked, and counts that on the picker", async () => {
      await mountList(ProviderType.MUSIC);

      await pickChip("live");

      expect(cardNames("[data-testid='catalog-list']")).toEqual([
        "AirPlay Receiver",
      ]);
      expect(pickerLabel()).toBe("settings.music_sources1");
      expect(listSummary()).toBe("settings.catalog.to_choose_from 1");

      await pickChip("all");

      expect(cardNames("[data-testid='catalog-list']")).toHaveLength(3);
      expect(pickerLabel()).toBe("settings.music_sources3");
      expect(listSummary()).toBe("settings.catalog.to_choose_from 3");
    });

    it("combines the pill with the search", async () => {
      await mountList(ProviderType.MUSIC);

      await pickChip("library");
      await search("sound");

      expect(cardNames("[data-testid='catalog-list']")).toEqual(["SoundCloud"]);
    });

    it("offers no pills on the search results of every type", async () => {
      await mountCatalog();

      await search("s");

      expect(cardNames("[data-testid='catalog-list']").length).toBeGreaterThan(
        0,
      );
      expect(
        document.querySelector("[data-testid='provider-label-filter']"),
      ).toBeNull();
    });
  });

  describe("with plugins saying in their manifest what they deliver", () => {
    beforeEach(() => {
      for (const manifest of [
        providerManifest({
          domain: "lastfm",
          name: "Last.fm",
          type: ProviderType.PLUGIN,
          provides: [ProviderOffering.SCROBBLE],
        }),
        providerManifest({
          domain: "party",
          name: "Party",
          type: ProviderType.PLUGIN,
          provides: [ProviderOffering.FUN],
        }),
        // a plugin naming nothing it delivers
        providerManifest({
          domain: "mystery",
          name: "Mystery",
          type: ProviderType.PLUGIN,
        }),
      ]) {
        apiMock.providerManifests[manifest.domain] = manifest;
      }
    });

    it("labels each card with what it delivers, and none with other", async () => {
      await mountList(ProviderType.PLUGIN);

      expect(cardLabels("lastfm")).toEqual(["scrobble"]);
      expect(cardLabels("party")).toEqual(["fun"]);
      expect(cardLabels("mystery")).toEqual([]);
    });

    it("offers a pill for every label of the plugins, after All and with Other last", async () => {
      await mountList(ProviderType.PLUGIN);

      expect(chipStates()).toEqual([
        ["all", "true"],
        ["scrobble", "false"],
        ["fun", "false"],
        ["other", "false"],
      ]);
    });

    it("narrows the list down to the pill picked, and counts that on the picker", async () => {
      await mountList(ProviderType.PLUGIN);

      await pickChip("other");

      expect(cardNames("[data-testid='catalog-list']")).toEqual(["Mystery"]);
      expect(pickerLabel()).toBe("settings.plugins1");

      await pickChip("all");

      expect(cardNames("[data-testid='catalog-list']")).toHaveLength(3);
      expect(pickerLabel()).toBe("settings.plugins3");
    });

    it("opens on the pill the route picks", async () => {
      routeMock.query = { types: "plugin", label: "fun" };

      await mountCatalog();

      expect(chipStates()).toEqual([
        ["all", "false"],
        ["scrobble", "false"],
        ["fun", "true"],
        ["other", "false"],
      ]);
      expect(cardNames("[data-testid='catalog-list']")).toEqual(["Party"]);
      expect(pickerLabel()).toBe("settings.plugins1");
    });

    it("keeps the pill the route picks while the plugins come in", async () => {
      routeMock.query = { types: "plugin", label: "fun" };
      const manifests = { ...apiMock.providerManifests };
      for (const domain of Object.keys(manifests)) {
        delete apiMock.providerManifests[domain];
      }

      await mountCatalog();
      Object.assign(apiMock.providerManifests, manifests);
      await flushPromises();

      expect(cardNames("[data-testid='catalog-list']")).toEqual(["Party"]);
    });
  });

  it("counts what is set up on Installed, last in the picker, and opens the Installed view from it", async () => {
    await mountCatalog();

    expect((await sectionLabels()).at(-1)).toBe("settings.catalog.installed2");

    await pickSection("installed");

    expect(routerMock.replace).toHaveBeenCalledWith({
      query: { view: "installed" },
    });
  });

  it("leads Discover back from the Installed view with the same picker, with no search or filter", async () => {
    routeMock.query = { view: "installed" };
    const wrapper = await mountCatalog();

    expect(pickerLabel()).toBe("settings.catalog.installed2");
    expect(
      document.querySelector("[data-slot='input-group-control']"),
    ).toBeNull();
    expect(stageFilter(wrapper).exists()).toBe(false);

    await pickSection("discover");

    expect(routerMock.replace).toHaveBeenCalledWith({ query: {} });
  });

  describe("on Discover", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-14T12:00:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("leads with the pick of the day, and leaves it out of the popular row", async () => {
      await mountCatalog();

      // Spotify and Sonos are the popular ones that can be added
      const pick = topPick()!.getAttribute("data-domain");
      expect(["spotify", "sonos"]).toContain(pick);
      expect(cardNames("[data-testid='catalog-popular']")).toEqual([
        pick === "spotify" ? "Sonos" : "Spotify",
      ]);
      expect(document.querySelector("[data-testid='catalog-list']")).toBeNull();
    });

    it("picks the next one the next day", async () => {
      const today = await mountCatalog();
      const first = topPick()!.getAttribute("data-domain");
      today.unmount();

      vi.setSystemTime(new Date("2026-11-15T12:00:00"));
      await mountCatalog();

      expect(topPick()!.getAttribute("data-domain")).not.toBe(first);
    });

    it("switches between the picks with its dots, and adds the one shown", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      await mountCatalog();
      const first = topPick()!.getAttribute("data-domain");
      const dots = topPick()!.querySelectorAll<HTMLElement>(
        "[data-testid='catalog-top-pick-dot']",
      );
      expect(dots).toHaveLength(2);
      expect(dots[0].getAttribute("aria-current")).toBe("true");

      dots[1].click();
      await flushPromises();

      const second = topPick()!.getAttribute("data-domain");
      expect(second).not.toBe(first);
      expect(dots[1].getAttribute("aria-current")).toBe("true");
      topPick()!
        .querySelector<HTMLElement>("[data-testid='catalog-top-pick-add']")!
        .click();
      expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
        kind: "provider",
        domain: second,
      });
      emit.mockRestore();
    });

    it("reads out the pick that a dot switches to", async () => {
      await mountCatalog();

      topPick()!
        .querySelectorAll<HTMLElement>(
          "[data-testid='catalog-top-pick-dot']",
        )[1]
        .click();
      await flushPromises();

      const live = topPick()!.querySelector(
        "[data-testid='catalog-top-pick-live']",
      )!;
      expect(live.getAttribute("aria-live")).toBe("polite");
      const shown =
        topPick()!.getAttribute("data-domain") === "spotify"
          ? "Spotify"
          : "Sonos";
      expect(live.textContent).toContain(shown);
      expect(
        live.querySelector("[data-testid='catalog-top-pick-name']"),
      ).not.toBeNull();
    });

    it("moves to the next pick with a swipe to the left", async () => {
      await mountCatalog();
      const first = topPick()!.getAttribute("data-domain");

      const touch = (type: string, clientX: number) =>
        topPick()!.dispatchEvent(
          Object.assign(new Event(type), {
            touches: [{ clientX, clientY: 100 }],
          }),
        );
      touch("touchstart", 300);
      touch("touchmove", 100);
      touch("touchend", 100);
      await flushPromises();

      expect(topPick()!.getAttribute("data-domain")).not.toBe(first);
    });

    it("opens the details of the pick", async () => {
      await mountCatalog();

      topPick()!
        .querySelector<HTMLElement>("[data-testid='catalog-top-pick-open']")!
        .click();
      await flushPromises();

      expect(
        document.querySelector("[data-testid='catalog-detail']")?.textContent,
      ).toContain(
        topPick()!
          .querySelector("[data-testid='catalog-top-pick-name']")!
          .textContent!.trim(),
      );
    });

    it("draws the pick in the main colour of its icon", async () => {
      apiMock.providerManifests.sonos = {
        ...apiMock.providerManifests.sonos,
        icon_images: [ProviderIconVariant.DEFAULT],
      };
      apiMock.providerManifests.spotify = {
        ...apiMock.providerManifests.spotify,
        icon_images: [ProviderIconVariant.DEFAULT],
      };
      apiMock.providerIcons["sonos:default"] = SVG_GREEN;
      apiMock.providerIcons["spotify:default"] = SVG_GREEN;
      await mountCatalog();

      const art = topPick()!.querySelector<HTMLElement>(
        "[data-testid='catalog-art']",
      )!;
      expect(art.style.getPropertyValue("--catalog-art")).toBe("#1db954");
      expect(
        topPick()!
          .querySelector("[data-testid='catalog-icon-image']")
          ?.getAttribute("src"),
      ).toBe(SVG_GREEN);
    });

    it("has no top pick when every popular one is added", async () => {
      configs.push(
        providerConfig({
          domain: "sonos",
          type: ProviderType.PLAYER,
          instance_id: "sonos--a",
        }),
      );
      apiMock.providerManifests.spotify = {
        ...apiMock.providerManifests.spotify,
        multi_instance: false,
      };

      await mountCatalog();

      expect(topPick()).toBeNull();
      expect(
        document.querySelector("[data-testid='catalog-popular']"),
      ).toBeNull();
    });

    it("opens the list of a type from Browse everything", async () => {
      await mountCatalog();

      const tiles = [
        ...document.querySelectorAll<HTMLElement>(
          "[data-testid='catalog-browse-type']",
        ),
      ];
      expect(
        tiles.map((tile) => tile.textContent?.replace(/\s+/g, "")),
      ).toEqual([
        "settings.music_sourcessettings.catalog.to_choose_from2",
        "settings.playerproviderssettings.catalog.to_choose_from2",
      ]);
      tiles[1].click();

      expect(routerMock.replace).toHaveBeenCalledWith({
        query: { types: "player" },
      });
    });
  });

  it("shows the matches of a search on Discover in place of its rows", async () => {
    const wrapper = await mountCatalog();

    expect(stageFilter(wrapper).exists()).toBe(false);

    await wrapper.get("[data-slot='input-group-control']").setValue("sound");

    expect(
      document.querySelector("[data-testid='catalog-discover']"),
    ).toBeNull();
    expect(pickerLabel()).toBe("settings.catalog.discover");
    expect(listSummary()).toBe("settings.catalog.search_results");
    expect(cardNames("[data-testid='catalog-list']")).toEqual(["SoundCloud"]);
    // what is found can be filtered on its stage, as a list of a type can
    expect(stageFilter(wrapper).exists()).toBe(true);
    expect(
      document.querySelector("[data-testid='catalog-manage-link']"),
    ).toBeNull();
  });

  it("searches only the type it lists", async () => {
    const wrapper = await mountList("player");

    // SoundCloud matches as well, but is a music source
    await wrapper.get("[data-slot='input-group-control']").setValue("so");

    expect(cardNames("[data-testid='catalog-list']")).toEqual(["Sonos"]);
  });

  it("counts on each type in the picker what it lists with the search", async () => {
    await mountCatalog();

    await search("sound");

    expect(await sectionLabels()).toEqual([
      "settings.catalog.discover",
      "settings.music_sources1",
      "settings.playerproviders0",
      "settings.catalog.installed2",
    ]);
  });

  it("counts a stage filter on its own type only", async () => {
    const wrapper = await mountList();

    stageFilter(wrapper).vm.$emit("update:modelValue", [ProviderStage.BETA]);
    await flushPromises();

    expect(pickerLabel()).toBe("settings.music_sources1");
    expect(await sectionLabels()).toEqual([
      "settings.catalog.discover",
      "settings.music_sources1",
      "settings.playerproviders2",
      "settings.catalog.installed2",
    ]);
  });

  it("filters the list of a type by stage", async () => {
    const wrapper = await mountList();
    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "SoundCloud",
      "Spotify",
    ]);

    wrapper
      .findComponent({ name: "FacetedFilter" })
      .vm.$emit("update:modelValue", [ProviderStage.BETA]);
    await flushPromises();

    expect(cardNames("[data-testid='catalog-list']")).toEqual(["SoundCloud"]);
  });

  it("says when nothing matches the search", async () => {
    const wrapper = await mountCatalog();

    await wrapper.get("[data-slot='input-group-control']").setValue("nothing");

    expect(
      document.querySelector("[data-testid='catalog-empty']")?.textContent,
    ).toContain("settings.catalog.no_match");
  });

  it("opens on the type the route names, with a link to its settings page", async () => {
    routeMock.query = { types: "player" };

    await mountCatalog();

    expect(pickerLabel()).toBe("settings.playerproviders2");
    expect(listSummary()).toBe("settings.catalog.to_choose_from 2");
    // Sonos is suggested, so it leads
    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "Sonos",
      "Chromecast",
    ]);
    expect(linkTarget("[data-testid='catalog-manage-link']")).toEqual({
      name: "playerproviders",
    });
  });

  it("keeps the section picked in the route", async () => {
    await mountCatalog();

    await pickSection("player");

    expect(routerMock.replace).toHaveBeenCalledWith({
      query: { types: "player" },
    });
    // picking closes the menu
    expect(sections()).toEqual([]);
  });

  it("offers a jump instead of Add for a single-instance provider that is set up", async () => {
    await mountList("player");

    const card = cardFor("chromecast");
    expect(
      card.querySelector("[data-testid='catalog-card-added']"),
    ).not.toBeNull();
    expect(card.querySelector("[data-testid='catalog-card-add']")).toBeNull();
    expect(linkTarget("[data-testid='catalog-card-manage']", card)).toEqual({
      name: "editprovider",
      params: { instanceId: "chromecast--a" },
    });
  });

  it("keeps Add next to the jump for a provider that allows another instance", async () => {
    await mountList();

    const card = cardFor("spotify", "[data-testid='catalog-list']");
    expect(
      card.querySelector("[data-testid='catalog-card-manage']"),
    ).not.toBeNull();
    expect(
      card.querySelector("[data-testid='catalog-card-add']"),
    ).not.toBeNull();
  });

  it("leaves the credit of what is not from the community to its details", async () => {
    await mountList();

    expect(
      cardFor("soundcloud").querySelector(
        "[data-testid='catalog-card-credit']",
      ),
    ).toBeNull();
    expect(
      cardFor("spotify", "[data-testid='catalog-list']").querySelector(
        "[data-testid='catalog-card-credit']",
      ),
    ).toBeNull();
  });

  it("starts the setup flow from the Add on a card", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    await mountList("player");

    cardFor("sonos", "[data-testid='catalog-list']")
      .querySelector<HTMLElement>("[data-testid='catalog-card-add']")!
      .click();

    expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "provider",
      domain: "sonos",
    });
    emit.mockRestore();
  });

  it("shows the details of a card with help, documentation and Add", async () => {
    await mountList();

    await openDetail("spotify");

    const detail = document.querySelector("[data-testid='catalog-detail']")!;
    expect(detail.textContent).toContain("Stream from Spotify");
    expect(detail.textContent).toContain("settings.catalog.created_by_team");
    expect(href(detail, "catalog-detail-documentation")).toBe(
      "https://music-assistant.io/music-providers/spotify/",
    );
    expect(href(detail, "catalog-detail-help")).toContain(
      "https://github.com/music-assistant/support/issues/new?",
    );
    expect(href(detail, "catalog-detail-request")).toBe(
      "https://github.com/orgs/music-assistant/discussions/categories/feature-requests-and-ideas",
    );
    expect(
      detail.querySelector("[data-testid='catalog-detail-add']"),
    ).not.toBeNull();
    expect(
      detail.querySelector("[data-testid='catalog-detail-manage']"),
    ).not.toBeNull();
  });

  it("credits the maintainers and contributors in the details", async () => {
    await mountList();

    await openDetail("soundcloud");

    const detail = document.querySelector("[data-testid='catalog-detail']")!;
    const maintainers = detail.querySelector(
      "[data-testid='catalog-detail-maintainers']",
    )!;
    expect(maintainers.textContent).toContain("settings.catalog.created_by");
    expect(maintainers.querySelector("a")?.getAttribute("href")).toBe(
      "https://github.com/jane",
    );
    expect(
      detail.querySelector("[data-testid='catalog-detail-credits'] a")
        ?.textContent,
    ).toBe("soundcloudpy");
  });

  it("closes the details when Add starts the setup flow", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    await mountList("player");
    await openDetail("sonos");

    document
      .querySelector<HTMLElement>("[data-testid='catalog-detail-add']")!
      .click();
    await flushPromises();

    expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "provider",
      domain: "sonos",
    });
    expect(
      document.querySelector(
        "[data-testid='catalog-detail'][data-state='open']",
      ),
    ).toBeNull();
    emit.mockRestore();
  });

  it("lists what is set up per type, each jumping to its settings", async () => {
    routeMock.query = { view: "installed" };

    await mountCatalog();

    const groups = [
      ...document.querySelectorAll("[data-testid='catalog-installed-group']"),
    ];
    expect(groups.map((group) => group.getAttribute("data-type"))).toEqual([
      ProviderType.MUSIC,
      ProviderType.PLAYER,
    ]);
    expect(
      linkTarget(
        "[data-testid='catalog-installed-card'] [data-testid='catalog-card-open']",
        groups[1],
      ),
    ).toEqual({
      name: "editprovider",
      params: { instanceId: "chromecast--a" },
    });
    expect(
      linkTarget("[data-testid='catalog-manage-link']", groups[1]),
    ).toEqual({ name: "playerproviders" });
    expect(document.querySelector("[data-testid='catalog-list']")).toBeNull();
  });

  it("says when nothing is set up yet", async () => {
    routeMock.query = { view: "installed" };
    configs = [];

    await mountCatalog();

    expect(
      document.querySelector("[data-testid='catalog-installed-empty']"),
    ).not.toBeNull();
  });

  it("names what the Add and Manage on a card are for", async () => {
    await mountList();

    const card = cardFor("spotify", "[data-testid='catalog-list']");
    expect(
      card
        .querySelector("[data-testid='catalog-card-add']")
        ?.getAttribute("aria-label"),
    ).toBe("settings.catalog.add_named Spotify");
    expect(
      card
        .querySelector("[data-testid='catalog-card-manage']")
        ?.getAttribute("aria-label"),
    ).toBe("settings.catalog.manage_named Spotify");
  });

  it("checks the section shown in a menu named for what it does", async () => {
    await mountList("player");

    await togglePicker();

    // reka names the menu after its button, which says what it is for
    const menu = document.querySelector("[data-slot='dropdown-menu-content']")!;
    expect(menu.getAttribute("aria-labelledby")).toBe(picker().id);
    expect(picker().textContent).toContain("settings.catalog.choose_section");
    expect(
      sections().map((section) => [
        section.getAttribute("data-tab"),
        section.getAttribute("role"),
        section.getAttribute("aria-checked"),
      ]),
    ).toEqual([
      ["discover", "menuitemradio", "false"],
      ["music", "menuitemradio", "false"],
      ["player", "menuitemradio", "true"],
      ["installed", "menuitemradio", "false"],
    ]);
  });

  it.each<Record<string, string>>([{}, { view: "installed" }])(
    "shows nothing that depends on what is set up before it is loaded (%o)",
    async (query) => {
      routeMock.query = query;
      apiMock.getProviderConfigs.mockReturnValue(new Promise(() => {}));

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='catalog-loading']"),
      ).not.toBeNull();
      expect(document.querySelector("[data-testid='catalog-card']")).toBeNull();
      expect(
        document.querySelector("[data-testid='catalog-installed-empty']"),
      ).toBeNull();
      // the picker counts what is set up
      expect(
        document.querySelector("[data-testid='catalog-section-picker']"),
      ).toBeNull();
    },
  );

  it("says when loading failed and loads again on retry", async () => {
    apiMock.getProviderConfigs.mockRejectedValueOnce(new Error("refused"));
    const wrapper = await mountCatalog();

    expect(document.querySelector("[data-testid='catalog-card']")).toBeNull();
    expect(
      document.querySelector("[data-testid='catalog-loading']"),
    ).toBeNull();

    await wrapper.get("[data-testid='catalog-retry']").trigger("click");
    await flushPromises();

    expect(
      document.querySelector("[data-testid='catalog-load-failed']"),
    ).toBeNull();
    expect(
      document.querySelector("[data-testid='catalog-discover']"),
    ).not.toBeNull();
    expect((await sectionLabels()).at(-1)).toBe("settings.catalog.installed2");
  });

  it("asks what is missing at the bottom", async () => {
    await mountCatalog();

    expect(
      document
        .querySelector("[data-testid='catalog-request'] a")
        ?.getAttribute("href"),
    ).toBe(
      "https://github.com/orgs/music-assistant/discussions/categories/feature-requests-and-ideas",
    );
  });
});

describe("Catalog lists of a type", () => {
  // 30 more music sources, 32 in all
  beforeEach(() => {
    for (let index = 10; index < 40; index++) {
      apiMock.providerManifests[`source${index}`] = providerManifest({
        domain: `source${index}`,
        name: `Source ${index}`,
        stage: index < 13 ? ProviderStage.BETA : ProviderStage.STABLE,
      });
    }
  });

  it("shows 24 at a time, with Show more and how many of all are shown", async () => {
    const wrapper = await mountList();

    expect(cardNames("[data-testid='catalog-list']")).toHaveLength(24);
    expect(
      document.querySelector("[data-testid='catalog-list-count']")?.textContent,
    ).toContain("settings.catalog.shown_of 24 32");

    await wrapper.get("[data-testid='catalog-show-more']").trigger("click");

    expect(cardNames("[data-testid='catalog-list']")).toHaveLength(32);
    expect(
      document.querySelector("[data-testid='catalog-show-more']"),
    ).toBeNull();
    expect(
      document.querySelector("[data-testid='catalog-list-count']"),
    ).toBeNull();
  });

  it("starts again at 24 after another search", async () => {
    const wrapper = await mountList();
    await wrapper.get("[data-testid='catalog-show-more']").trigger("click");

    await search("Source");

    expect(cardNames("[data-testid='catalog-list']")).toHaveLength(24);
    expect(
      document.querySelector("[data-testid='catalog-list-count']")?.textContent,
    ).toContain("settings.catalog.shown_of 24 30");
  });

  it("counts what a stage filter leaves", async () => {
    const wrapper = await mountList();

    wrapper
      .findComponent({ name: "FacetedFilter" })
      .vm.$emit("update:modelValue", [ProviderStage.BETA]);
    await flushPromises();

    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "SoundCloud",
      "Source 10",
      "Source 11",
      "Source 12",
    ]);
    expect(
      document.querySelector("[data-testid='catalog-show-more']"),
    ).toBeNull();
  });

  it("warns of the stage of an entry on its card", async () => {
    apiMock.providerManifests.source13 = {
      ...apiMock.providerManifests.source13,
      stage: ProviderStage.ALPHA,
    };
    await mountList();

    const card = (domain: string) =>
      cardFor(domain, "[data-testid='catalog-list']");
    expect(card("source13").textContent).toContain(
      "settings.stage.options.alpha",
    );
    expect(card("soundcloud").textContent).toContain(
      "settings.stage.options.beta",
    );
    expect(card("source14").textContent).not.toContain(
      "settings.stage.options",
    );
  });
});

describe("Catalog badges on the lists", () => {
  beforeEach(() => {
    apiMock.serverInfo.value = { server_version: "2.11.0b3" };
    for (const index of [10, 11, 12]) {
      apiMock.providerManifests[`source${index}`] = providerManifest({
        domain: `source${index}`,
        name: `Source ${index}`,
      });
    }
    recommendations = [
      suggest("source12", CatalogRecommendationReason.POPULAR),
      suggest("soundcloud", CatalogRecommendationReason.POPULAR),
      suggest("source11", CatalogRecommendationReason.NEW),
      suggest("source12", CatalogRecommendationReason.DISCOVERED),
      // set up already, though another one can be added
      suggest("spotify", CatalogRecommendationReason.DISCOVERED),
    ];
  });

  it("says why each is suggested and lists those first, the strongest reason first", async () => {
    await mountList();

    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "Source 12",
      "Source 11",
      "SoundCloud",
      "Source 10",
      "Spotify",
    ]);
    // every label is given the release line, as the rows of Discover are
    expect(badges("[data-testid='catalog-list']")).toEqual({
      source12: "settings.catalog.discovered_title 2.11",
      source11: "settings.catalog.new_in_version 2.11",
      soundcloud: "settings.catalog.popular 2.11",
    });
    expect(
      cardFor("spotify").querySelector("[data-testid='catalog-card-added']"),
    ).not.toBeNull();
  });

  it("keeps the suggested ones first in a search over every type", async () => {
    await mountCatalog();
    await search("o");

    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "Source 12",
      "Source 11",
      "SoundCloud",
      "Chromecast",
      "Sonos",
      "Source 10",
      "Spotify",
    ]);
  });

  it("puts no badge on what the user let go, nor lists it first", async () => {
    storeMock.currentUser.preferences["catalog.dismissedSuggestions"] = [
      "source12",
    ];

    await mountList();

    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "Source 11",
      "SoundCloud",
      "Source 10",
      "Source 12",
      "Spotify",
    ]);
    expect(Object.keys(badges("[data-testid='catalog-list']"))).toEqual([
      "source11",
      "soundcloud",
    ]);
  });

  it("lists by name without badges when the server gives no suggestions", async () => {
    apiMock.getCatalogRecommendations.mockRejectedValue(
      new ApiCommandError("Invalid command: catalog/recommendations", 9),
    );

    await mountList();

    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "SoundCloud",
      "Source 10",
      "Source 11",
      "Source 12",
      "Spotify",
    ]);
    expect(badges("[data-testid='catalog-list']")).toEqual({});
  });

  it("keeps the badges off Discover", async () => {
    await mountCatalog();

    expect(
      document.querySelector("[data-testid='catalog-discover']"),
    ).not.toBeNull();
    expect(document.querySelector("[data-testid='catalog-card-badge']")).toBe(
      null,
    );
  });

  // the badge on each card of a list that has one, by its domain
  function badges(container: string): Record<string, string> {
    return Object.fromEntries(
      [
        ...document.querySelectorAll(
          `${container} [data-testid='catalog-card']`,
        ),
      ].flatMap((card) => {
        const badge = card.querySelector("[data-testid='catalog-card-badge']");
        return badge
          ? [[card.getAttribute("data-domain"), badge.textContent?.trim()]]
          : [];
      }),
    );
  }
});

describe("Catalog icons drawn in white only", () => {
  beforeEach(() => {
    for (const [domain, icon] of [
      ["sonos", SVG_WHITE],
      ["spotify", SVG_GREEN],
    ]) {
      apiMock.providerManifests[domain] = {
        ...apiMock.providerManifests[domain],
        icon_images: [ProviderIconVariant.DEFAULT],
      };
      apiMock.providerIcons[`${domain}:default`] = icon;
    }
  });

  const tileOf = (root: ParentNode | null | undefined) =>
    root
      ?.querySelector("[data-testid='catalog-icon-tile']")
      ?.getAttribute("data-tile");

  it("puts it on a dark tile in the top pick", async () => {
    recommendations = [suggest("sonos", CatalogRecommendationReason.POPULAR)];

    await mountCatalog();

    expect(tileOf(topPick())).toBe("dark");
  });

  it("puts it on a dark tile in a tile of Discover, and a coloured one on a light tile", async () => {
    // Spotify leads the hero; what is new is never picked
    recommendations = [
      suggest("spotify", CatalogRecommendationReason.POPULAR),
      suggest("sonos", CatalogRecommendationReason.NEW),
    ];

    await mountCatalog();

    expect(tileOf(topPick())).toBe("light");
    expect(
      tileOf(
        document.querySelector(
          "[data-testid='catalog-new'] [data-testid='catalog-card'][data-domain='sonos']",
        ),
      ),
    ).toBe("dark");
  });

  it("puts it on a dark tile in the list of its type and in its details", async () => {
    await mountList("player");

    expect(tileOf(cardFor("sonos"))).toBe("dark");
    await openDetail("sonos");
    expect(
      tileOf(document.querySelector("[data-testid='catalog-detail']")),
    ).toBe("dark");
  });

  it("puts a coloured icon, and a community icon that is not white, on a light tile", async () => {
    communityEnabled = true;
    community = [
      RADIO,
      {
        ...RADIO,
        domain: "fm",
        icon: SVG_WHITE,
        manifest: { ...RADIO.manifest, domain: "fm", name: "FM" },
      },
    ];
    await mountList();

    expect(tileOf(cardFor("spotify"))).toBe("light");
    expect(tileOf(cardFor("radio"))).toBe("light");
    expect(tileOf(cardFor("fm"))).toBe("dark");
    expect(
      cardFor("fm")
        .querySelector("[data-testid='catalog-icon-image']")
        ?.getAttribute("src"),
    ).toBe(SVG_WHITE);
  });
});

describe("Catalog suggestions from the server", () => {
  const FOUND = suggest("sonos", CatalogRecommendationReason.DISCOVERED);
  const GOES_WELL = suggest(
    "soundcloud",
    CatalogRecommendationReason.COMPLEMENTS,
    "spotify",
  );
  const POPULAR = suggest("spotify", CatalogRecommendationReason.POPULAR);
  // four found on the network fill the hero, so nothing after them is picked
  const FOUR_FOUND = [10, 11, 12, 13].map((index) =>
    suggest(`source${index}`, CatalogRecommendationReason.DISCOVERED),
  );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00"));
    for (let index = 10; index < 20; index++) {
      apiMock.providerManifests[`source${index}`] = providerManifest({
        domain: `source${index}`,
        name: `Source ${index}`,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a row per reason in their order, in the server's order, leaving out what it does not know", async () => {
    // nothing set up, so Chromecast can be suggested
    configs = [];
    recommendations = [
      suggest("spotify", CatalogRecommendationReason.POPULAR),
      suggest("unknown", CatalogRecommendationReason.POPULAR),
      suggest("sonos", CatalogRecommendationReason.POPULAR),
      suggest("chromecast", "favourite"),
      suggest("soundcloud", CatalogRecommendationReason.NEW),
      suggest("chromecast", CatalogRecommendationReason.NEW),
    ];
    await mountCatalog();

    const pick = topPick()!.getAttribute("data-domain");
    // the pick leads the popular row, so it is left out of it
    expect(cardNames("[data-testid='catalog-popular']")).toEqual(
      pick === "spotify" ? ["Sonos"] : ["Spotify"],
    );
    expect(rowKeys()).toEqual(["popular", "new"]);
    expect(cardNames("[data-testid='catalog-new']")).toEqual([
      "SoundCloud",
      "Chromecast",
    ]);
  });

  it("shows at most eight in a row", async () => {
    recommendations = Array.from({ length: 10 }, (_, index) =>
      suggest(`source${index + 10}`, CatalogRecommendationReason.NEW),
    );

    await mountCatalog();

    expect(cardNames("[data-testid='catalog-new']")).toEqual(
      Array.from({ length: 8 }, (_, index) => `Source ${index + 10}`),
    );
  });

  it("says what a suggestion goes well with, and the type of each card", async () => {
    recommendations = [...FOUR_FOUND, GOES_WELL];

    await mountCatalog();

    expect(rowKeys()).toEqual(["discovered", "complements"]);
    const tile = document.querySelector(
      "[data-testid='catalog-complements'] [data-testid='catalog-card']",
    )!;
    expect(
      tile.querySelector("[data-testid='catalog-card-paired']")?.textContent,
    ).toContain("settings.catalog.goes_well_with Spotify");
    // the rows mix the types, so each card names its own
    expect(
      tile.querySelector("[data-testid='catalog-card-subtitle']")?.textContent,
    ).toContain("settings.catalog.type.");
  });

  it("picks what is found first, then what goes well, then what is popular", async () => {
    // five to pick from: the popular one is the one left out
    recommendations = [POPULAR, GOES_WELL, ...FOUR_FOUND.slice(0, 3)];

    await mountCatalog();

    const shown = [
      ...topPick()!.querySelectorAll("[data-testid='catalog-top-pick-dot']"),
    ].map((dot) =>
      dot
        .getAttribute("aria-label")!
        .replace("settings.catalog.show_pick ", ""),
    );
    const start = shown.indexOf("Source 10");
    expect([...shown.slice(start), ...shown.slice(0, start)]).toEqual([
      "Source 10",
      "Source 11",
      "Source 12",
      "SoundCloud",
    ]);
  });

  it.each([
    [FOUND, "settings.catalog.discovered_title"],
    [GOES_WELL, "settings.catalog.goes_well_with Spotify"],
  ])("says why the pick is picked (%o)", async (recommendation, reason) => {
    recommendations = [recommendation];

    await mountCatalog();

    expect(
      topPick()!.querySelector("[data-testid='catalog-top-pick-reason']")
        ?.textContent,
    ).toContain(reason);
    // named by what it says, for voice control; the heading names the pick
    const dismiss = topPick()!.querySelector(
      "[data-testid='catalog-top-pick-dismiss']",
    )!;
    expect(dismiss.textContent?.trim()).toBe("settings.catalog.dont_suggest");
    expect(dismiss.hasAttribute("aria-label")).toBe(false);
  });

  it("says no more than Top pick for a popular pick, and offers no way to let it go", async () => {
    recommendations = [POPULAR];

    await mountCatalog();

    expect(
      topPick()!.querySelector("[data-testid='catalog-top-pick-reason']"),
    ).toBeNull();
    expect(
      topPick()!.querySelector("[data-testid='catalog-top-pick-dismiss']"),
    ).toBeNull();
    expect(
      document.querySelector("[data-testid='catalog-card-dismiss']"),
    ).toBeNull();
  });

  describe("letting a suggestion go", () => {
    beforeEach(() => {
      apiMock.updateUser.mockResolvedValue(undefined);
    });

    // Vue ignores a handler attached in the same instant as the event, and
    // the clock is frozen here
    const settleClock = () => vi.setSystemTime(Date.now() + 1);

    it("stops suggesting it from its tile, and keeps it in its list", async () => {
      recommendations = [...FOUR_FOUND, GOES_WELL];
      await mountCatalog();
      settleClock();
      const dismiss = document.querySelector<HTMLElement>(
        "[data-domain='soundcloud'] [data-testid='catalog-card-dismiss']",
      )!;
      expect(dismiss.getAttribute("aria-label")).toBe(
        "settings.catalog.dont_suggest_named SoundCloud",
      );

      dismiss.click();
      await flushPromises();

      expect(apiMock.updateUser).toHaveBeenCalledWith(
        "jane",
        { preferences: { "catalog.dismissedSuggestions": ["soundcloud"] } },
        { suppressGlobalError: true },
      );
      expect(document.querySelector("[data-domain='soundcloud']")).toBeNull();
      expect(rowKeys()).toEqual(["discovered"]);

      await search("SoundCloud");
      expect(cardNames("[data-testid='catalog-list']")).toEqual(["SoundCloud"]);
    });

    it("says so, names it, and brings it back with Undo", async () => {
      recommendations = [...FOUR_FOUND, GOES_WELL];
      await mountCatalog();
      settleClock();

      document
        .querySelector<HTMLElement>(
          "[data-domain='soundcloud'] [data-testid='catalog-card-dismiss']",
        )!
        .click();
      await flushPromises();

      expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
        "settings.catalog.not_suggested_toast SoundCloud",
        {
          action: {
            label: "settings.catalog.undo",
            onClick: expect.any(Function),
          },
        },
      );
      expect(document.querySelector("[data-domain='soundcloud']")).toBeNull();

      toastMock.success.mock.calls[0][1].action.onClick();
      await flushPromises();

      expect(apiMock.updateUser).toHaveBeenLastCalledWith(
        "jane",
        { preferences: { "catalog.dismissedSuggestions": [] } },
        { suppressGlobalError: true },
      );
      expect(
        document.querySelector(
          "[data-testid='catalog-complements'] [data-domain='soundcloud']",
        ),
      ).not.toBeNull();
      expect(toastMock.success).toHaveBeenLastCalledWith(
        "settings.catalog.suggested_again_toast SoundCloud",
      );
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it("says once that it could not be saved, and keeps suggesting it", async () => {
      recommendations = [...FOUR_FOUND, GOES_WELL];
      apiMock.updateUser.mockRejectedValue(new Error("refused"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      await mountCatalog();
      settleClock();

      document
        .querySelector<HTMLElement>(
          "[data-domain='soundcloud'] [data-testid='catalog-card-dismiss']",
        )!
        .click();
      await flushPromises();

      // the api is asked to keep its own message away, so this is the only one
      expect(apiMock.updateUser).toHaveBeenCalledWith(
        "jane",
        expect.anything(),
        { suppressGlobalError: true },
      );
      expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(
        "settings.catalog.dont_suggest_failed SoundCloud",
      );
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(
        document.querySelector("[data-domain='soundcloud']"),
      ).not.toBeNull();
    });

    it("offers it only on what is about the user's own setup", async () => {
      recommendations = [
        ...FOUR_FOUND,
        GOES_WELL,
        suggest("source14", CatalogRecommendationReason.POPULAR),
        suggest("source15", CatalogRecommendationReason.NEW),
      ];

      await mountCatalog();

      const dismissible = [
        ...document.querySelectorAll("[data-testid='catalog-card-dismiss']"),
      ].map((button) =>
        button
          .closest("[data-testid='catalog-card']")!
          .getAttribute("data-domain"),
      );
      expect(dismissible).toHaveLength(4);
      expect(dismissible).toContain("soundcloud");
      expect(dismissible).not.toContain("source14");
      expect(dismissible).not.toContain("source15");
    });

    it("stops suggesting the pick from the hero", async () => {
      recommendations = [FOUND];
      await mountCatalog();

      topPick()!
        .querySelector<HTMLElement>("[data-testid='catalog-top-pick-dismiss']")!
        .click();
      await flushPromises();

      expect(apiMock.updateUser).toHaveBeenCalledWith(
        "jane",
        { preferences: { "catalog.dismissedSuggestions": ["sonos"] } },
        { suppressGlobalError: true },
      );
      expect(topPick()).toBeNull();
    });

    it("keeps what was let go before, and adds to it", async () => {
      recommendations = [FOUND, GOES_WELL];
      storeMock.currentUser.preferences = {
        "catalog.dismissedSuggestions": ["sonos", 42],
      };
      await mountCatalog();

      expect(topPick()!.getAttribute("data-domain")).toBe("soundcloud");
      expect(document.querySelector("[data-domain='sonos']")).toBeNull();

      topPick()!
        .querySelector<HTMLElement>("[data-testid='catalog-top-pick-dismiss']")!
        .click();
      await flushPromises();

      expect(apiMock.updateUser).toHaveBeenCalledWith(
        "jane",
        {
          preferences: {
            "catalog.dismissedSuggestions": ["sonos", "soundcloud"],
          },
        },
        { suppressGlobalError: true },
      );
      expect(topPick()).toBeNull();
    });
  });

  it.each([
    ["is refused", () => Promise.reject(new Error("Unknown command"))],
    ["answers with something else", () => Promise.resolve({ wrong: true })],
  ])(
    "shows Discover without suggestions when the server %s",
    async (_case, answer) => {
      apiMock.getCatalogRecommendations.mockImplementation(answer);

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='catalog-discover']"),
      ).not.toBeNull();
      expect(topPick()).toBeNull();
      expect(rowKeys()).toEqual([]);
      expect(
        document.querySelector("[data-testid='catalog-browse']"),
      ).not.toBeNull();
      expect(banner()).not.toBeNull();
      expect(toastMock.error).not.toHaveBeenCalled();
    },
  );

  it("waits for the suggestions before showing the page", async () => {
    apiMock.getCatalogRecommendations.mockReturnValue(new Promise(() => {}));

    await mountCatalog();

    expect(
      document.querySelector("[data-testid='catalog-loading']"),
    ).not.toBeNull();
  });

  it("asks again when something is added or removed, or the community catalog changes", async () => {
    await mountCatalog();
    expect(apiMock.getCatalogRecommendations).toHaveBeenCalledTimes(1);

    recommendations = [FOUND];
    await serverSays(EventType.PROVIDERS_UPDATED);
    expect(apiMock.getCatalogRecommendations).toHaveBeenCalledTimes(2);
    expect(topPick()!.getAttribute("data-domain")).toBe("sonos");

    await serverSays(EventType.COMMUNITY_CATALOG_UPDATED);
    expect(apiMock.getCatalogRecommendations).toHaveBeenCalledTimes(3);
  });

  it("asks again when the connection is back, not when it is first made", async () => {
    await mountCatalog();
    expect(apiMock.getCatalogRecommendations).toHaveBeenCalledTimes(1);

    apiMock.state.value = "reconnecting";
    await flushPromises();
    expect(apiMock.getCatalogRecommendations).toHaveBeenCalledTimes(1);

    recommendations = [FOUND];
    apiMock.state.value = "initialized";
    await flushPromises();

    expect(apiMock.getCatalogRecommendations).toHaveBeenCalledTimes(2);
    expect(topPick()!.getAttribute("data-domain")).toBe("sonos");
  });

  it("asks again when the community catalog is enabled", async () => {
    await mountCatalog();

    await clickBannerEnable();
    await confirmations[0].onConfirm();
    await flushPromises();

    expect(apiMock.getCatalogRecommendations).toHaveBeenCalledTimes(2);
  });
});

describe("Catalog for a member", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  });

  it("only offers the music sources a member may add", async () => {
    routeMock.query = { types: "player" };

    await mountCatalog();

    // a player list it cannot use opens Discover instead
    expect(pickerLabel()).toBe("settings.catalog.discover");
    expect(await sectionLabels()).toEqual([
      "settings.catalog.discover",
      "settings.music_sources1",
      "settings.catalog.installed1",
    ]);
    expect(topPick()?.getAttribute("data-domain")).toBe("spotify");
  });

  describe("with a source shared with it", () => {
    beforeEach(() => {
      configs = [
        providerConfig({
          domain: "spotify",
          instance_id: "spotify--shared",
          name: "Shared Spotify",
          access: {
            owner: null,
            sharing: ProviderSharing.EVERYONE,
            shared_users: [],
            shared_playback: SharedPlayback.WITHOUT_OWN,
          },
        }),
      ];
    });

    it("does not count it as added or offer to manage it", async () => {
      await mountList();

      const card = cardFor("spotify", "[data-testid='catalog-list']");
      expect(
        card.querySelector("[data-testid='catalog-card-added']"),
      ).toBeNull();
      expect(
        card.querySelector("[data-testid='catalog-card-manage']"),
      ).toBeNull();
      expect(
        card.querySelector("[data-testid='catalog-card-add']"),
      ).not.toBeNull();
    });

    it("lists it as installed without a link to its settings", async () => {
      routeMock.query = { view: "installed" };

      await mountCatalog();

      const card = document.querySelector(
        "[data-testid='catalog-installed-card']",
      )!;
      expect(card.textContent).toContain("Shared Spotify");
      expect(
        card.querySelector("[data-testid='catalog-card-open']"),
      ).toBeNull();
      expect(card.querySelector("[data-to]")).toBeNull();
    });

    it("links its own source next to the shared one", async () => {
      routeMock.query = { view: "installed" };
      configs.push(
        providerConfig({
          domain: "spotify",
          instance_id: "spotify--own",
          name: "My Spotify",
          access: {
            owner: "jane",
            sharing: ProviderSharing.PRIVATE,
            shared_users: [],
            shared_playback: SharedPlayback.WITHOUT_OWN,
          },
        }),
      );

      await mountCatalog();

      expect(
        linkTarget(
          "[data-testid='catalog-installed-card'] [data-testid='catalog-card-open']",
        ),
      ).toEqual({
        name: "editprovider",
        params: { instanceId: "spotify--own" },
      });
    });
  });
});

const OWN_RISK = "You install them at your own risk.";

// what the menu offers while the community catalog is on
const MENU_WHILE_ON = [
  "settings.catalog.community.refresh",
  "settings.catalog.community.auto_update",
  "settings.catalog.community.disable",
];

// on offer while the switch is on
const RADIO = communityProvider("radio", {
  repository: "jane/ma-radio",
  manifest: providerManifest({
    domain: "radio",
    name: "Radio Garden",
    description: "Radio from around the world",
    tier: ProviderTier.COMMUNITY,
    documentation: "https://jane.github.io/ma-radio/",
  }),
});

describe("Catalog with the community catalog", () => {
  it("offers an admin the banner and a menu to switch it on, while it is off", async () => {
    await mountCatalog();

    expect(banner()!.textContent).toContain(
      "settings.catalog.community.banner_title",
    );
    expect(menuButton()!.getAttribute("aria-label")).toBe("more_options");
    expect(menuLabels()).toEqual(["settings.catalog.community.enable"]);
  });

  it.each([
    ["banner", clickBannerEnable],
    ["menu", () => chooseInMenu("settings.catalog.community.enable")],
  ])(
    "switches on from the %s only after the server's own-risk text is confirmed",
    async (_where, switchOn) => {
      community = [RADIO];
      await mountCatalog();

      await switchOn();

      expect(confirmations).toHaveLength(1);
      expect(confirmations[0].message).toBe(OWN_RISK);
      expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
      expect(banner()).not.toBeNull();
      expect(await sectionLabels()).toContain("settings.music_sources2");

      await confirmations[0].onConfirm();
      await flushPromises();

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        community_catalog_enabled: true,
      });
      expect(banner()).toBeNull();
      expect(menuLabels()).toEqual(MENU_WHILE_ON);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.enabled_toast",
      );
      await search("Radio");
      expect(cardNames("[data-testid='catalog-list']")).toContain(
        "Radio Garden",
      );
    },
  );

  it("stays off when the confirmation is cancelled", async () => {
    community = [RADIO];
    await mountCatalog();

    await clickBannerEnable();
    // a cancelled confirmation never calls back

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(banner()).not.toBeNull();
    expect(menuLabels()).toEqual(["settings.catalog.community.enable"]);
    expect(await sectionLabels()).toContain("settings.music_sources2");
  });

  it("switches off from the menu without a confirmation, and hides what it offers", async () => {
    communityEnabled = true;
    community = [RADIO];
    await mountCatalog();
    await search("Radio");
    expect(cardNames("[data-testid='catalog-list']")).toContain("Radio Garden");

    await chooseInMenu("settings.catalog.community.disable");

    expect(confirmations).toHaveLength(0);
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
      community_catalog_enabled: false,
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.catalog.community.disabled_toast",
    );
    expect(menuLabels()).toEqual(["settings.catalog.community.enable"]);
    expect(cardNames("[data-testid='catalog-list']")).not.toContain(
      "Radio Garden",
    );
  });

  it("stays on when the server refuses to switch it off", async () => {
    communityEnabled = true;
    community = [RADIO];
    // the api shows the server's reason itself, once
    apiMock.saveCoreConfig.mockRejectedValue(
      new Error("Remove what you installed from the community catalog first"),
    );
    await mountCatalog();

    await chooseInMenu("settings.catalog.community.disable");

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
      community_catalog_enabled: false,
    });
    expect(menuLabels()).toEqual(MENU_WHILE_ON);
    expect(banner()).toBeNull();
    await search("Radio");
    expect(cardNames("[data-testid='catalog-list']")).toContain("Radio Garden");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("holds the switch in the menu while it is being saved", async () => {
    communityEnabled = true;
    apiMock.saveCoreConfig.mockReturnValue(new Promise(() => {}));
    await mountCatalog();

    await chooseInMenu("settings.catalog.community.disable");

    expect(menuItem("settings.catalog.community.disable").disabled).toBe(true);
  });

  it("drops the banner for good after Don't show again, and keeps the menu", async () => {
    await mountCatalog();

    document
      .querySelector<HTMLElement>("[data-testid='community-banner-dismiss']")!
      .click();
    await flushPromises();

    expect(apiMock.updateUser).toHaveBeenCalledWith(
      "jane",
      { preferences: { "catalog.communityBannerDismissed": true } },
      undefined,
    );
    expect(banner()).toBeNull();
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(menuLabels()).toEqual(["settings.catalog.community.enable"]);
  });

  it("brings the banner back when the server does not keep Don't show again", async () => {
    apiMock.updateUser.mockRejectedValue(new Error("refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mountCatalog();

    document
      .querySelector<HTMLElement>("[data-testid='community-banner-dismiss']")!
      .click();
    await flushPromises();

    expect(banner()).not.toBeNull();
  });

  it("offers it on Discover only", async () => {
    await mountList();

    expect(banner()).toBeNull();
  });

  it("opens the menu under its button, wherever it was tapped", async () => {
    await mountCatalog();

    menuButton()!.dispatchEvent(
      new MouseEvent("click", { clientX: 500, clientY: 400 }),
    );

    const { posX, posY } = menus.at(-1)!;
    const rect = menuButton()!.getBoundingClientRect();
    expect([posX, posY]).toEqual([rect.left, rect.bottom]);
  });

  it("never shows the banner to a user who dismissed it", async () => {
    storeMock.currentUser.preferences = {
      "catalog.communityBannerDismissed": true,
    };

    await mountCatalog();

    expect(banner()).toBeNull();
    expect(menuLabels()).toEqual(["settings.catalog.community.enable"]);
  });

  describe("while it is on", () => {
    beforeEach(() => {
      communityEnabled = true;
      community = [RADIO];
      // what it offers is listed with its type
      routeMock.query = { types: "music" };
    });

    it("shows no banner", async () => {
      routeMock.query = {};
      await mountCatalog();

      expect(banner()).toBeNull();
    });

    it("lists what it offers in a search on Discover, with the badge and maintainer", async () => {
      routeMock.query = {};
      await mountCatalog();

      await search("world");

      expect(cardNames("[data-testid='catalog-list']")).toEqual([
        "Radio Garden",
      ]);
      const card = cardFor("radio", "[data-testid='catalog-list']");
      expect(
        card.querySelector("[data-testid='catalog-card-community']"),
      ).not.toBeNull();
      expect(
        card.querySelector("[data-testid='catalog-card-credit']")?.textContent,
      ).toContain("settings.catalog.by_maintainers @jane");
    });

    it("lists it with its type", async () => {
      await mountCatalog();

      expect(cardNames("[data-testid='catalog-list']")).toContain(
        "Radio Garden",
      );
    });

    it("shows its icon as an image of the data the catalog gives", async () => {
      await mountCatalog();

      const icon = cardFor(
        "radio",
        "[data-testid='catalog-list']",
      ).querySelector("[data-testid='catalog-icon-image']");
      expect(icon?.tagName).toBe("IMG");
      expect(icon?.getAttribute("src")).toBe(COMMUNITY_ICON);
    });

    it("never loads an icon that is not a data URI", async () => {
      community = [{ ...RADIO, icon: "https://tracker.example/icon.png" }];

      await mountCatalog();

      const card = cardFor("radio", "[data-testid='catalog-list']");
      expect(card.querySelector("img")).toBeNull();
      expect(
        card.querySelector("[data-testid='catalog-icon-tile']"),
      ).not.toBeNull();
    });

    it("shows its maintainers, code, documentation, help and version in the details", async () => {
      await mountCatalog();

      await openDetail("radio");

      const detail = document.querySelector("[data-testid='catalog-detail']")!;
      expect(
        detail
          .querySelector("[data-testid='catalog-detail-maintainers'] a")
          ?.getAttribute("href"),
      ).toBe("https://github.com/jane");
      expect(href(detail, "catalog-detail-repository")).toBe(
        "https://github.com/jane/ma-radio",
      );
      expect(href(detail, "catalog-detail-documentation")).toBe(
        "https://jane.github.io/ma-radio/",
      );
      expect(href(detail, "catalog-detail-help")).toBe(
        "https://github.com/jane/ma-radio/issues",
      );
      expect(
        detail.querySelector("[data-testid='catalog-detail-version']")
          ?.textContent,
      ).toContain(
        "settings.catalog.community.version_released 1.2.0 Nov 2, 2026",
      );
      // a change to it is for its maintainer
      expect(
        detail.querySelector("[data-testid='catalog-detail-request']"),
      ).toBeNull();
    });

    it("shows the version without a date when the release date is not a date", async () => {
      community = [{ ...RADIO, released: "soon" }];
      await mountCatalog();

      await openDetail("radio");

      expect(
        document.querySelector("[data-testid='catalog-detail-version']")
          ?.textContent,
      ).toContain("settings.catalog.community.version 1.2.0");
    });

    it("links its documentation only on an https address", async () => {
      community = [
        {
          ...RADIO,
          manifest: { ...RADIO.manifest, documentation: "http://jane.example" },
        },
      ];
      await mountCatalog();

      await openDetail("radio");

      expect(
        document.querySelector("[data-testid='catalog-detail-documentation']"),
      ).toBeNull();
    });

    it("shows the version installed, not the one on offer, for one that is installed", async () => {
      const installed = {
        ...RADIO,
        state: CommunityProviderState.INSTALLED,
        installed_version: "1.0.0",
      };
      community = [installed];
      apiMock.providerManifests.radio = installed.manifest;
      await mountCatalog();

      await openDetail("radio");

      const version = document.querySelector(
        "[data-testid='catalog-detail-version']",
      )?.textContent;
      expect(version).toContain("settings.catalog.community.version 1.0.0");
      expect(version).not.toContain("1.2.0");
    });

    it("shows its note on Add, and installs nothing before Continue", async () => {
      await mountCatalog();

      clickAdd("radio");
      await flushPromises();

      expect(apiMock.installCommunityProvider).not.toHaveBeenCalled();
      const note = document.querySelector("[data-testid='community-note']")!;
      expect(note.textContent).toContain(
        "settings.catalog.community.note_maintainers Radio Garden @jane",
      );
      expect(href(note, "community-note-help")).toBe(
        "https://github.com/jane/ma-radio/issues",
      );
      expect(
        note.querySelector("[data-testid='community-note-help']")?.textContent,
      ).toBe("settings.catalog.community.note_help_link");
    });

    it("installs after the note, with progress, then starts adding it", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      let finishInstall!: (provider: CommunityProvider) => void;
      apiMock.installCommunityProvider.mockReturnValue(
        new Promise((resolve) => (finishInstall = resolve)),
      );
      await mountCatalog();
      clickAdd("radio");
      await flushPromises();

      continueNote();
      await flushPromises();

      expect(apiMock.installCommunityProvider).toHaveBeenCalledWith("radio");
      const add = cardFor(
        "radio",
        "[data-testid='catalog-list']",
      ).querySelector("[data-testid='catalog-card-add']")!;
      expect(add.getAttribute("aria-busy")).toBe("true");
      expect(add.textContent).toContain(
        "settings.catalog.community.installing",
      );
      expect(emit).not.toHaveBeenCalledWith(
        "setupFlowDialog",
        expect.anything(),
      );

      finishInstall({
        ...RADIO,
        state: CommunityProviderState.INSTALLED,
        installed_version: "1.2.0",
      });
      await flushPromises();

      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.installed_toast Radio Garden",
      );
      expect(apiMock.fetchProviderManifests).toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
        kind: "provider",
        domain: "radio",
      });
      emit.mockRestore();
    });

    it("finishes the install but starts no setup once the page is left", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      let finishInstall!: (provider: CommunityProvider) => void;
      apiMock.installCommunityProvider.mockReturnValue(
        new Promise((resolve) => (finishInstall = resolve)),
      );
      const wrapper = await mountCatalog();
      clickAdd("radio");
      await flushPromises();
      continueNote();
      await flushPromises();

      wrapper.unmount();
      finishInstall({ ...RADIO, state: CommunityProviderState.INSTALLED });
      await flushPromises();

      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.installed_toast Radio Garden",
      );
      expect(emit).not.toHaveBeenCalledWith(
        "setupFlowDialog",
        expect.anything(),
      );
      emit.mockRestore();
    });

    it("adds nothing after the install when the settings it had before are back", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      // the server loads the settings entry kept from before with the install
      apiMock.installCommunityProvider.mockImplementation(async () => {
        configs.push(providerConfig({ domain: "radio" }));
        return { ...RADIO, state: CommunityProviderState.INSTALLED };
      });
      await mountCatalog();
      clickAdd("radio");
      await flushPromises();

      continueNote();
      await flushPromises();

      expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
        "settings.catalog.community.installed_restored_toast Radio Garden",
      );
      expect(emit).not.toHaveBeenCalledWith(
        "setupFlowDialog",
        expect.anything(),
      );
      emit.mockRestore();
    });

    it("reports the server's error when installing fails, and adds nothing", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      apiMock.installCommunityProvider.mockRejectedValue({
        toString: () => "Its requirements clash with dj",
      });
      await mountCatalog();
      clickAdd("radio");
      await flushPromises();

      continueNote();
      await flushPromises();

      expect(toastMock.error).toHaveBeenCalledWith(
        "Its requirements clash with dj",
      );
      expect(emit).not.toHaveBeenCalledWith(
        "setupFlowDialog",
        expect.anything(),
      );
      emit.mockRestore();
    });

    it("shows the note again for one that is installed, then adds it without installing", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      const installed = {
        ...RADIO,
        state: CommunityProviderState.INSTALLED,
        installed_version: "1.2.0",
      };
      community = [installed];
      apiMock.providerManifests.radio = installed.manifest;
      await mountCatalog();

      clickAdd("radio");
      await flushPromises();
      expect(
        document.querySelector("[data-testid='community-note']"),
      ).not.toBeNull();
      continueNote();
      await flushPromises();

      expect(apiMock.installCommunityProvider).not.toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
        kind: "provider",
        domain: "radio",
      });
      emit.mockRestore();
    });

    it("lists it again when the community catalog changes", async () => {
      await mountCatalog();
      expect(cardNames("[data-testid='catalog-list']")).toContain(
        "Radio Garden",
      );
      const onUpdated = apiMock.subscribe.mock.calls.find(
        ([event]) => event === EventType.COMMUNITY_CATALOG_UPDATED,
      )![1];

      community = [];
      await onUpdated();
      await flushPromises();

      expect(cardNames("[data-testid='catalog-list']")).not.toContain(
        "Radio Garden",
      );
    });

    it("adds one another admin installed while the note was open, without installing", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      await mountCatalog();
      clickAdd("radio");
      await flushPromises();

      community = [{ ...RADIO, state: CommunityProviderState.INSTALLED }];
      apiMock.providerManifests.radio = RADIO.manifest;
      await catalogUpdated();
      continueNote();
      await flushPromises();

      expect(apiMock.installCommunityProvider).not.toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
        kind: "provider",
        domain: "radio",
      });
      emit.mockRestore();
    });

    describe("installing from its details", () => {
      const INSTALLED = {
        ...RADIO,
        state: CommunityProviderState.INSTALLED,
        installed_version: "1.2.0",
      };
      let finishInstall: (provider: CommunityProvider) => void;
      let finishManifests: () => void;
      let emit: MockInstance<typeof eventbus.emit>;

      beforeEach(() => {
        apiMock.installCommunityProvider.mockReturnValue(
          new Promise((resolve) => (finishInstall = resolve)),
        );
        apiMock.fetchProviderManifests.mockReturnValue(
          new Promise<void>((resolve) => (finishManifests = resolve)),
        );
        emit = vi.spyOn(eventbus, "emit");
      });

      afterEach(() => {
        emit.mockRestore();
      });

      // installs radio from its open details and hands back those details
      async function startInstall(): Promise<Element> {
        await mountCatalog();
        await openDetail("radio");
        const detail = document.querySelector(
          "[data-testid='catalog-detail']",
        )!;
        detail
          .querySelector<HTMLElement>("[data-testid='catalog-detail-add']")!
          .click();
        await flushPromises();
        continueNote();
        await flushPromises();
        return detail;
      }

      function registerManifest() {
        apiMock.providerManifests.radio = INSTALLED.manifest;
      }

      // the card stays, and the open details are never taken down and shown again
      function expectStays(detail: Element) {
        expect(detail.isConnected).toBe(true);
        expect(cardFor("radio", "[data-testid='catalog-list']")).toBeTruthy();
      }

      function expectAddStarted() {
        expect(
          emit.mock.calls.filter(([event]) => event === "setupFlowDialog"),
        ).toEqual([["setupFlowDialog", { kind: "provider", domain: "radio" }]]);
        expect(toastMock.error).not.toHaveBeenCalled();
      }

      it.each(["before", "with", "after"])(
        "keeps the card and the details when its manifest arrives %s the install result",
        async (moment) => {
          const detail = await startInstall();

          if (moment === "before") registerManifest();
          await flushPromises();
          expectStays(detail);

          finishInstall(INSTALLED);
          await flushPromises();
          expectStays(detail);

          if (moment === "with") registerManifest();
          finishManifests();
          await flushPromises();
          expectAddStarted();
          expect(cardFor("radio", "[data-testid='catalog-list']")).toBeTruthy();

          if (moment === "after") registerManifest();
          await flushPromises();
          expect(cardFor("radio", "[data-testid='catalog-list']")).toBeTruthy();
        },
      );

      it("keeps the card and the details when the community catalog changes during the install", async () => {
        const detail = await startInstall();

        community = [INSTALLED];
        await catalogUpdated();
        expectStays(detail);

        registerManifest();
        await flushPromises();
        expectStays(detail);

        finishInstall(INSTALLED);
        finishManifests();
        await flushPromises();
        expectAddStarted();
      });

      it("installs once when Continue is pressed again", async () => {
        const wrapper = await mountCatalog();
        clickAdd("radio");
        await flushPromises();
        const note = wrapper.findComponent({ name: "CommunityInstallNote" });

        note.vm.$emit("continue");
        note.vm.$emit("continue");
        await flushPromises();
        finishInstall(INSTALLED);
        finishManifests();
        await flushPromises();

        expect(apiMock.installCommunityProvider).toHaveBeenCalledOnce();
        expectAddStarted();
      });
    });
  });

  it.each([
    ["on offer", true],
    ["installed, with only its manifest saying so", false],
  ])(
    "shows the credits of one from the community as text (%s)",
    async (_case, offered) => {
      const credits = ["![x](https://tracker.example/p.png) [me](https://x.y)"];
      const manifest = { ...RADIO.manifest, credits };
      routeMock.query = { types: "music" };
      if (offered) {
        communityEnabled = true;
        community = [{ ...RADIO, manifest }];
      } else {
        apiMock.providerManifests.radio = manifest;
      }
      await mountCatalog();

      await openDetail("radio");

      const shown = document.querySelector(
        "[data-testid='catalog-detail-credits']",
      )!;
      expect(shown.querySelector("img, a")).toBeNull();
      expect(shown.textContent).toContain(credits[0]);
    },
  );

  describe("in the Installed view", () => {
    beforeEach(() => {
      routeMock.query = { view: "installed" };
      community = [
        communityProvider("radio", {
          state: CommunityProviderState.INSTALLED,
          installed_version: "1.2.0",
          manifest: providerManifest({ domain: "radio", name: "Radio Garden" }),
        }),
        communityProvider("bad", {
          state: CommunityProviderState.BLOCKED,
          installed_version: "0.3.0",
          manifest: providerManifest({ domain: "bad", name: "Bad radio" }),
          reason: "It sends data elsewhere",
          reason_url: "https://github.com/music-assistant/registry/issues/9",
          error: {
            error_code: 61,
            message:
              "The community catalog blocked this (It sends data elsewhere), so it no longer runs.",
          },
        }),
        communityProvider("broken", {
          state: CommunityProviderState.UNAVAILABLE,
          installed_version: "2.0.0",
          manifest: providerManifest({ domain: "broken", name: "Broken" }),
          error: {
            error_code: 61,
            message: "This is not available for this version.",
          },
        }),
        communityProvider("old", {
          state: CommunityProviderState.WITHDRAWN,
          installed_version: "1.0.0",
          manifest: providerManifest({ domain: "old", name: "Old radio" }),
          reason: "The maintainer stopped",
        }),
      ];
    });

    it("lists what is installed with its version, state and reason", async () => {
      await mountCatalog();

      expect(
        installedRows().map((row) => row.getAttribute("data-domain")),
      ).toEqual(["bad", "broken", "old", "radio"]);

      const radio = installedRow("radio");
      expect(radio.textContent).toContain(
        "settings.catalog.community.version 1.2.0",
      );
      expect(
        radio.querySelector("[data-testid='community-installed-state']"),
      ).toBeNull();

      const bad = installedRow("bad");
      expect(
        bad.querySelector("[data-testid='community-installed-state']")
          ?.textContent,
      ).toContain("settings.catalog.community.state.blocked");
      expect(
        bad.querySelector("[data-testid='community-installed-reason']")
          ?.textContent,
      ).toContain("so it no longer runs");
      expect(href(bad, "community-installed-reason-link")).toBe(
        "https://github.com/music-assistant/registry/issues/9",
      );
      // the link stands apart from the reason, which may end without a full stop
      expect(
        bad.querySelector(
          "[data-testid='community-installed-reason'] [data-testid='community-installed-reason-link']",
        ),
      ).toBeNull();

      expect(
        installedRow("broken").querySelector(
          "[data-testid='community-installed-reason']",
        )?.textContent,
      ).toContain("This is not available for this version.");

      const old = installedRow("old");
      expect(old.textContent).toContain(
        "settings.catalog.community.state.withdrawn",
      );
      expect(old.textContent).toContain(
        "settings.catalog.community.withdrawn_hint",
      );
      expect(old.textContent).toContain("The maintainer stopped");
    });

    it("links its reason only on an https address", async () => {
      community = community.map((provider) => ({
        ...provider,
        reason_url: "http://github.com/music-assistant/registry/issues/9",
      }));

      await mountCatalog();

      expect(
        installedRow("bad").querySelector(
          "[data-testid='community-installed-reason-link']",
        ),
      ).toBeNull();
    });

    it("removes one after a confirmation that its settings stay", async () => {
      await mountCatalog();

      installedRow("bad")
        .querySelector<HTMLElement>("[data-testid='community-remove']")!
        .click();
      await flushPromises();

      expect(confirmations[0].message).toBe(
        "settings.catalog.community.remove_message Bad radio settings.music_sources",
      );
      expect(apiMock.removeCommunityProvider).not.toHaveBeenCalled();

      community = community.filter((provider) => provider.domain !== "bad");
      await confirmations[0].onConfirm();
      await flushPromises();

      expect(apiMock.removeCommunityProvider).toHaveBeenCalledWith("bad");
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.removed_toast Bad radio",
      );
      expect(document.querySelector("[data-domain='bad']")).toBeNull();
    });

    it("fetches the list again with Check for changes in the menu", async () => {
      apiMock.refreshCommunityProviders.mockResolvedValue(
        community.slice(0, 1),
      );
      await mountCatalog();

      await chooseInMenu("settings.catalog.community.refresh");

      expect(apiMock.refreshCommunityProviders).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.no_updates",
      );
      expect(
        installedRows().map((row) => row.getAttribute("data-domain")),
      ).toEqual(["radio"]);
    });

    it("leaves the section out while it is off and nothing is installed", async () => {
      community = [RADIO];

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='community-installed']"),
      ).toBeNull();
    });
  });

  it("says it is not available when the server refuses it, and keeps the rest of the page", async () => {
    apiMock.getCommunityProviders.mockRejectedValue(
      new Error("The community catalog is not available in safe mode"),
    );
    routeMock.query = { view: "installed" };
    community = [
      communityProvider("radio", { state: CommunityProviderState.INSTALLED }),
    ];

    await mountCatalog();

    expect(banner()).toBeNull();
    expect(unavailableNotice()?.textContent).toContain(
      "settings.catalog.community.unavailable_title",
    );
    expect(unavailableNotice()?.textContent).toContain(
      "settings.catalog.community.unavailable_message",
    );
    expect(menuLabels()).toEqual([
      "settings.catalog.community.unavailable",
      "settings.catalog.try_again",
    ]);
    expect(openMenu()[0].disabled).toBe(true);
    expect(
      document.querySelector("[data-testid='community-installed']"),
    ).toBeNull();
    expect(
      document.querySelectorAll("[data-testid='catalog-installed-group']"),
    ).toHaveLength(2);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([{}, { types: "music" }])(
    "says it is not available on every section (%o)",
    async (query) => {
      apiMock.getCommunityProviders.mockRejectedValue(new Error("refused"));
      routeMock.query = query;

      await mountCatalog();

      expect(unavailableNotice()).not.toBeNull();
      expect(banner()).toBeNull();
    },
  );

  it("says why it is not available in the server's words when the server gave a reason", async () => {
    apiMock.getCommunityProviders.mockRejectedValue(
      new ApiCommandError("Not available in safe mode.", 1),
    );

    await mountCatalog();

    expect(unavailableNotice()?.textContent).toContain(
      "Not available in safe mode.",
    );
    expect(unavailableNotice()?.textContent).not.toContain(
      "settings.catalog.community.unavailable_title",
    );
    expect(unavailableNotice()?.textContent).toContain(
      "settings.catalog.community.unavailable_message",
    );
  });

  it("loads it again on retry from the menu after the server refused it", async () => {
    apiMock.getCommunityProviders.mockRejectedValueOnce(new Error("refused"));
    await mountCatalog();

    expect(unavailableNotice()).not.toBeNull();

    await chooseInMenu("settings.catalog.try_again");

    expect(apiMock.getCommunityProviders).toHaveBeenCalledTimes(2);
    expect(menuLabels()).toEqual(["settings.catalog.community.enable"]);
    expect(banner()).not.toBeNull();
    expect(unavailableNotice()).toBeNull();
  });

  it("waits for the community catalog before showing the page", async () => {
    apiMock.getCommunityProviders.mockReturnValue(new Promise(() => {}));

    await mountCatalog();

    expect(
      document.querySelector("[data-testid='catalog-loading']"),
    ).not.toBeNull();
    expect(document.querySelector("[data-testid='catalog-card']")).toBeNull();
    expect(banner()).toBeNull();
    expect(menuButton()!.disabled).toBe(true);
  });

  it("finds none of it in a search by a user who is not an admin", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    communityEnabled = true;
    community = [RADIO];
    await mountCatalog();

    await search("Radio");

    expect(
      document.querySelector("[data-testid='catalog-empty']"),
    ).not.toBeNull();
  });

  it.each<Record<string, string>>([{}, { view: "installed" }])(
    "shows none of it to a user who is not an admin (%o)",
    async (query) => {
      hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
      communityEnabled = true;
      community = [
        RADIO,
        communityProvider("old", {
          state: CommunityProviderState.UPDATE_AVAILABLE,
          update_version: "1.2.0",
          notice: "moved",
        }),
      ];
      routeMock.query = query;

      await mountCatalog();

      expect(banner()).toBeNull();
      expect(menuButton()).toBeNull();
      expect(
        document.querySelector("[data-testid='community-moved']"),
      ).toBeNull();
      expect(
        document.querySelector("[data-testid='catalog-updates-dot']"),
      ).toBeNull();
      expect(await updatesBadge()).toBeUndefined();
      expect(
        document.querySelector("[data-testid='catalog-community-new']"),
      ).toBeNull();
      expect(
        document.querySelector("[data-testid='community-installed']"),
      ).toBeNull();
      expect(document.querySelector("[data-domain='radio']")).toBeNull();
      expect(apiMock.getCommunityProviders).not.toHaveBeenCalled();
      expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
      // what to suggest is not part of the community catalog
      expect(apiMock.getCatalogRecommendations).toHaveBeenCalled();
    },
  );
});

describe("Catalog with updates from the community catalog", () => {
  const updatable = (domain: string, name: string, from: string, to: string) =>
    communityProvider(domain, {
      state: CommunityProviderState.UPDATE_AVAILABLE,
      installed_version: from,
      latest_version: to,
      update_version: to,
      manifest: providerManifest({ domain, name }),
    });

  describe("in the Installed view", () => {
    beforeEach(() => {
      routeMock.query = { view: "installed" };
      communityEnabled = true;
      community = [
        updatable("radio", "Radio Garden", "1.1.0", "1.2.0"),
        updatable("dj", "DJ", "0.1.0", "0.2.0"),
        communityProvider("lyrics", {
          state: CommunityProviderState.RESTART_REQUIRED,
          installed_version: "1.0.0",
          pending_version: "1.1.0",
          manifest: providerManifest({ domain: "lyrics", name: "Lyrics" }),
        }),
        communityProvider("fm", {
          state: CommunityProviderState.INSTALLED,
          installed_version: "1.9.0",
          latest_version: "2.0.0",
          failed_version: "2.0.0",
          manifest: providerManifest({ domain: "fm", name: "FM" }),
        }),
      ];
    });

    it("shows the installed version and the one on offer, and how many updates wait", async () => {
      await mountCatalog();

      const radio = installedRow("radio");
      expect(radio.textContent).toContain(
        "settings.catalog.community.version 1.1.0",
      );
      expect(
        radio.querySelector("[data-testid='community-installed-update']")
          ?.textContent,
      ).toContain("settings.catalog.community.update_available 1.2.0");
      expect(
        radio.querySelector("[data-testid='community-update']")?.textContent,
      ).toContain("settings.catalog.community.update");
      expect(await updatesBadge()).toBe("2");
      // the updates are in sight, so the picker need not point them out
      expect(
        document.querySelector("[data-testid='catalog-updates-dot']"),
      ).toBeNull();
    });

    it("updates one by its domain, with progress", async () => {
      let finish!: (value: CommunityProvider[]) => void;
      apiMock.updateCommunityProviders.mockReturnValue(
        new Promise((resolve) => (finish = resolve)),
      );
      await mountCatalog();

      updateButton("radio").click();
      await flushPromises();

      expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith("radio");
      expect(updateButton("radio").getAttribute("aria-busy")).toBe("true");
      expect(updateButton("radio").textContent).toContain(
        "settings.catalog.community.updating",
      );

      finish(
        community.map((provider) =>
          provider.domain === "radio"
            ? {
                ...provider,
                state: CommunityProviderState.INSTALLED,
                installed_version: "1.2.0",
                update_version: null,
              }
            : provider,
        ),
      );
      await flushPromises();

      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.updated_toast Radio Garden",
      );
      expect(
        installedRow("radio").querySelector("[data-testid='community-update']"),
      ).toBeNull();
      expect(await updatesBadge()).toBe("1");
    });

    it("shows the server's message when an update fails", async () => {
      apiMock.updateCommunityProviders.mockRejectedValue({
        toString: () => "Its requirements clash with dj",
      });
      await mountCatalog();

      updateButton("radio").click();
      await flushPromises();

      expect(toastMock.error).toHaveBeenCalledWith(
        "Its requirements clash with dj",
      );
      expect(updateButton("radio").getAttribute("aria-busy")).toBeNull();
    });

    it("updates all at once when more than one has an update", async () => {
      apiMock.updateCommunityProviders.mockResolvedValue(community);
      await mountCatalog();

      document
        .querySelector<HTMLElement>("[data-testid='community-update-all']")!
        .click();
      await flushPromises();

      expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith();
    });

    it("offers no update of all for a single update", async () => {
      community = community.filter((provider) => provider.domain !== "dj");

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='community-update-all']"),
      ).toBeNull();
      expect(updateButton("radio")).not.toBeNull();
    });

    it("says which version a restart of Music Assistant makes active, without a button", async () => {
      await mountCatalog();

      const lyrics = installedRow("lyrics");
      expect(
        lyrics.querySelector("[data-testid='community-installed-restart']")
          ?.textContent,
      ).toContain("settings.catalog.community.restart_hint 1.1.0");
      expect(
        lyrics.querySelector("[data-testid='community-installed-state']")
          ?.textContent,
      ).toContain("settings.catalog.community.state.restart_required");
      expect(
        lyrics.querySelector("[data-testid='community-update']"),
      ).toBeNull();
    });

    it("says a version did not load, and tries it again by its domain", async () => {
      apiMock.updateCommunityProviders.mockResolvedValue(community);
      await mountCatalog();

      const fm = installedRow("fm");
      expect(
        fm.querySelector("[data-testid='community-installed-failed']")
          ?.textContent,
      ).toContain("settings.catalog.community.failed_version 2.0.0");
      expect(updateButton("fm").textContent).toContain(
        "settings.catalog.try_again",
      );

      // the server lists it as before: the version did not load again
      updateButton("fm").click();
      await flushPromises();

      expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith("fm");
      expect(toastMock.error).toHaveBeenCalledWith(
        "settings.catalog.community.update_failed_toast FM 2.0.0",
      );
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it("turns automatic updates on from the menu", async () => {
      await mountCatalog();
      expect(menuItem("settings.catalog.community.auto_update").selected).toBe(
        false,
      );

      await chooseInMenu("settings.catalog.community.auto_update");

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        auto_update: true,
      });
      expect(menuItem("settings.catalog.community.auto_update").selected).toBe(
        true,
      );
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.auto_update_on_toast",
      );
    });

    it("turns automatic updates off from the menu", async () => {
      communityAutoUpdate = true;
      await mountCatalog();

      await chooseInMenu("settings.catalog.community.auto_update");

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        auto_update: false,
      });
      expect(menuItem("settings.catalog.community.auto_update").selected).toBe(
        false,
      );
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.auto_update_off_toast",
      );
    });

    it("keeps automatic updates as they were when saving fails", async () => {
      apiMock.saveCoreConfig.mockRejectedValue(new Error("denied"));
      await mountCatalog();

      await chooseInMenu("settings.catalog.community.auto_update");

      expect(menuItem("settings.catalog.community.auto_update").selected).toBe(
        false,
      );
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it("keeps the options of the menu out of the section", async () => {
      await mountCatalog();

      const section = document.querySelector(
        "[data-testid='community-installed']",
      )!;
      expect(section.textContent).not.toContain(
        "settings.catalog.community.refresh",
      );
      expect(section.textContent).not.toContain(
        "settings.catalog.community.auto_update",
      );
    });

    it("keeps Check for changes for what is installed but leaves automatic updates out while the community catalog is off", async () => {
      communityEnabled = false;

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='community-installed']"),
      ).not.toBeNull();
      expect(menuLabels()).toEqual([
        "settings.catalog.community.refresh",
        "settings.catalog.community.enable",
      ]);
    });
  });

  it("points out the updates on the picker away from the Installed view, and counts them on Installed", async () => {
    communityEnabled = true;
    community = [
      updatable("radio", "Radio Garden", "1.1.0", "1.2.0"),
      updatable("dj", "DJ", "0.1.0", "0.2.0"),
    ];
    await mountList();

    expect(
      document.querySelector("[data-testid='catalog-updates-dot']"),
    ).not.toBeNull();
    expect(picker().textContent).toContain(
      "settings.catalog.community.updates_waiting",
    );

    await togglePicker();

    const badge = document.querySelector(
      "[data-testid='catalog-section'][data-tab='installed'] [data-testid='catalog-updates-count']",
    )!;
    expect(badge.textContent?.trim()).toBe("2");
    expect(badge.getAttribute("aria-label")).toBe(
      "settings.catalog.community.updates_waiting",
    );
  });

  it("shows the version on offer with its date and an Update in the details", async () => {
    apiMock.providerManifests.radio = RADIO.manifest;
    communityEnabled = true;
    community = [
      {
        ...RADIO,
        state: CommunityProviderState.UPDATE_AVAILABLE,
        installed_version: "1.1.0",
        update_version: "1.2.0",
      },
    ];
    apiMock.updateCommunityProviders.mockResolvedValue(community);
    await mountList();

    await openDetail("radio");

    const detail = document.querySelector("[data-testid='catalog-detail']")!;
    expect(
      detail.querySelector("[data-testid='catalog-detail-update']")
        ?.textContent,
    ).toContain("settings.catalog.community.update_released 1.2.0 Nov 2, 2026");
    detail
      .querySelector<HTMLElement>(
        "[data-testid='catalog-detail-update-button']",
      )!
      .click();
    await flushPromises();

    expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith("radio");
  });

  it("shows the Update in the details as busy while all are updated", async () => {
    apiMock.providerManifests.radio = RADIO.manifest;
    communityEnabled = true;
    community = [
      {
        ...RADIO,
        state: CommunityProviderState.UPDATE_AVAILABLE,
        installed_version: "1.1.0",
        update_version: "1.2.0",
      },
      updatable("dj", "DJ", "0.1.0", "0.2.0"),
    ];
    apiMock.updateCommunityProviders.mockReturnValue(new Promise(() => {}));
    // the details open over the Installed view
    routeMock.query = { view: "installed", detail: "radio" };
    await mountCatalog();

    document
      .querySelector<HTMLElement>("[data-testid='community-update-all']")!
      .click();
    await flushPromises();
    const button = document.querySelector<HTMLElement>(
      "[data-testid='catalog-detail-update-button']",
    )!;
    expect(button.getAttribute("aria-busy")).toBe("true");
    button.click();
    await flushPromises();

    expect(apiMock.updateCommunityProviders).toHaveBeenCalledOnce();
    expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith();
  });

  it("shows the version on offer without a release date that is not a date", async () => {
    apiMock.providerManifests.radio = RADIO.manifest;
    communityEnabled = true;
    community = [
      {
        ...RADIO,
        state: CommunityProviderState.UPDATE_AVAILABLE,
        installed_version: "1.1.0",
        update_version: "1.2.0",
        released: "soon",
      },
    ];
    await mountList();

    await openDetail("radio");

    const detail = document.querySelector("[data-testid='catalog-detail']")!;
    expect(
      detail.querySelector("[data-testid='catalog-detail-version']")
        ?.textContent,
    ).toContain("settings.catalog.community.version 1.1.0");
    expect(
      detail.querySelector("[data-testid='catalog-detail-update']")
        ?.textContent,
    ).toContain("settings.catalog.community.update_available 1.2.0");
  });

  describe("the notice that one moved", () => {
    const MOVED = communityProvider("radio", {
      state: CommunityProviderState.INSTALLED,
      installed_version: "1.2.0",
      notice: "moved",
      manifest: RADIO.manifest,
    });

    beforeEach(() => {
      apiMock.providerManifests.radio = RADIO.manifest;
      community = [MOVED];
    });

    it("names it above the toolbar, also while the community catalog is off", async () => {
      await mountCatalog();

      const notice = document.querySelector("[data-testid='community-moved']")!;
      expect(notice.textContent).toContain(
        "settings.catalog.community.moved_title Radio Garden",
      );
      expect(notice.textContent).toContain(
        "settings.catalog.community.moved_message",
      );
      const toolbar = document.querySelector(
        "[data-testid='catalog-toolbar']",
      )!;
      expect(
        notice.compareDocumentPosition(toolbar) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        linkTarget("[data-testid='community-moved-details']", notice),
      ).toEqual({ name: "catalog", query: { detail: "radio" } });
    });

    it("is dismissed with the server and disappears", async () => {
      apiMock.dismissCommunityNotice.mockResolvedValue(undefined);
      await mountCatalog();

      document
        .querySelector<HTMLElement>("[data-testid='community-moved-dismiss']")!
        .click();
      await flushPromises();

      expect(apiMock.dismissCommunityNotice).toHaveBeenCalledWith("radio");
      expect(
        document.querySelector("[data-testid='community-moved']"),
      ).toBeNull();
    });

    it("opens the details its link names", async () => {
      routeMock.query = { detail: "radio" };

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='catalog-detail']")?.textContent,
      ).toContain("Radio Garden");
      expect(routerMock.replace).toHaveBeenCalledWith({ query: {} });
    });

    it("leads to the Installed view for one that does not run, without saying it keeps working", async () => {
      community = [
        {
          ...MOVED,
          state: CommunityProviderState.BLOCKED,
          reason: "It sends your listening history elsewhere.",
        },
      ];

      await mountCatalog();

      const notice = document.querySelector("[data-testid='community-moved']")!;
      expect(notice.querySelector("p")?.textContent?.trim()).toBe(
        "settings.catalog.community.moved_message_not_running",
      );
      expect(
        linkTarget("[data-testid='community-moved-details']", notice),
      ).toEqual({ name: "catalog", query: { view: "installed" } });
    });
  });

  it("opens nothing for a link to the details of an unknown entry", async () => {
    routeMock.query = { detail: "unknown" };

    await mountCatalog();

    expect(document.querySelector("[data-testid='catalog-detail']")).toBeNull();
    expect(routerMock.replace).toHaveBeenCalledWith({ query: {} });
    await search("Spotify");
    await openDetail("spotify");
    expect(
      document.querySelector("[data-testid='catalog-detail']")?.textContent,
    ).toContain("Spotify");
  });

  describe("what is new", () => {
    beforeEach(() => {
      communityEnabled = true;
      community = [
        RADIO,
        communityProvider("dj", {
          manifest: providerManifest({
            domain: "dj",
            name: "DJ",
            tier: ProviderTier.COMMUNITY,
          }),
        }),
      ];
      // only rows: nothing to pick
      recommendations = [
        suggest("soundcloud", CatalogRecommendationReason.NEW),
        suggest("radio", CatalogRecommendationReason.NEW),
        suggest("dj", CatalogRecommendationReason.UPDATED),
      ];
      apiMock.serverInfo.value = { server_version: "2.11.0b3" };
    });

    it("shows what is new in this release line, and what is new and updated in the community catalog", async () => {
      await mountCatalog();

      expect(topPick()).toBeNull();
      expect(rowKeys()).toEqual(["new", "community-new", "community-updated"]);
      expect(rowTitle("new")).toBe("settings.catalog.new_in_version 2.11");
      expect(cardNames("[data-testid='catalog-new']")).toEqual(["SoundCloud"]);
      expect(cardNames("[data-testid='catalog-community-new']")).toEqual([
        "Radio Garden",
      ]);
      expect(cardNames("[data-testid='catalog-community-updated']")).toEqual([
        "DJ",
      ]);
    });

    describe("of an installed community entry", () => {
      // installed, so its manifest is known; a user who is not an admin may add one too
      const INSTALLED_RADIO = providerManifest({
        domain: "radio",
        name: "Radio Garden",
        tier: ProviderTier.COMMUNITY,
        multi_instance: true,
      });

      beforeEach(() => {
        apiMock.providerManifests.radio = INSTALLED_RADIO;
        community = [
          communityProvider("radio", {
            state: CommunityProviderState.INSTALLED,
            installed_version: "1.2.0",
            manifest: INSTALLED_RADIO,
          }),
        ];
        recommendations = [
          suggest("spotify", CatalogRecommendationReason.NEW),
          suggest("radio", CatalogRecommendationReason.NEW),
          suggest("radio", CatalogRecommendationReason.UPDATED),
        ];
      });

      it.each([
        ["a user who is not an admin", "user", true],
        ["an admin with the community catalog disabled", "admin", false],
      ] as const)(
        "shows %s no community row, and keeps it out of what is new in the version",
        async (_who, role, enabled) => {
          hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES[role]));
          communityEnabled = enabled;

          await mountCatalog();

          expect(rowKeys()).toEqual(["new"]);
          expect(cardNames("[data-testid='catalog-new']")).toEqual(["Spotify"]);
        },
      );

      it("shows its rows to an admin with the community catalog enabled", async () => {
        await mountCatalog();

        expect(rowKeys()).toEqual([
          "new",
          "community-new",
          "community-updated",
        ]);
        expect(cardNames("[data-testid='catalog-new']")).toEqual(["Spotify"]);
        expect(cardNames("[data-testid='catalog-community-new']")).toEqual([
          "Radio Garden",
        ]);
        expect(cardNames("[data-testid='catalog-community-updated']")).toEqual([
          "Radio Garden",
        ]);
      });
    });

    it("shows no rows on the list of a type, or while searching", async () => {
      routeMock.query = { types: "music" };
      const wrapper = await mountCatalog();

      expect(rowKeys()).toEqual([]);

      routeMock.query = {};
      wrapper.unmount();
      await mountCatalog();
      await search("dj");

      expect(rowKeys()).toEqual([]);
    });
  });
});

function updateButton(domain: string): HTMLElement {
  return installedRow(domain).querySelector<HTMLElement>(
    "[data-testid='community-update']",
  )!;
}

function communityCoreConfig(enabled: boolean): CoreConfig {
  return {
    domain: "community_catalog",
    last_error: null,
    values: {
      community_catalog_enabled: {
        key: "community_catalog_enabled",
        label: "Community catalog",
        description: OWN_RISK,
        value: enabled,
      },
      auto_update: { key: "auto_update", value: communityAutoUpdate },
    },
  } as unknown as CoreConfig;
}

// the server sends an event, to everything on the page that listens to it
async function serverSays(event: EventType) {
  for (const [subscribed, callback] of apiMock.subscribe.mock.calls) {
    if (subscribed === event) await callback();
  }
  await flushPromises();
}

// the server says the community catalog changed
async function catalogUpdated() {
  await apiMock.subscribe.mock.calls.find(
    ([event]) => event === EventType.COMMUNITY_CATALOG_UPDATED,
  )![1]();
  await flushPromises();
}

async function clickBannerEnable() {
  document
    .querySelector<HTMLElement>("[data-testid='community-banner-enable']")!
    .click();
  await flushPromises();
}

function banner(): Element | null {
  return document.querySelector("[data-testid='community-banner']");
}

function unavailableNotice(): Element | null {
  return document.querySelector("[data-testid='community-unavailable']");
}

function menuButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    "[data-testid='catalog-menu']",
  );
}

// the items of the menu the button opens
function openMenu() {
  menuButton()!.click();
  return menus.at(-1)!.items;
}

function menuLabels(): string[] {
  return openMenu().map((item) => item.label);
}

function menuItem(label: string) {
  const item = openMenu().find((entry) => entry.label === label);
  if (!item) throw new Error(`no menu item ${label}`);
  return item;
}

async function chooseInMenu(label: string) {
  menuItem(label).action!();
  await flushPromises();
}

function clickAdd(domain: string) {
  cardFor(domain, "[data-testid='catalog-list']")
    .querySelector<HTMLElement>("[data-testid='catalog-card-add']")!
    .click();
}

function continueNote() {
  document
    .querySelector<HTMLElement>("[data-testid='community-note-continue']")!
    .click();
}

function installedRows(): Element[] {
  return [
    ...document.querySelectorAll("[data-testid='community-installed-card']"),
  ];
}

function installedRow(domain: string): Element {
  const row = document.querySelector(
    `[data-testid='community-installed-card'][data-domain='${domain}']`,
  );
  if (!row) throw new Error(`no installed row for ${domain}`);
  return row;
}

function suggest(
  domain: string,
  reason: CatalogRecommendationReason | string,
  detail: string | null = null,
): CatalogRecommendation {
  return { domain, reason: reason as CatalogRecommendationReason, detail };
}

function rowKeys(): string[] {
  return [
    ...document.querySelectorAll(
      "[data-testid='catalog-discover'] > section[data-testid^='catalog-']",
    ),
  ]
    .map((row) => row.getAttribute("data-testid")!.replace("catalog-", ""))
    .filter((key) => !["top-pick", "browse"].includes(key));
}

function rowTitle(key: string): string | undefined {
  return document
    .querySelector(`[data-testid='catalog-${key}'] h2`)
    ?.textContent?.trim();
}

async function mountCatalog() {
  const wrapper = mount(Catalog, {
    attachTo: document.body,
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        FacetedFilter: true,
        ProviderIcon: true,
        "i18n-t": I18nTStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// the list of a type
async function mountList(type = "music") {
  routeMock.query = { types: type };
  return mountCatalog();
}

async function search(text: string) {
  const input = document.querySelector<HTMLInputElement>(
    "[data-slot='input-group-control']",
  )!;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  await flushPromises();
}

// the number of updates on Installed in the picker, if any
async function updatesBadge() {
  await togglePicker();
  const badge = document
    .querySelector("[data-testid='catalog-updates-count']")
    ?.textContent?.trim();
  await togglePicker();
  return badge;
}

// what the list says it lists, above it
function listSummary() {
  return document
    .querySelector("[data-testid='catalog-list-summary']")
    ?.textContent?.trim();
}

function stageFilter(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "FacetedFilter" });
}

function topPick(): Element | null {
  return document.querySelector("[data-testid='catalog-top-pick']");
}

async function openDetail(domain: string) {
  cardFor(domain, "[data-testid='catalog-list']")
    .querySelector<HTMLElement>("[data-testid='catalog-card-open']")!
    .click();
  await flushPromises();
}

// the button that picks what the page shows, named after what it shows
function picker(): HTMLElement {
  return document.querySelector<HTMLElement>(
    "[data-testid='catalog-section-picker']",
  )!;
}

// what the picker shows, without what it says only to a screen reader
function pickerLabel() {
  const purpose = picker().querySelector(
    "[data-testid='catalog-section-picker-purpose']",
  )?.textContent;
  return picker()
    .textContent?.replace(purpose ?? "", "")
    .replace(/\s+/g, "");
}

// reka opens and closes the menu on a click of its trigger
async function togglePicker() {
  picker().click();
  await flushPromises();
}

function sections(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      "[data-testid='catalog-section']",
    ),
  ];
}

// each section the picker offers, with its count
async function sectionLabels() {
  await togglePicker();
  const labels = sections().map((section) =>
    section.textContent?.replace(/\s+/g, ""),
  );
  await togglePicker();
  return labels;
}

async function pickSection(tab: string) {
  await togglePicker();
  sections()
    .find((section) => section.getAttribute("data-tab") === tab)!
    .click();
  await flushPromises();
}

function cardNames(container: string) {
  return [
    ...document.querySelectorAll(
      `${container} [data-testid='catalog-card-open']`,
    ),
  ].map((name) => name.textContent?.trim());
}

// the labels the card of an entry names under its name, read back from their
// translation keys
function cardLabels(domain: string) {
  const subtitle = cardFor(domain).querySelector(
    "[data-testid='catalog-card-subtitle']",
  );
  return (subtitle?.textContent?.trim().split(" · ") ?? []).map((key) =>
    key.split(".").pop(),
  );
}

// each chip filtering on what the sources offer, with whether it is picked
function chipStates() {
  return [
    ...document.querySelectorAll(
      "[data-testid='provider-label-filter'] [data-label]",
    ),
  ].map((chip) => [
    chip.getAttribute("data-label"),
    chip.getAttribute("aria-pressed"),
  ]);
}

async function pickChip(label: string) {
  document
    .querySelector<HTMLElement>(
      `[data-testid='provider-label-filter'] [data-label='${label}']`,
    )!
    .click();
  await flushPromises();
}

function cardFor(domain: string, container = "body"): Element {
  const card = document.querySelector(
    `${container} [data-testid='catalog-card'][data-domain='${domain}']`,
  );
  if (!card) throw new Error(`no card for ${domain}`);
  return card;
}

function linkTarget(selector: string, root: ParentNode = document) {
  const target = root.querySelector(selector)?.getAttribute("data-to");
  return target ? JSON.parse(target) : undefined;
}

function href(root: Element, testId: string) {
  return root.querySelector(`[data-testid='${testId}']`)?.getAttribute("href");
}
