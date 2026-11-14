import {
  type ProviderConfig,
  type ProviderManifest,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerConfig } from "../../tests/fixtures/providerConfig";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import {
  buildCatalogEntries,
  CATALOG_ALL_TAB,
  CATALOG_INSTALLED_TAB,
  type CatalogEntry,
  filterCatalogEntries,
  getCatalogRoute,
  getCatalogTab,
  getCatalogTabQuery,
  getManageRoute,
  getMaintainerProfileUrl,
  getPopularEntries,
  groupInstalledProviders,
  isOfferable,
  MEMBER_ADD_RESTRICTIONS,
  sortPopularFirst,
} from "./provider_catalog";

// a cross-section of what a server ships: every type, single and multi
// instance, self-service or not, builtin, retired and a core module
const MANIFESTS: ProviderManifest[] = [
  manifest("spotify", "Spotify", ProviderType.MUSIC, { multi_instance: true }),
  manifest("tidal", "Tidal", ProviderType.MUSIC, { multi_instance: true }),
  manifest("filesystem_local", "Local disk", ProviderType.MUSIC, {
    multi_instance: true,
    self_service: false,
  }),
  manifest("soundcloud", "SoundCloud", ProviderType.MUSIC, {
    stage: ProviderStage.BETA,
  }),
  manifest("builtin_player", "Built-in player", ProviderType.PLAYER, {
    builtin: true,
  }),
  manifest("sonos", "Sonos", ProviderType.PLAYER),
  manifest("chromecast", "Chromecast", ProviderType.PLAYER),
  manifest("airplay", "AirPlay", ProviderType.PLAYER),
  manifest("local_audio", "Local Audio Out", ProviderType.PLAYER, {
    stage: ProviderStage.DEPRECATED,
  }),
  manifest("fanarttv", "fanart.tv", ProviderType.METADATA),
  manifest("spotify_connect", "Spotify Connect", ProviderType.PLUGIN, {
    multi_instance: true,
    depends_on: "spotify",
  }),
  manifest("airplay_receiver", "AirPlay Receiver", ProviderType.PLUGIN, {
    stage: ProviderStage.ALPHA,
  }),
  manifest("party", "Party", ProviderType.PLUGIN),
  manifest("cast", "Cast", "core" as ProviderType),
  manifest("essentia", "Essentia", ProviderType.AUDIO_ANALYSIS),
];

const CONFIGS: ProviderConfig[] = [
  providerConfig({ domain: "spotify", instance_id: "spotify--a" }),
  providerConfig({
    domain: "chromecast",
    type: ProviderType.PLAYER,
    instance_id: "chromecast--a",
  }),
  providerConfig({
    domain: "party",
    type: ProviderType.PLUGIN,
    instance_id: "party--a",
  }),
];

describe("what can be added", () => {
  // the list the add dialog shows: what may be added, popular first
  const addable = (types: ProviderType[] = [], restrictions = {}) =>
    names(
      filterCatalogEntries(
        sortPopularFirst(
          buildCatalogEntries(MANIFESTS, CONFIGS, restrictions).filter(
            (entry) => entry.canAdd,
          ),
        ),
        { types },
      ),
    );

  it("offers an admin everything but builtin, retired, core and configured single-instance providers", () => {
    expect(addable()).toEqual([
      "Spotify",
      "Tidal",
      "Local disk",
      "Sonos",
      "AirPlay",
      "Spotify Connect",
      "AirPlay Receiver",
      "Essentia",
      "fanart.tv",
      "SoundCloud",
    ]);
  });

  it.each([
    [ProviderType.MUSIC, ["Spotify", "Tidal", "Local disk", "SoundCloud"]],
    [ProviderType.PLAYER, ["Sonos", "AirPlay"]],
    [ProviderType.METADATA, ["fanart.tv"]],
    [ProviderType.PLUGIN, ["Spotify Connect", "AirPlay Receiver"]],
    [ProviderType.AUDIO_ANALYSIS, ["Essentia"]],
  ])("offers an admin per type %s", (type, expected) => {
    expect(addable([type])).toEqual(expected);
  });

  it("offers a member only music sources that allow another account and that it may set up", () => {
    expect(addable([], MEMBER_ADD_RESTRICTIONS)).toEqual(["Spotify", "Tidal"]);
  });

  // the cases the add dialog is tested with
  it("puts the app receivers first without hiding other plugins", () => {
    expect(
      names(
        sortPopularFirst(
          buildCatalogEntries(MANIFESTS, [], {
            types: [ProviderType.PLUGIN],
          }),
        ),
      ),
    ).toEqual(["Spotify Connect", "AirPlay Receiver", "Party"]);
  });

  it("never offers a deprecated provider", () => {
    expect(isOfferable(manifestOf("local_audio"))).toBe(false);
  });

  it("offers only multi-instance providers when restricted", () => {
    expect(
      isOfferable(manifest("smb", "SMB", ProviderType.MUSIC), {
        multiInstanceOnly: true,
      }),
    ).toBe(false);
  });

  it("offers only providers that members may set up when restricted", () => {
    expect(
      isOfferable(manifestOf("filesystem_local"), { selfServiceOnly: true }),
    ).toBe(false);
    expect(isOfferable(manifestOf("spotify"), { selfServiceOnly: true })).toBe(
      true,
    );
  });

  it("does not offer a type the catalog has no tab for", () => {
    expect(isOfferable(manifestOf("cast"))).toBe(false);
  });
});

