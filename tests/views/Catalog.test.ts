import Catalog from "@/views/settings/Catalog.vue";
import {
  type ProviderConfig,
  type ProviderManifest,
  ProviderStage,
  ProviderType,
  type Scope,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { providerConfig } from "../fixtures/providerConfig";
import { providerManifest } from "../fixtures/providerManifest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, hasScope, routeMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, ProviderManifest>,
    providers: {} as Record<string, unknown>,
    serverInfo: { value: undefined },
    getProviderConfigs: vi.fn(),
    getProvider: vi.fn(),
    getProviderName: vi.fn(),
    subscribe: vi.fn(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  routeMock: { query: {} as Record<string, string> },
  routerMock: { replace: vi.fn() },
}));

// a link that shows where it leads, so a jump can be asserted
const RouterLinkStub = vi.hoisted(() => ({
  name: "RouterLink",
  props: ["to"],
  template: `<a :data-to="JSON.stringify(to)"><slot /></a>`,
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/store", () => ({ store: { isTouchscreen: true } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
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

beforeEach(() => {
  vi.clearAllMocks();
  routeMock.query = {};
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  apiMock.providerManifests = Object.fromEntries(
    MANIFESTS.map((manifest) => [manifest.domain, manifest]),
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
  document.body.innerHTML = "";
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
});

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
