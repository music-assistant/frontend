import Catalog from "@/views/settings/Catalog.vue";
import {
  type CommunityProvider,
  CommunityProviderState,
  type CoreConfig,
  EventType,
  type ProviderConfig,
  type ProviderManifest,
  ProviderSharing,
  ProviderStage,
  ProviderTier,
  ProviderType,
  type Scope,
} from "@/plugins/api/interfaces";
import {
  type DeleteConfirmationDialogEvent,
  eventbus,
} from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
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
      providers: {} as Record<string, unknown>,
      serverInfo: { value: undefined },
      getProviderConfigs: vi.fn(),
      getProvider: vi.fn(),
      getProviderName: vi.fn(),
      subscribe: vi.fn(),
      getCoreConfig: vi.fn(),
      saveCoreConfig: vi.fn(),
      getCommunityProviders: vi.fn(),
      refreshCommunityProviders: vi.fn(),
      installCommunityProvider: vi.fn(),
      removeCommunityProvider: vi.fn(),
      updateCommunityProviders: vi.fn(),
      dismissCommunityNotice: vi.fn(),
      fetchProviderManifests: vi.fn(),
    },
    hasScope: vi.fn<(scope: Scope) => boolean>(),
    routeMock: { query: {} as Record<string, string> },
    routerMock: { replace: vi.fn() },
    storeMock: { isTouchscreen: true, currentUser: { user_id: "jane" } },
    toastMock: { success: vi.fn(), error: vi.fn() },
  }));

