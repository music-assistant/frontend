import {
  getProviderPageEntries,
  openProviderPage,
} from "@/helpers/provider_pages";
import {
  type ProviderInstance,
  type ProviderManifest,
  type ProviderPage,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { providerManifest } from "../../tests/fixtures/providerManifest";

const { apiMock, ingressMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    baseUrl: "",
    isRemoteConnection: { value: false },
    serverInfo: { value: { internal_url: null as string | null } },
    openProviderPage: vi.fn<(instanceId: string) => Promise<string>>(),
  },
  ingressMock: vi.fn(() => false),
  toastMock: { info: vi.fn(), warning: vi.fn() },
}));

vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/helpers/ingress", () => ({
  isHomeAssistantIngressSession: ingressMock,
}));

const STATS: ProviderPage = {
  label: "Listening stats",
  scope: Scope.LIBRARY_READ,
  icon: "mdi-chart-line",
};
const ADDRESS = "provider_page/abc123/";
const HOME_ADDRESS = "http://192.168.1.3:8095";

describe("getProviderPageEntries", () => {
  const holdsAll = () => true;

  it("offers the page of an available instance, as its manifest declares it", () => {
    expect(
      getProviderPageEntries(
        [instance("stats")],
        { stats: manifest("stats", STATS) },
        holdsAll,
      ),
    ).toEqual([
      {
        instanceId: "stats",
        label: "Listening stats",
        icon: "mdi-chart-line",
        instanceName: undefined,
      },
    ]);
  });

  it.each([
    ["an instance that is not available", { available: false }, STATS],
    ["a provider without a page", {}, null],
    ["a provider from an older server", {}, undefined],
  ] as [string, Partial<ProviderInstance>, ProviderPage | null | undefined][])(
    "offers nothing for %s",
    (_case, overrides, page) => {
      expect(
        getProviderPageEntries(
          [instance("stats", overrides)],
          { stats: manifest("stats", page) },
          holdsAll,
        ),
      ).toEqual([]);
    },
  );

  it("offers nothing when the user lacks the page's scope", () => {
    const hasScope = vi.fn((scope: Scope) => scope !== Scope.LIBRARY_READ);

    expect(
      getProviderPageEntries(
        [instance("stats")],
        { stats: manifest("stats", STATS) },
        hasScope,
      ),
    ).toEqual([]);
    expect(hasScope).toHaveBeenCalledWith(Scope.LIBRARY_READ);
  });

  it.each(["mdi-Chart", "fa-chart", "<svg/>", null])(
    "draws the neutral icon for the declared icon %s",
    (icon) => {
      const [entry] = getProviderPageEntries(
        [instance("stats")],
        { stats: manifest("stats", { ...STATS, icon }) },
        holdsAll,
      );

      expect(entry.icon).toBeNull();
    },
  );

  it("names the instance only when its provider offers more than one, sorted by label", () => {
    const entries = getProviderPageEntries(
      [
        instance("stats--2", { domain: "stats", name: "Kitchen" }),
        instance("stats--1", { domain: "stats", name: " " }),
        instance("frame", { domain: "frame" }),
      ],
      {
        stats: manifest("stats", STATS),
        frame: manifest("frame", { ...STATS, label: "Art frame" }),
      },
      holdsAll,
    );

    expect(entries.map((e) => [e.label, e.instanceName])).toEqual([
      ["Art frame", undefined],
      ["Listening stats", "Kitchen"],
      // an instance renamed to blanks is named after its provider
      ["Listening stats", "Stats"],
    ]);
  });
});

describe("openProviderPage", () => {
  let click: ReturnType<typeof vi.spyOn>;
  const opened = () =>
    click.mock.contexts.map((anchor: unknown) =>
      (anchor as HTMLAnchorElement).getAttribute("href"),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.baseUrl = "http://ma.local:8095";
    apiMock.isRemoteConnection = ref(false);
    apiMock.serverInfo.value = { internal_url: HOME_ADDRESS };
    apiMock.openProviderPage.mockResolvedValue(ADDRESS);
    ingressMock.mockReturnValue(false);
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the page on the server address on a direct connection", async () => {
    await openProviderPage("stats");

    expect(apiMock.openProviderPage).toHaveBeenCalledExactlyOnceWith("stats");
    expect(opened()).toEqual([`http://ma.local:8095/${ADDRESS}`]);
    expect(toastMock.info).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
  });

  it("keeps the base path of the server address", async () => {
    apiMock.baseUrl = "https://example.org/music/";

    await openProviderPage("stats");

    expect(opened()).toEqual([`https://example.org/music/${ADDRESS}`]);
  });

  it.each([
    ["Home Assistant Ingress", () => ingressMock.mockReturnValue(true)],
    ["Remote Access", () => (apiMock.isRemoteConnection.value = true)],
  ])(
    "opens on the home network address under %s, and says so",
    async (_way, connect) => {
      connect();

      await openProviderPage("stats");

      expect(opened()).toEqual([`${HOME_ADDRESS}/${ADDRESS}`]);
      expect(toastMock.info).toHaveBeenCalledExactlyOnceWith(
        "provider_pages.home_network",
      );
    },
  );

  it("opens nothing without a home network address, and says so", async () => {
    apiMock.isRemoteConnection.value = true;
    apiMock.serverInfo.value = { internal_url: null };

    await openProviderPage("stats");

    expect(opened()).toEqual([]);
    expect(toastMock.warning).toHaveBeenCalledExactlyOnceWith(
      "provider_pages.unavailable",
    );
  });

  it("opens nothing when the server refuses, leaving the message to the api", async () => {
    apiMock.openProviderPage.mockRejectedValue(new Error("no page"));

    await openProviderPage("stats");

    expect(opened()).toEqual([]);
    expect(toastMock.info).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
  });
});

function instance(
  instanceId: string,
  overrides: Partial<ProviderInstance> = {},
): ProviderInstance {
  return providerInstance({
    type: ProviderType.PLUGIN,
    domain: instanceId,
    name: instanceId,
    instance_id: instanceId,
    ...overrides,
  });
}

function manifest(
  domain: string,
  page: ProviderPage | null | undefined,
): ProviderManifest {
  const name = domain.charAt(0).toUpperCase() + domain.slice(1);
  return { ...providerManifest({ domain, name }), page };
}
