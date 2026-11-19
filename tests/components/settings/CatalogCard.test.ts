import CatalogCard from "@/components/settings/catalog/CatalogCard.vue";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import {
  ProviderOffering,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { communityProvider } from "../../fixtures/communityProvider";
import { providerConfig } from "../../fixtures/providerConfig";
import { providerManifest } from "../../fixtures/providerManifest";

vi.mock("@/plugins/api", () => {
  const api = {
    providers: {},
    providerManifests: {},
    providerIcons: {},
    getProviderIcon: vi.fn(),
    getProvider: vi.fn(),
  };
  return { api, default: api };
});
// a translation shows its key followed by the values it names
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, named?: Record<string, unknown>) =>
    [key, ...Object.values(named ?? {})].join(" "),
}));
// a link that shows where it leads
vi.mock("vue-router", () => ({
  RouterLink: {
    name: "RouterLink",
    props: ["to"],
    template: `<a :data-to="JSON.stringify(to)"><slot /></a>`,
  },
}));

enableAutoUnmount(afterEach);

describe("CatalogCard", () => {
  it("offers Add on one that is not set up, credited to the team", () => {
    const wrapper = mountCard(entry());

    expect(wrapper.find("[data-testid='catalog-card-add']").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid='catalog-card-added']").exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-testid='catalog-card-manage']").exists()).toBe(
      false,
    );
    expect(wrapper.get("[data-testid='catalog-card-type']").text()).toBe(
      "settings.catalog.type.music",
    );
    expect(wrapper.get("[data-testid='catalog-card-credit']").text()).toBe(
      "settings.catalog.by_team",
    );
  });

  it("says Added and leads to its settings once set up, without Add", () => {
    const wrapper = mountCard(
      entry({ instances: [providerConfig({ instance_id: "spotify--a" })] }),
    );

    expect(wrapper.find("[data-testid='catalog-card-added']").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid='catalog-card-add']").exists()).toBe(
      false,
    );
    expect(
      JSON.parse(
        wrapper
          .get("[data-testid='catalog-card-manage']")
          .attributes("data-to")!,
      ),
    ).toEqual({ name: "editprovider", params: { instanceId: "spotify--a" } });
  });

  it("keeps Add next to Manage for one that allows another instance", () => {
    const wrapper = mountCard(
      entry({ instances: [providerConfig()], canAdd: true }),
    );

    expect(wrapper.find("[data-testid='catalog-card-manage']").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid='catalog-card-add']").exists()).toBe(
      true,
    );
  });

  it("shows the progress of an install on Add", () => {
    const wrapper = mountCard(entry(), { installing: true });

    expect(wrapper.get("[data-testid='catalog-card-add']").text()).toBe(
      "settings.catalog.community.installing",
    );
  });

  it("marks one from the community catalog and credits its maintainers", () => {
    const provider = communityProvider("radio");
    const wrapper = mountCard(
      entry({ manifest: provider.manifest, community: provider }),
    );

    expect(
      wrapper.find("[data-testid='catalog-card-community']").exists(),
    ).toBe(true);
    expect(wrapper.get("[data-testid='catalog-card-credit']").text()).toBe(
      "settings.catalog.by_maintainers @jane",
    );
  });

  it("warns of a stage that is not stable", () => {
    const wrapper = mountCard(
      entry({
        manifest: providerManifest({
          domain: "spotify",
          stage: ProviderStage.BETA,
        }),
      }),
    );

    expect(wrapper.text()).toContain("settings.stage.options.beta");
  });

  it("says what it offers, as its manifest says", () => {
    const labels = (manifest: Parameters<typeof providerManifest>[0]) =>
      mountCard(entry({ manifest: providerManifest(manifest) }))
        .findAll("[data-testid='provider-labels'] [data-label]")
        .map((label) => label.attributes("data-label"));

    expect(
      labels({
        provides: [ProviderOffering.ALBUM, ProviderOffering.AUDIOBOOK],
      }),
    ).toEqual(["library", "audiobooks"]);
    expect(
      labels({
        type: ProviderType.PLUGIN,
        provides: [ProviderOffering.AUDIO_SOURCE],
      }),
    ).toEqual(["live"]);
    expect(
      labels({
        type: ProviderType.PLUGIN,
        provides: [ProviderOffering.AI, ProviderOffering.TTS],
      }),
    ).toEqual(["ai", "tts"]);
    expect(labels({})).toEqual([]);
    // other only gathers the plugins without a label for the filter
    expect(labels({ type: ProviderType.PLUGIN })).toEqual([]);
  });

  it("says what it goes well with in place of who maintains it", () => {
    const wrapper = mountCard(entry(), { pairedWith: "Sonos" });

    expect(wrapper.get("[data-testid='catalog-card-paired']").text()).toBe(
      "settings.catalog.goes_well_with Sonos",
    );
    expect(wrapper.find("[data-testid='catalog-card-credit']").exists()).toBe(
      false,
    );
  });

  it("says why it is suggested on a badge, with its name and only when given", () => {
    expect(
      mountCard(entry()).find("[data-testid='catalog-card-badge']").exists(),
    ).toBe(false);

    const wrapper = mountCard(entry(), { badge: "Popular" });

    expect(wrapper.get("[data-testid='catalog-card-badge']").text()).toBe(
      "Popular",
    );
    // as text in the card, read right after its name
    expect(wrapper.text()).toMatch(/^Spotify\s*Popular/);
  });

  it("offers to stop suggesting it only when dismissible", async () => {
    expect(
      mountCard(entry()).find("[data-testid='catalog-card-dismiss']").exists(),
    ).toBe(false);

    const wrapper = mountCard(entry(), { dismissible: true });
    await wrapper.get("[data-testid='catalog-card-dismiss']").trigger("click");

    expect(wrapper.emitted("dismiss")).toHaveLength(1);
    expect(wrapper.emitted("open")).toBeUndefined();
  });

  it("opens its details from the name and adds from Add", async () => {
    const wrapper = mountCard(entry());

    await wrapper.get("[data-testid='catalog-card-open']").trigger("click");
    await wrapper.get("[data-testid='catalog-card-add']").trigger("click");

    expect(wrapper.emitted("open")).toHaveLength(1);
    expect(wrapper.emitted("add")).toHaveLength(1);
  });
});

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  const instances = overrides.instances ?? [];
  return {
    manifest: providerManifest({ domain: "spotify", name: "Spotify" }),
    instances,
    canAdd: instances.length === 0,
    ...overrides,
  };
}

function mountCard(
  catalogEntry: CatalogEntry,
  props: Partial<InstanceType<typeof CatalogCard>["$props"]> = {},
) {
  return mount(CatalogCard, { props: { entry: catalogEntry, ...props } });
}