// a link that shows where it leads, so a jump can be asserted
const RouterLinkStub = vi.hoisted(() => ({
  name: "RouterLink",
  props: ["to"],
  template: `<a :data-to="JSON.stringify(to)"><slot /></a>`,
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
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

let configs: ProviderConfig[] = [];
// what the server keeps of the community catalog
let communityEnabled = false;
let communityAutoUpdate = false;
let community: CommunityProvider[] = [];
let confirmations: DeleteConfirmationDialogEvent[] = [];
const onConfirmation = (event: DeleteConfirmationDialogEvent) =>
  confirmations.push(event);

beforeEach(() => {
  vi.resetAllMocks();
  routeMock.query = {};
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  // reactive like the api's own, so a manifest registered later shows
  apiMock.providerManifests = reactive(
    Object.fromEntries(
      MANIFESTS.map((manifest) => [manifest.domain, manifest]),
    ),
  );
  configs = [
    providerConfig({
      domain: "chromecast",
      type: ProviderType.PLAYER,
      instance_id: "chromecast--a",
    }),
    providerConfig({ domain: "spotify", instance_id: "spotify--a" }),
  ];
  // the server only hands a member its music sources
  apiMock.getProviderConfigs.mockImplementation(async (type?: ProviderType) =>
    type ? configs.filter((config) => config.type === type) : configs,
  );
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  communityEnabled = false;
  communityAutoUpdate = false;
  community = [];
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
      communityEnabled = values.catalog_enabled ?? communityEnabled;
      communityAutoUpdate = values.auto_update ?? communityAutoUpdate;
      return communityCoreConfig(communityEnabled);
    },
  );
  confirmations = [];
  eventbus.on("deleteConfirmationDialog", onConfirmation);
  document.body.innerHTML = "";
});

afterEach(() => {
  eventbus.off("deleteConfirmationDialog", onConfirmation);
});

describe("Catalog", () => {
  it("offers a tab per type with something to add, and the installed view", async () => {
    await mountCatalog();

    expect(tabLabels()).toEqual([
      "settings.catalog.all",
      "settings.music_sources",
      "settings.playerproviders",
      "settings.catalog.installed2",
    ]);
  });

  it("leads with the popular row, then lists everything", async () => {
    await mountCatalog();

    expect(cardNames("[data-testid='catalog-popular']")).toEqual([
      "Spotify",
      "Sonos",
    ]);
    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "Chromecast",
      "Sonos",
      "SoundCloud",
      "Spotify",
    ]);
  });

  it("drops the popular row while searching", async () => {
    const wrapper = await mountCatalog();

    await wrapper.get("[data-slot='input-group-control']").setValue("sound");

    expect(
      document.querySelector("[data-testid='catalog-popular']"),
    ).toBeNull();
    expect(cardNames("[data-testid='catalog-list']")).toEqual(["SoundCloud"]);
  });

  it("drops the popular row while a stage is picked", async () => {
    const wrapper = await mountCatalog();

    wrapper
      .findComponent({ name: "FacetedFilter" })
      .vm.$emit("update:modelValue", [ProviderStage.BETA]);
    await flushPromises();

    expect(
      document.querySelector("[data-testid='catalog-popular']"),
    ).toBeNull();
    expect(cardNames("[data-testid='catalog-list']")).toEqual(["SoundCloud"]);
  });

  it("says when nothing matches the search", async () => {
    const wrapper = await mountCatalog();

    await wrapper.get("[data-slot='input-group-control']").setValue("nothing");

    expect(
      document.querySelector("[data-testid='catalog-empty']"),
    ).not.toBeNull();
  });

  it("opens on the type the route names, with a link to its settings page", async () => {
    routeMock.query = { types: "player" };

    await mountCatalog();

    expect(cardNames("[data-testid='catalog-list']")).toEqual([
      "Chromecast",
      "Sonos",
    ]);
    expect(linkTarget("[data-testid='catalog-manage-link']")).toEqual({
      name: "providersettings",
      query: { types: "player" },
    });
  });

  it("keeps the tab picked in the route", async () => {
    const wrapper = await mountCatalog();

    await wrapper
      .findAll("[data-slot='tabs-trigger']")
      .find((tab) => tab.text() === "settings.playerproviders")!
      .trigger("mousedown", { button: 0 });

    expect(routerMock.replace).toHaveBeenCalledWith({
      query: { types: "player" },
    });
  });

  it("offers a jump instead of Add for a single-instance provider that is set up", async () => {
    await mountCatalog();

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
    await mountCatalog();

    const card = cardFor("spotify", "[data-testid='catalog-list']");
    expect(
      card.querySelector("[data-testid='catalog-card-manage']"),
    ).not.toBeNull();
    expect(
      card.querySelector("[data-testid='catalog-card-add']"),
    ).not.toBeNull();
  });

  it("credits the maintainers or the team on a card", async () => {
    await mountCatalog();

    expect(
      cardFor("soundcloud").querySelector("[data-testid='catalog-card-credit']")
        ?.textContent,
    ).toContain("settings.catalog.by_maintainers");
    expect(
      cardFor("sonos", "[data-testid='catalog-list']").querySelector(
        "[data-testid='catalog-card-credit']",
      )?.textContent,
    ).toContain("settings.catalog.by_team");
  });

  it("starts the setup flow from the Add on a card", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    await mountCatalog();

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
    await mountCatalog();

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
    await mountCatalog();

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
    await mountCatalog();
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
      linkTarget("[data-testid='catalog-installed-row']", groups[1]),
    ).toEqual({
      name: "editprovider",
      params: { instanceId: "chromecast--a" },
    });
    expect(
      linkTarget("[data-testid='catalog-manage-link']", groups[1]),
    ).toEqual({ name: "providersettings", query: { types: "player" } });
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
    await mountCatalog();

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

  it("shows the picked tab in a panel the tab controls", async () => {
    await mountCatalog();

    const tab = document.querySelector(
      "[data-slot='tabs-trigger'][data-state='active']",
    )!;
    const panel = document.getElementById(tab.getAttribute("aria-controls")!);
    expect(panel?.getAttribute("role")).toBe("tabpanel");
    expect(panel?.querySelector("[data-testid='catalog-list']")).not.toBeNull();
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
      expect(tabLabels().at(-1)).toBe("settings.catalog.installed");
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
    expect(cardFor("chromecast")).toBeTruthy();
    expect(tabLabels().at(-1)).toBe("settings.catalog.installed2");
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

describe("Catalog for a member", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  });

  it("only offers the music sources a member may add", async () => {
    routeMock.query = { types: "player" };

    await mountCatalog();

    // a player tab it cannot use opens everything it may add instead
    expect(tabLabels()).toEqual([
      "settings.catalog.all",
      "settings.music_sources",
      "settings.catalog.installed1",
    ]);
    expect(cardNames("[data-testid='catalog-list']")).toEqual(["Spotify"]);
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
          },
        }),
      ];
    });

    it("does not count it as added or offer to manage it", async () => {
      await mountCatalog();

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

      const row = document.querySelector(
        "[data-testid='catalog-installed-row']",
      )!;
      expect(row.textContent).toContain("Shared Spotify");
      expect(row.tagName).toBe("DIV");
      expect(row.hasAttribute("data-to")).toBe(false);
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
          },
        }),
      );

      await mountCatalog();

      expect(linkTarget("[data-testid='catalog-installed-row']")).toEqual({
        name: "editprovider",
        params: { instanceId: "spotify--own" },
      });
    });
  });
});

