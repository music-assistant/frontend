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

// what the card can say on the left of its actions
const STATUS_SELECTOR = [
  "catalog-card-added",
  "catalog-card-paired",
  "catalog-card-badge",
  "catalog-card-credit",
]
  .map((testid) => `[data-testid='${testid}']`)
  .join(", ");

enableAutoUnmount(afterEach);

describe("CatalogCard", () => {
  it("offers Add on one that is not set up, with no status", () => {
    const wrapper = mountCard(entry());

    expect(wrapper.get("[data-testid='catalog-card-add']").text()).toBe(
      "settings.catalog.add",
    );
    expect(wrapper.find("[data-testid='catalog-card-added']").exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-testid='catalog-card-manage']").exists()).toBe(
      false,
    );
    // the team's own are credited in their details only
    expect(wrapper.find("[data-testid='catalog-card-credit']").exists()).toBe(
      false,
    );
  });

  it("says Added and leads to its settings once set up, without Add", () => {
    const wrapper = mountCard(
      entry({ instances: [providerConfig({ instance_id: "spotify--a" })] }),
    );

    expect(wrapper.get("[data-testid='catalog-card-added']").text()).toBe(
      "settings.catalog.added",
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

  it("keeps Add, as its icon alone, next to Manage for one that allows another instance", async () => {
    const wrapper = mountCard(
      entry({ instances: [providerConfig()], canAdd: true }),
    );

    expect(wrapper.find("[data-testid='catalog-card-manage']").exists()).toBe(
      true,
    );
    const add = wrapper.get("[data-testid='catalog-card-add']");
    expect(add.text()).toBe("");
    expect(add.attributes("aria-label")).toBe(
      "settings.catalog.add_named Spotify",
    );
    await add.trigger("click");
    expect(wrapper.emitted("add")).toHaveLength(1);
  });

  it("shows the progress of an install on Add", () => {
    const wrapper = mountCard(entry(), { installing: true });

    expect(wrapper.get("[data-testid='catalog-card-add']").text()).toBe(
      "settings.catalog.community.installing",
    );
  });

  it("marks one from the community catalog and credits its maintainers", () => {
    const wrapper = mountCard(communityEntry());

    expect(wrapper.get("[data-testid='catalog-card-community']").text()).toBe(
      "settings.provider_community",
    );
    expect(wrapper.get("[data-testid='catalog-card-credit']").text()).toBe(
      "settings.catalog.by_maintainers @jane",
    );
  });

  it("credits the maintainers of one from the community only", () => {
    const wrapper = mountCard(
      entry({
        manifest: providerManifest({
          domain: "spotify",
          name: "Spotify",
          codeowners: ["@jane"],
        }),
      }),
    );

    expect(wrapper.find("[data-testid='catalog-card-credit']").exists()).toBe(
      false,
    );
  });

  it("warns of a stage that is not stable, next to its name", () => {
    const wrapper = mountCard(
      entry({
        manifest: providerManifest({
          domain: "spotify",
          name: "Spotify",
          stage: ProviderStage.BETA,
        }),
      }),
    );

    const tag = wrapper.get("[data-testid='catalog-stage-tag']");
    expect(tag.text()).toBe("settings.stage.options.beta");
    expect(wrapper.get("h3").element.parentElement!.contains(tag.element)).toBe(
      true,
    );
    expect(
      mountCard(entry()).find("[data-testid='catalog-stage-tag']").exists(),
    ).toBe(false);
  });

  it("says what it offers below its name, as its manifest says", () => {
    const subtitle = (manifest: Parameters<typeof providerManifest>[0]) =>
      mountCard(entry({ manifest: providerManifest(manifest) }))
        .find("[data-testid='catalog-card-subtitle']")
        .text();

    expect(
      subtitle({
        provides: [ProviderOffering.ALBUM, ProviderOffering.AUDIOBOOK],
      }),
    ).toBe(
      "settings.source_labels.library · settings.source_labels.audiobooks",
    );
    expect(
      subtitle({
        type: ProviderType.PLUGIN,
        provides: [ProviderOffering.AUDIO_SOURCE],
      }),
    ).toBe("settings.source_labels.live");
    expect(
      subtitle({
        type: ProviderType.PLUGIN,
        provides: [ProviderOffering.AI, ProviderOffering.TTS],
      }),
    ).toBe("settings.plugin_labels.ai · settings.plugin_labels.tts");
  });

  it("leaves out the line below its name when it offers nothing to label", () => {
    const hasSubtitle = (manifest: Parameters<typeof providerManifest>[0]) =>
      mountCard(entry({ manifest: providerManifest(manifest) }))
        .find("[data-testid='catalog-card-subtitle']")
        .exists();

    expect(hasSubtitle({})).toBe(false);
    // other only gathers the plugins without a label for the filter
    expect(hasSubtitle({ type: ProviderType.PLUGIN })).toBe(false);
  });

  it("says its type first only when asked to, for a list of every type", () => {
    const manifest = providerManifest({
      domain: "spotify",
      name: "Spotify",
      provides: [ProviderOffering.TRACK],
    });

    expect(
      mountCard(entry({ manifest }))
        .get("[data-testid='catalog-card-subtitle']")
        .text(),
    ).toBe("settings.source_labels.library");
    expect(
      mountCard(entry({ manifest }), { showType: true })
        .get("[data-testid='catalog-card-subtitle']")
        .text(),
    ).toBe("settings.catalog.type.music · settings.source_labels.library");
    // with nothing to label, the type is said on its own
    expect(
      mountCard(entry(), { showType: true })
        .get("[data-testid='catalog-card-subtitle']")
        .text(),
    ).toBe("settings.catalog.type.music");
  });

  it("says what it goes well with in place of who maintains it", () => {
    const wrapper = mountCard(communityEntry(), { pairedWith: "Sonos" });

    expect(wrapper.get("[data-testid='catalog-card-paired']").text()).toBe(
      "settings.catalog.goes_well_with Sonos",
    );
    expect(wrapper.find("[data-testid='catalog-card-credit']").exists()).toBe(
      false,
    );
  });

  it("says why it is suggested only when given, below the description", () => {
    expect(
      mountCard(entry()).find("[data-testid='catalog-card-badge']").exists(),
    ).toBe(false);

    const wrapper = mountCard(
      entry({
        manifest: providerManifest({
          domain: "spotify",
          name: "Spotify",
          description: "Stream from Spotify",
        }),
      }),
      { badge: "Popular" },
    );

    expect(wrapper.get("[data-testid='catalog-card-badge']").text()).toBe(
      "Popular",
    );
    expect(wrapper.text()).toMatch(/Stream from Spotify\s*Popular/);
  });

  it("states the first that applies of Added, the pairing, the reason and the maintainers", () => {
    const status = (
      catalogEntry: CatalogEntry,
      props: Partial<InstanceType<typeof CatalogCard>["$props"]> = {},
    ) =>
      mountCard(catalogEntry, props)
        .findAll(STATUS_SELECTOR)
        .map((shown) => shown.attributes("data-testid"));
    const pairedAndSuggested = { pairedWith: "Sonos", badge: "Popular" };

    expect(
      status(
        communityEntry({ instances: [providerConfig()] }),
        pairedAndSuggested,
      ),
    ).toEqual(["catalog-card-added"]);
    expect(status(communityEntry(), pairedAndSuggested)).toEqual([
      "catalog-card-paired",
    ]);
    expect(status(communityEntry(), { badge: "Popular" })).toEqual([
      "catalog-card-badge",
    ]);
    expect(status(communityEntry())).toEqual(["catalog-card-credit"]);
    expect(status(entry())).toEqual([]);
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

// one from the community catalog, maintained by @jane
function communityEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  const provider = communityProvider("radio");
  return entry({
    manifest: provider.manifest,
    community: provider,
    ...overrides,
  });
}
