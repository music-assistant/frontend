/**
 * The main menu lists the pages provider instances serve under a heading of
 * their own, and opens one when it is chosen.
 */
import NavProviderPages from "@/components/navigation/NavProviderPages.vue";
import { api } from "@/plugins/api";
import {
  type ProviderManifest,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { providerInstance } from "../../fixtures/providerInstance";
import { providerManifest } from "../../fixtures/providerManifest";

const { apiMock, hasScope, openProviderPageMock, sidebarMock } = vi.hoisted(
  () => ({
    apiMock: {
      providers: {} as Record<string, unknown>,
      providerManifests: {} as Record<string, unknown>,
    },
    hasScope: vi.fn<(scope: string) => boolean>(),
    openProviderPageMock: vi.fn(),
    sidebarMock: { isMobile: { value: false }, setOpenMobile: vi.fn() },
  }),
);

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { api: reactive(apiMock) };
});
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/helpers/provider_pages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/provider_pages")>()),
  openProviderPage: openProviderPageMock,
}));
vi.mock("@/components/MenuItemIcon.vue", () => ({
  default: {
    props: ["icon"],
    template:
      "<i class=\"menu-icon\" :data-icon=\"typeof icon === 'string' ? icon : 'neutral'\" />",
  },
}));
vi.mock("@/components/ui/sidebar", () => {
  const slotHost = { template: "<div><slot /></div>" };
  return {
    SidebarGroup: slotHost,
    SidebarGroupContent: slotHost,
    SidebarGroupLabel: { template: "<h2><slot /></h2>" },
    SidebarMenu: slotHost,
    SidebarMenuItem: slotHost,
    SidebarMenuButton: {
      props: ["tooltip"],
      template: '<button :data-tooltip="tooltip"><slot /></button>',
    },
    useSidebar: () => sidebarMock,
  };
});

enableAutoUnmount(afterEach);

const STATS = {
  label: "Listening stats",
  scope: Scope.LIBRARY_READ,
  icon: "mdi-chart-line",
};

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  sidebarMock.isMobile.value = false;
  apiMock.providers = {
    "stats--1": providerInstance({
      type: ProviderType.PLUGIN,
      domain: "stats",
      instance_id: "stats--1",
      name: "Stats",
    }),
  };
  apiMock.providerManifests = { stats: manifest(STATS) };
});

describe("NavProviderPages", () => {
  it("lists a page under its own heading", () => {
    const wrapper = mountNav();

    expect(wrapper.find("h2").text()).toBe("provider_pages.heading");
    expect(buttonTexts(wrapper)).toEqual(["Listening stats"]);
    expect(tooltips(wrapper)).toEqual(["Listening stats"]);
    expect(wrapper.find(".menu-icon").attributes("data-icon")).toBe(
      "mdi-chart-line",
    );
  });

  it("draws the neutral icon for an icon that is not a plain name", () => {
    apiMock.providerManifests = {
      stats: manifest({ ...STATS, icon: "https://example.org/i.svg" }),
    };

    expect(mountNav().find(".menu-icon").attributes("data-icon")).toBe(
      "neutral",
    );
  });

  it.each([
    ["no provider declares a page", () => manifest(null)],
    ["an older server sends no page", () => manifest(undefined)],
  ])("shows no heading and no entry when %s", (_case, stats) => {
    apiMock.providerManifests = { stats: stats() };

    expect(mountNav().html()).not.toContain("provider_pages.heading");
  });

  it("shows nothing when the user lacks the page's scope", () => {
    hasScope.mockReturnValue(false);

    expect(mountNav().find("button").exists()).toBe(false);
    expect(hasScope).toHaveBeenCalledWith(Scope.LIBRARY_READ);
  });

  it("names each instance on a second line when there are more", async () => {
    const wrapper = mountNav();
    api.providers["stats--2"] = providerInstance({
      type: ProviderType.PLUGIN,
      domain: "stats",
      instance_id: "stats--2",
      name: "Kitchen",
    });
    await nextTick();

    expect(buttonTexts(wrapper)).toEqual([
      "Listening stats / Kitchen",
      "Listening stats / Stats",
    ]);
    expect(tooltips(wrapper)).toEqual([
      "Listening stats (Kitchen)",
      "Listening stats (Stats)",
    ]);
  });

  it("opens the chosen page, and closes the menu on a phone", async () => {
    sidebarMock.isMobile.value = true;
    const wrapper = mountNav();

    await wrapper.find("button").trigger("click");

    expect(openProviderPageMock).toHaveBeenCalledExactlyOnceWith("stats--1");
    expect(sidebarMock.setOpenMobile).toHaveBeenCalledWith(false);
  });
});

function manifest(page: ProviderManifest["page"]): ProviderManifest {
  return {
    ...providerManifest({ domain: "stats", type: ProviderType.PLUGIN }),
    page,
  };
}

function mountNav() {
  return mount(NavProviderPages, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

/** Per entry, its label and the instance's name under it, if shown. */
function buttonTexts(wrapper: ReturnType<typeof mountNav>) {
  return wrapper.findAll("button").map((button) =>
    button
      .findAll("span span")
      .map((line) => line.text())
      .join(" / "),
  );
}

/** Per entry, the tooltip it shows on the icon rail. */
function tooltips(wrapper: ReturnType<typeof mountNav>) {
  return wrapper
    .findAll("button")
    .map((button) => button.attributes("data-tooltip"));
}