const OWN_RISK = "You install them at your own risk.";

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
  it("offers an admin the switch, off at first", async () => {
    await mountCatalog();

    const bar = document.querySelector("[data-testid='community-switch']")!;
    expect(bar.textContent).toContain("Community catalog");
    expect(switchToggle().getAttribute("aria-checked")).toBe("false");
  });

  it("switches on only after the server's own-risk text is confirmed", async () => {
    community = [RADIO];
    await mountCatalog();

    switchToggle().click();
    await flushPromises();

    expect(confirmations).toHaveLength(1);
    expect(confirmations[0].message).toBe(OWN_RISK);
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(switchToggle().getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector("[data-domain='radio']")).toBeNull();

    await confirmations[0].onConfirm();
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
      catalog_enabled: true,
    });
    expect(switchToggle().getAttribute("aria-checked")).toBe("true");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.catalog.community.enabled_toast",
    );
    expect(cardNames("[data-testid='catalog-list']")).toContain("Radio Garden");
  });

  it("stays off when the confirmation is cancelled", async () => {
    community = [RADIO];
    await mountCatalog();

    switchToggle().click();
    await flushPromises();
    // a cancelled confirmation never calls back

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(switchToggle().getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector("[data-domain='radio']")).toBeNull();
  });

  it("switches off without a confirmation, and hides what it offers", async () => {
    communityEnabled = true;
    community = [RADIO];
    await mountCatalog();
    expect(cardNames("[data-testid='catalog-list']")).toContain("Radio Garden");

    switchToggle().click();
    await flushPromises();

    expect(confirmations).toHaveLength(0);
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
      catalog_enabled: false,
    });
    expect(switchToggle().getAttribute("aria-checked")).toBe("false");
    expect(cardNames("[data-testid='catalog-list']")).not.toContain(
      "Radio Garden",
    );
  });

  describe("while it is on", () => {
    beforeEach(() => {
      communityEnabled = true;
      community = [RADIO];
    });

    it("lists what it offers in All and in its type, searchable, with the badge and maintainer", async () => {
      const wrapper = await mountCatalog();

      const card = cardFor("radio", "[data-testid='catalog-list']");
      expect(
        card.querySelector("[data-testid='catalog-card-community']"),
      ).not.toBeNull();
      expect(
        card.querySelector("[data-testid='catalog-card-credit']")?.textContent,
      ).toContain("settings.catalog.by_maintainers @jane");

      await wrapper.get("[data-slot='input-group-control']").setValue("world");
      expect(cardNames("[data-testid='catalog-list']")).toEqual([
        "Radio Garden",
      ]);
    });

    it("lists it in the tab of its type", async () => {
      routeMock.query = { types: "music" };

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

    it("shows the icon by its domain for an icon that is not a data URI", async () => {
      community = [{ ...RADIO, icon: "https://tracker.example/icon.png" }];

      await mountCatalog();

      const card = cardFor("radio", "[data-testid='catalog-list']");
      expect(
        card.querySelector("[data-testid='catalog-icon-image']"),
      ).toBeNull();
      expect(card.querySelector("provider-icon-stub")).not.toBeNull();
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
        "https://github.com/jane/ma-radio",
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
        "https://github.com/jane/ma-radio",
      );
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

    it("fetches the list again on refresh", async () => {
      apiMock.refreshCommunityProviders.mockResolvedValue(
        community.slice(0, 1),
      );
      await mountCatalog();

      document
        .querySelector<HTMLElement>("[data-testid='community-refresh']")!
        .click();
      await flushPromises();

      expect(apiMock.refreshCommunityProviders).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.catalog.community.refreshed",
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

    expect(
      document.querySelector("[data-testid='community-unavailable']"),
    ).not.toBeNull();
    expect(
      document.querySelector("[data-testid='community-switch-toggle']"),
    ).toBeNull();
    expect(
      document.querySelector("[data-testid='community-installed']"),
    ).toBeNull();
    expect(
      document.querySelectorAll("[data-testid='catalog-installed-group']"),
    ).toHaveLength(2);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("loads it again on retry after the server refused it", async () => {
    apiMock.getCommunityProviders.mockRejectedValueOnce(new Error("refused"));
    await mountCatalog();

    document
      .querySelector<HTMLElement>("[data-testid='community-retry']")!
      .click();
    await flushPromises();

    expect(
      document.querySelector("[data-testid='community-unavailable']"),
    ).toBeNull();
    expect(switchToggle()).not.toBeNull();
  });

  it("waits for the community catalog before showing the page", async () => {
    apiMock.getCommunityProviders.mockReturnValue(new Promise(() => {}));

    await mountCatalog();

    expect(
      document.querySelector("[data-testid='catalog-loading']"),
    ).not.toBeNull();
    expect(document.querySelector("[data-testid='catalog-card']")).toBeNull();
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
          notice: "moved",
        }),
      ];
      routeMock.query = query;

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='community-switch']"),
      ).toBeNull();
      expect(
        document.querySelector("[data-testid='community-moved']"),
      ).toBeNull();
      expect(
        document.querySelector("[data-testid='catalog-updates-count']"),
      ).toBeNull();
      expect(
        document.querySelector("[data-testid='catalog-community-new']"),
      ).toBeNull();
      expect(
        document.querySelector("[data-testid='community-installed']"),
      ).toBeNull();
      expect(document.querySelector("[data-domain='radio']")).toBeNull();
      expect(apiMock.getCommunityProviders).not.toHaveBeenCalled();
      expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
    },
  );
});