describe("buildCatalogEntries", () => {
  const entries = buildCatalogEntries(MANIFESTS, CONFIGS);

  it("lists what is set up, alphabetically", () => {
    expect(names(entries)).toEqual([
      "AirPlay",
      "AirPlay Receiver",
      "Chromecast",
      "Essentia",
      "fanart.tv",
      "Local disk",
      "Party",
      "Sonos",
      "SoundCloud",
      "Spotify",
      "Spotify Connect",
      "Tidal",
    ]);
  });

  it("keeps a single-instance provider that is set up, without Add", () => {
    const chromecast = entry(entries, "chromecast");
    expect(chromecast.instances.map((x) => x.instance_id)).toEqual([
      "chromecast--a",
    ]);
    expect(chromecast.canAdd).toBe(false);
  });

  it("keeps Add for a provider that allows another instance", () => {
    const spotify = entry(entries, "spotify");
    expect(spotify.instances).toHaveLength(1);
    expect(spotify.canAdd).toBe(true);
  });

  it("offers Add for what is not set up", () => {
    expect(entry(entries, "sonos")).toMatchObject({
      instances: [],
      canAdd: true,
    });
  });
});

describe("filterCatalogEntries", () => {
  const entries = buildCatalogEntries(MANIFESTS, []);

  it("searches the name and the description, ignoring case and spaces", () => {
    expect(
      names(filterCatalogEntries(entries, { query: "  RECEIVER " })),
    ).toEqual(["AirPlay Receiver"]);
    expect(names(filterCatalogEntries(entries, { query: "speakers" }))).toEqual(
      ["Sonos"],
    );
  });

  it("narrows to the stages picked", () => {
    expect(
      names(
        filterCatalogEntries(entries, {
          stages: [ProviderStage.ALPHA, ProviderStage.BETA],
        }),
      ),
    ).toEqual(["AirPlay Receiver", "SoundCloud"]);
  });

  it("combines search, types and stages", () => {
    expect(
      names(
        filterCatalogEntries(entries, {
          query: "air",
          types: [ProviderType.PLAYER],
          stages: [ProviderStage.STABLE],
        }),
      ),
    ).toEqual(["AirPlay"]);
  });

  it("matches everything without criteria", () => {
    expect(filterCatalogEntries(entries, {})).toEqual(entries);
  });
});

describe("getPopularEntries", () => {
  it("lists the popular entries in their popular order", () => {
    expect(
      names(getPopularEntries(buildCatalogEntries(MANIFESTS, []))),
    ).toEqual([
      "Spotify",
      "Tidal",
      "Local disk",
      "Sonos",
      "Chromecast",
      "AirPlay",
      "Spotify Connect",
      "AirPlay Receiver",
    ]);
  });

  it("leaves out a popular single-instance provider that is set up", () => {
    const popular = names(
      getPopularEntries(buildCatalogEntries(MANIFESTS, CONFIGS)),
    );
    expect(popular).not.toContain("Chromecast");
    // another account can still be added
    expect(popular).toContain("Spotify");
  });
});

describe("getManageRoute", () => {
  it("leads to the settings of the one instance", () => {
    expect(
      getManageRoute(entry(buildCatalogEntries(MANIFESTS, CONFIGS), "spotify")),
    ).toEqual({ name: "editprovider", params: { instanceId: "spotify--a" } });
  });

  it("leads to the settings page of the type for several instances", () => {
    const configs = [
      ...CONFIGS,
      providerConfig({ domain: "spotify", instance_id: "spotify--b" }),
    ];
    expect(
      getManageRoute(entry(buildCatalogEntries(MANIFESTS, configs), "spotify")),
    ).toEqual({ name: "providersettings", query: { types: "music" } });
  });
});

