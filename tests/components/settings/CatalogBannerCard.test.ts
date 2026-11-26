import CatalogBannerCard from "@/components/settings/catalog/CatalogBannerCard.vue";
import { ProviderIconVariant } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { providerManifest } from "../../fixtures/providerManifest";

// an icon drawn in white only
const SVG_WHITE = `data:image/svg+xml;base64,${btoa(
  '<svg><path fill="#ffffff"/></svg>',
)}`;
const SVG_GREEN = `data:image/svg+xml;base64,${btoa(
  '<svg><circle fill="#1DB954"/></svg>',
)}`;

vi.mock("@/plugins/api", () => {
  const api = {
    providers: {},
    providerManifests: {} as Record<string, unknown>,
    providerIcons: {} as Record<string, string>,
    getProviderIcon: vi.fn(),
    getProvider: vi.fn(),
  };
  return { api, default: api };
});
vi.mock("vue-router", () => ({
  RouterLink: {
    name: "RouterLink",
    props: ["to"],
    template: `<a :data-to="JSON.stringify(to)"><slot /></a>`,
  },
}));

const { api } = await import("@/plugins/api");

enableAutoUnmount(afterEach);

describe("CatalogBannerCard", () => {
  it("leads to a page from its name when it has somewhere to go", () => {
    const wrapper = mountCard({ to: { name: "editprovider" } });

    const open = wrapper.get("[data-testid='catalog-card-open']");
    expect(open.element.tagName).toBe("A");
    expect(JSON.parse(open.attributes("data-to")!)).toEqual({
      name: "editprovider",
    });
  });

  it("emits open from its name when openable", async () => {
    const wrapper = mountCard({ openable: true });

    const open = wrapper.get("[data-testid='catalog-card-open']");
    expect(open.element.tagName).toBe("BUTTON");
    await open.trigger("click");
    expect(wrapper.emitted("open")).toHaveLength(1);
  });

  it("shows the name as text when it opens nothing", () => {
    const wrapper = mountCard();

    expect(wrapper.find("[data-testid='catalog-card-open']").exists()).toBe(
      false,
    );
    expect(wrapper.get("h3").text()).toBe("Spotify");
  });

  it("draws the banner in the main colour of the icon", () => {
    registerIcon("spotify", SVG_GREEN);

    const wrapper = mountCard();

    expect(
      wrapper.get("[data-testid='catalog-art']").attributes("style"),
    ).toContain("#1db954");
    expect(
      wrapper.get("[data-testid='catalog-icon-tile']").attributes("data-tile"),
    ).toBe("light");
  });

  it("draws a light banner for an icon without a colour of its own", () => {
    registerIcon("spotify", SVG_WHITE);

    expect(
      mountCard().get("[data-testid='catalog-art']").attributes("data-art"),
    ).toBe("light");

    registerIcon("spotify", SVG_GREEN);

    expect(
      mountCard().get("[data-testid='catalog-art']").attributes("data-art"),
    ).toBe("colour");
  });

  it("draws a banner in the colours of the theme or a red one in place of the icon's colour", () => {
    registerIcon("spotify", SVG_GREEN);

    const muted = mountCard({ tone: "muted" }).get(
      "[data-testid='catalog-art']",
    );
    expect(muted.attributes("data-art")).toBe("light");
    expect(
      mountCard({ tone: "error" })
        .get("[data-testid='catalog-art']")
        .attributes("data-art"),
    ).toBe("error");
  });

  it("puts what it is given on the banner", () => {
    const wrapper = mountCard(
      {},
      { banner: "<span data-testid='status'>Setup failed</span>" },
    );

    expect(
      wrapper
        .get("[data-testid='catalog-art']")
        .find("[data-testid='status']")
        .text(),
    ).toBe("Setup failed");
  });

  it("shows the name it is given in place of its own", () => {
    const wrapper = mountCard(
      { openable: true },
      { name: "<button data-testid='own-name'>Spotify</button>" },
    );

    expect(wrapper.get("h3").find("[data-testid='own-name']").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid='catalog-card-open']").exists()).toBe(
      false,
    );
  });

  it("puts an icon drawn in white only on a dark tile", () => {
    registerIcon("spotify", SVG_WHITE);

    const wrapper = mountCard();

    expect(
      wrapper.get("[data-testid='catalog-icon-tile']").attributes("data-tile"),
    ).toBe("dark");
  });

  it("shows the icon the community catalog gives", () => {
    const wrapper = mountCard({ icon: SVG_GREEN });

    expect(
      wrapper.get("[data-testid='catalog-icon-image']").attributes("src"),
    ).toBe(SVG_GREEN);
  });

  it("puts the badges next to its name and the subtitle below it", () => {
    const wrapper = mountCard(
      {},
      { badges: "<span data-testid='badge'>Beta</span>", subtitle: "Library" },
    );

    expect(
      wrapper.get("h3").element.nextElementSibling?.getAttribute("data-testid"),
    ).toBe("badge");
    expect(wrapper.get("[data-testid='catalog-card-subtitle']").text()).toBe(
      "Library",
    );
  });

  it("leaves out the subtitle when it is given none", () => {
    expect(
      mountCard().find("[data-testid='catalog-card-subtitle']").exists(),
    ).toBe(false);
  });
});

function registerIcon(domain: string, icon: string) {
  api.providerManifests[domain] = providerManifest({
    domain,
    icon_images: [ProviderIconVariant.DEFAULT],
  });
  api.providerIcons[`${domain}:${ProviderIconVariant.DEFAULT}`] = icon;
}

function mountCard(
  props: Partial<InstanceType<typeof CatalogBannerCard>["$props"]> = {},
  slots: Record<string, string> = {},
) {
  return mount(CatalogBannerCard, {
    props: { domain: "spotify", name: "Spotify", ...props },
    slots,
  });
}