describe("Catalog with updates from the community catalog", () => {
  const updatable = (domain: string, name: string, from: string, to: string) =>
    communityProvider(domain, {
      state: CommunityProviderState.UPDATE_AVAILABLE,
      installed_version: from,
      latest_version: to,
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
      expect(
        document.querySelector("[data-testid='catalog-updates-count']")
          ?.textContent,
      ).toContain("2");
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
      expect(
        document.querySelector("[data-testid='catalog-updates-count']")
          ?.textContent,
      ).toContain("1");
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
        "settings.catalog.community.retry_version",
      );

      updateButton("fm").click();
      await flushPromises();

      expect(apiMock.updateCommunityProviders).toHaveBeenCalledWith("fm");
    });

    it("turns automatic updates on", async () => {
      await mountCatalog();
      const toggle = autoUpdateToggle()!;
      expect(toggle.getAttribute("aria-checked")).toBe("false");

      toggle.click();
      await flushPromises();

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("community_catalog", {
        auto_update: true,
      });
      expect(autoUpdateToggle()!.getAttribute("aria-checked")).toBe("true");
    });

    it("leaves automatic updates out while the community catalog is off", async () => {
      communityEnabled = false;

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='community-installed']"),
      ).not.toBeNull();
      expect(autoUpdateToggle()).toBeNull();
    });
  });

  it("shows the version on offer with its date and an Update in the details", async () => {
    apiMock.providerManifests.radio = RADIO.manifest;
    communityEnabled = true;
    community = [
      {
        ...RADIO,
        state: CommunityProviderState.UPDATE_AVAILABLE,
        installed_version: "1.1.0",
      },
    ];
    apiMock.updateCommunityProviders.mockResolvedValue(community);
    await mountCatalog();

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

  it("shows the version on offer without a release date that is not a date", async () => {
    apiMock.providerManifests.radio = RADIO.manifest;
    communityEnabled = true;
    community = [
      {
        ...RADIO,
        state: CommunityProviderState.UPDATE_AVAILABLE,
        installed_version: "1.1.0",
        released: "soon",
      },
    ];
    await mountCatalog();

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

    it("names it above the tabs, also while the community catalog is off", async () => {
      await mountCatalog();

      const notice = document.querySelector("[data-testid='community-moved']")!;
      expect(notice.textContent).toContain(
        "settings.catalog.community.moved_title Radio Garden",
      );
      expect(notice.textContent).toContain(
        "settings.catalog.community.moved_message",
      );
      const tabs = document.querySelector("[data-testid='catalog-tabs']")!;
      expect(
        notice.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
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
  });

  describe("what is new", () => {
    beforeEach(() => {
      communityEnabled = true;
      community = [
        RADIO,
        communityProvider("dj", {
          added: "2026-11-05T00:00:00Z",
          released: "2026-11-06T00:00:00Z",
          manifest: providerManifest({
            domain: "dj",
            name: "DJ",
            tier: ProviderTier.COMMUNITY,
          }),
        }),
        communityProvider("lyrics", {
          added: "not a date",
          released: "2026-11-10T00:00:00Z",
          manifest: providerManifest({
            domain: "lyrics",
            name: "Lyrics",
            tier: ProviderTier.COMMUNITY,
          }),
        }),
      ];
    });

    it("leads All with what is new and what was updated, newest first, each once", async () => {
      await mountCatalog();

      expect(cardNames("[data-testid='catalog-community-new']")).toEqual([
        "DJ",
        "Radio Garden",
      ]);
      expect(cardNames("[data-testid='catalog-community-updated']")).toEqual([
        "Lyrics",
      ]);
      expect(
        document.querySelector("[data-testid='catalog-community-new'] h2")
          ?.textContent,
      ).toContain("settings.catalog.community.new_title");
    });

    it("leaves out a row with nothing to show", async () => {
      community = [RADIO];

      await mountCatalog();

      expect(cardNames("[data-testid='catalog-community-new']")).toEqual([
        "Radio Garden",
      ]);
      expect(
        document.querySelector("[data-testid='catalog-community-updated']"),
      ).toBeNull();
    });

    it("shows no rows on the tab of a type, or while searching", async () => {
      routeMock.query = { types: "music" };
      const wrapper = await mountCatalog();

      expect(
        document.querySelector("[data-testid='catalog-community-new']"),
      ).toBeNull();

      routeMock.query = {};
      wrapper.unmount();
      const all = await mountCatalog();
      await all.get("[data-slot='input-group-control']").setValue("dj");

      expect(
        document.querySelector("[data-testid='catalog-community-new']"),
      ).toBeNull();
    });

    it("shows no rows while the community catalog is off", async () => {
      communityEnabled = false;
      community = [
        communityProvider("radio", { state: CommunityProviderState.INSTALLED }),
      ];

      await mountCatalog();

      expect(
        document.querySelector("[data-testid='catalog-community-new']"),
      ).toBeNull();
      expect(
        document.querySelector("[data-testid='catalog-community-updated']"),
      ).toBeNull();
    });
  });
});

function updateButton(domain: string): HTMLElement {
  return installedRow(domain).querySelector<HTMLElement>(
    "[data-testid='community-update']",
  )!;
}

function autoUpdateToggle(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    "[data-testid='community-auto-update-toggle']",
  );
}

function communityCoreConfig(enabled: boolean): CoreConfig {
  return {
    domain: "community_catalog",
    last_error: null,
    values: {
      catalog_enabled: {
        key: "catalog_enabled",
        label: "Community catalog",
        description: OWN_RISK,
        value: enabled,
      },
      auto_update: { key: "auto_update", value: communityAutoUpdate },
    },
  } as unknown as CoreConfig;
}

// the server says the community catalog changed
async function catalogUpdated() {
  await apiMock.subscribe.mock.calls.find(
    ([event]) => event === EventType.COMMUNITY_CATALOG_UPDATED,
  )![1]();
  await flushPromises();
}

function switchToggle(): HTMLElement {
  return document.querySelector<HTMLElement>(
    "[data-testid='community-switch-toggle']",
  )!;
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
    ...document.querySelectorAll("[data-testid='community-installed-row']"),
  ];
}

function installedRow(domain: string): Element {
  const row = document.querySelector(
    `[data-testid='community-installed-row'][data-domain='${domain}']`,
  );
  if (!row) throw new Error(`no installed row for ${domain}`);
  return row;
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

async function openDetail(domain: string) {
  cardFor(domain, "[data-testid='catalog-list']")
    .querySelector<HTMLElement>("[data-testid='catalog-card-open']")!
    .click();
  await flushPromises();
}

function tabLabels() {
  return [...document.querySelectorAll("[data-slot='tabs-trigger']")].map(
    (tab) => tab.textContent?.replace(/\s+/g, ""),
  );
}

function cardNames(container: string) {
  return [
    ...document.querySelectorAll(
      `${container} [data-testid='catalog-card-open']`,
    ),
  ].map((name) => name.textContent?.trim());
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