describe("catalog tabs", () => {
  const types = [ProviderType.MUSIC, ProviderType.PLAYER];

  it.each([
    [{}, CATALOG_ALL_TAB],
    [{ types: "player" }, ProviderType.PLAYER],
    [{ types: "player,music" }, ProviderType.PLAYER],
    [{ types: "plugin" }, CATALOG_ALL_TAB],
    [{ types: "bogus" }, CATALOG_ALL_TAB],
    [{ view: "installed", types: "music" }, CATALOG_INSTALLED_TAB],
  ])("opens %o on the %s tab", (query, tab) => {
    expect(getCatalogTab(query, types)).toBe(tab);
  });

  it.each([
    [CATALOG_ALL_TAB, {}],
    [CATALOG_INSTALLED_TAB, { view: "installed" }],
    [ProviderType.METADATA, { types: "metadata" }],
  ] as const)("keeps the %s tab in the query", (tab, query) => {
    expect(getCatalogTabQuery(tab)).toEqual(query);
    // the query read back opens the same tab
    expect(getCatalogTab(query, [ProviderType.METADATA])).toBe(tab);
  });

  it("opens the Catalog on the type of a settings page", () => {
    expect(getCatalogRoute("player")).toEqual({
      name: "catalog",
      query: { types: "player" },
    });
  });

  it("opens the Catalog on everything for a page without a known type", () => {
    expect(getCatalogRoute(undefined)).toEqual({ name: "catalog", query: {} });
    expect(getCatalogRoute("core")).toEqual({ name: "catalog", query: {} });
  });
});

describe("groupInstalledProviders", () => {
  const configs = [
    providerConfig({ domain: "tidal", instance_id: "tidal--a" }),
    providerConfig({
      domain: "builtin_player",
      type: ProviderType.PLAYER,
      instance_id: "builtin_player",
    }),
    ...CONFIGS,
    providerConfig({
      domain: "spotify",
      instance_id: "spotify--b",
      name: "Another Spotify",
    }),
  ];
  const manifests = Object.fromEntries(MANIFESTS.map((m) => [m.domain, m]));
  const getName = (config: ProviderConfig) =>
    config.name || manifests[config.domain].name;

  it("groups per type in tab order, by name within a type", () => {
    const groups = groupInstalledProviders(configs, manifests, true, getName);
    expect(
      groups.map((group) => [
        group.type.type,
        group.items.map((item) => item.name),
      ]),
    ).toEqual([
      [ProviderType.MUSIC, ["Another Spotify", "Spotify", "Tidal"]],
      [ProviderType.PLAYER, ["Built-in player", "Chromecast"]],
      [ProviderType.PLUGIN, ["Party"]],
    ]);
  });

  it("leaves out the providers that ship with the server when asked", () => {
    const groups = groupInstalledProviders(configs, manifests, false, getName);
    expect(groups[1].items.map((item) => item.name)).toEqual(["Chromecast"]);
  });

  it("has no groups when nothing is set up", () => {
    expect(groupInstalledProviders([], manifests, true, getName)).toEqual([]);
  });
});

describe("getMaintainerProfileUrl", () => {
  it("links a handle to its GitHub profile", () => {
    expect(getMaintainerProfileUrl("@jane")).toBe("https://github.com/jane");
  });
});

function manifest(
  domain: string,
  name: string,
  type: ProviderType,
  overrides: Partial<ProviderManifest> = {},
): ProviderManifest {
  return providerManifest({
    domain,
    name,
    type,
    description: domain === "sonos" ? "Play on your Sonos speakers" : "",
    ...overrides,
  });
}

function manifestOf(domain: string): ProviderManifest {
  const found = MANIFESTS.find((item) => item.domain === domain);
  if (!found) throw new Error(`no manifest for ${domain}`);
  return found;
}

function names(entries: CatalogEntry[]): string[] {
  return entries.map((item) => item.manifest.name);
}

function entry(entries: CatalogEntry[], domain: string): CatalogEntry {
  const found = entries.find((item) => item.manifest.domain === domain);
  if (!found) throw new Error(`no entry for ${domain}`);
  return found;
}
