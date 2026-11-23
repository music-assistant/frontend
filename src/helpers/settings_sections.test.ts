import { SETTINGS_PAGES, type SettingsPageId } from "@/helpers/settings_pages";
import {
  ProviderOffering,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  BUILTIN_ROLE_SCOPES,
  MEMBER_WITHOUT_OWN_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../../tests/fixtures/scopes";
import {
  availableSettingsSections,
  providerListingRoute,
  providerListName,
  providerListPage,
  providerListRoute,
  providerOwnPage,
  routeSettingsPage,
  sectionPages,
  SECTION_PAGES,
  SETTINGS_SECTIONS,
  settingsHeading,
  settingsMenuPage,
  settingsPageRoute,
  settingsTrail,
} from "./settings_sections";

// the menu, in display order
const ALL_SECTIONS = [
  "catalog",
  "music",
  "players",
  "plugin_providers",
  "ai",
  "profile",
  "users",
  "system",
  "about",
];

const MENU_PAGES = [...SETTINGS_SECTIONS, ...SECTION_PAGES];

function sectionNames(scopes: readonly Scope[]): string[] {
  return availableSettingsSections(scopeChecker(scopes)).map(
    (section) => section.key,
  );
}

function pageKeys(parent: string, scopes: readonly Scope[]): string[] {
  return sectionPages(parent, scopeChecker(scopes)).map((page) => page.key);
}

describe("the settings menu", () => {
  it("names each page by a key of its own", () => {
    const keys = MENU_PAGES.map((page) => page.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("opens each page on a route of its own", () => {
    const names = MENU_PAGES.map((page) => page.route.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("hangs every page below a page of the menu, down from a section", () => {
    for (const page of SECTION_PAGES) {
      const trail = settingsTrail(page.key);
      expect(trail[0].parent).toBeUndefined();
      expect(SETTINGS_SECTIONS).toContain(trail[0]);
      expect(trail.at(-1)).toBe(page);
    }
  });

  it("holds every settings page under its own id", () => {
    for (const id of Object.keys(SETTINGS_PAGES) as SettingsPageId[]) {
      expect(settingsMenuPage(id)?.key).toBe(id);
    }
  });
});

describe("availableSettingsSections", () => {
  it("lists every section to an admin", () => {
    expect(sectionNames(BUILTIN_ROLE_SCOPES.admin)).toEqual(ALL_SECTIONS);
  });

  it("lists a member the catalog, its own music sources and its personal settings", () => {
    expect(sectionNames(BUILTIN_ROLE_SCOPES.user)).toEqual([
      "catalog",
      "music",
      "profile",
      "about",
    ]);
  });

  it("lists a guest its personal settings only", () => {
    expect(sectionNames(BUILTIN_ROLE_SCOPES.guest)).toEqual([
      "profile",
      "about",
    ]);
  });

  it("lists a role managing its own music sources nothing more to manage", () => {
    expect(sectionNames(OWN_SOURCES_ROLE_SCOPES)).toEqual([
      "catalog",
      "music",
      "profile",
      "about",
    ]);
  });

  it("leaves the catalog out for a role that may not add music sources", () => {
    expect(sectionNames(MEMBER_WITHOUT_OWN_SCOPES)).not.toContain("catalog");
  });

  it("lists the music sources to a role that may only read them", () => {
    expect(
      sectionNames([...BUILTIN_ROLE_SCOPES.guest, Scope.CONFIG_PROVIDERS_READ]),
    ).toContain("music");
  });

  it("lists the users to a role that may read them", () => {
    expect(
      sectionNames([...BUILTIN_ROLE_SCOPES.guest, Scope.USERS_READ]),
    ).toContain("users");
  });
});

describe("sectionPages", () => {
  it("leads Music to the library, the genres, the metadata and the audio analysis for an admin", () => {
    expect(pageKeys("music", BUILTIN_ROLE_SCOPES.admin)).toEqual([
      "library",
      "genres",
      "metadata",
      "audio_analysis",
    ]);
  });

  it("leads the players to the playback defaults and the player support for an admin", () => {
    expect(pageKeys("players", BUILTIN_ROLE_SCOPES.admin)).toEqual([
      "playback",
      "player_support",
    ]);
  });

  it("leads System to the pages about the server for an admin", () => {
    expect(pageKeys("system", BUILTIN_ROLE_SCOPES.admin)).toEqual([
      "network",
      "storage",
      "home_assistant",
      "background_tasks",
      "diagnostics",
    ]);
  });

  it("leads the network to the remote access for an admin", () => {
    expect(pageKeys("network", BUILTIN_ROLE_SCOPES.admin)).toEqual([
      "remote_access",
    ]);
  });

  it("leads anyone from the profile to the pages of its own", () => {
    expect(pageKeys("profile", BUILTIN_ROLE_SCOPES.guest)).toEqual([
      "interface",
      "device",
      "security",
    ]);
  });

  it("leads a member nowhere from its music sources", () => {
    expect(pageKeys("music", BUILTIN_ROLE_SCOPES.user)).toEqual([]);
  });

  it.each([
    [Scope.CONFIG_CORE_WRITE, ["library"]],
    [Scope.LIBRARY_MANAGE, ["genres"]],
    [Scope.CONFIG_PROVIDERS_WRITE, ["metadata", "audio_analysis"]],
  ])("leads a role granting %s to the pages it needs", (scope, keys) => {
    expect(pageKeys("music", [...BUILTIN_ROLE_SCOPES.user, scope])).toEqual(
      keys,
    );
  });

  it("leaves the playback defaults out for a role that may not change server settings", () => {
    expect(pageKeys("players", [Scope.CONFIG_PLAYERS_WRITE])).toEqual([]);
  });

  it.each([
    "plugin_providers",
    "metadata",
    "audio_analysis",
    "background_tasks",
  ])("leads nowhere from %s, which has no pages below it", (parent) => {
    expect(pageKeys(parent, BUILTIN_ROLE_SCOPES.admin)).toEqual([]);
  });
});

describe("settingsTrail", () => {
  it.each([
    ["music", ["music"]],
    ["library", ["music", "library"]],
    ["metadata", ["music", "metadata"]],
    ["audio_analysis", ["music", "audio_analysis"]],
    ["player_support", ["players", "player_support"]],
    ["remote_access", ["system", "network", "remote_access"]],
    ["background_tasks", ["system", "background_tasks"]],
    ["security", ["profile", "security"]],
  ])("leads down to %s from its section", (key, trail) => {
    expect(settingsTrail(key).map((page) => page.key)).toEqual(trail);
  });

  it("is empty for a page the menu does not know", () => {
    expect(settingsTrail("constructor")).toEqual([]);
    expect(settingsTrail(undefined)).toEqual([]);
  });
});

describe("routeSettingsPage", () => {
  it.each([
    ["musicsettings", "music"],
    ["pluginproviders", "plugin_providers"],
    ["playerproviders", "player_support"],
    ["audioanalysisproviders", "audio_analysis"],
    ["remoteaccesssettings", "remote_access"],
    ["profilesecurity", "security"],
  ])("finds the page %s shows", (routeName, key) => {
    expect(routeSettingsPage(routeName)?.key).toBe(key);
  });

  it("finds no page for a route showing something of its own", () => {
    expect(routeSettingsPage("editprovider")).toBeUndefined();
    expect(routeSettingsPage(undefined)).toBeUndefined();
  });
});

describe("settingsPageRoute", () => {
  it.each([
    ["playback", "playbacksettings"],
    ["network", "networksettings"],
    ["users", "usersettings"],
  ] as const)("opens the %s settings on their own route", (id, name) => {
    expect(settingsPageRoute(id)).toEqual({ name });
  });

  it.each([
    ["metadata", "metadataproviders"],
    ["audio_analysis", "audioanalysisproviders"],
    ["background_tasks", "backgroundtasks"],
  ] as const)(
    "opens the %s settings on the page they fold open on",
    (id, name) => {
      expect(settingsPageRoute(id)).toEqual({ name });
    },
  );
});

describe("providerListPage", () => {
  it.each([
    [ProviderType.PLAYER, "player_support"],
    [ProviderType.METADATA, "metadata"],
    [ProviderType.AUDIO_ANALYSIS, "audio_analysis"],
  ])("lists the %s providers on a page below a section", (type, key) => {
    expect(providerListPage(type)?.key).toBe(key);
  });

  it.each([ProviderType.MUSIC, ProviderType.PLUGIN])(
    "lists the %s providers on no page below a section",
    (type) => {
      expect(providerListPage(type)).toBeUndefined();
    },
  );

  it("names no page for an unknown or missing type", () => {
    expect(providerListPage("constructor")).toBeUndefined();
    expect(providerListPage(undefined)).toBeUndefined();
  });
});

describe("providerListName", () => {
  it.each([
    [ProviderType.MUSIC, "music"],
    [ProviderType.PLUGIN, "plugin_providers"],
    [ProviderType.METADATA, "metadata"],
    [ProviderType.AUDIO_ANALYSIS, "audio_analysis"],
    [ProviderType.PLAYER, "player_support"],
  ])("names the page listing the %s providers", (type, name) => {
    expect(providerListName(type)).toBe(name);
  });

  it("names a page of the menu for every provider type", () => {
    for (const type of Object.values(ProviderType)) {
      expect(settingsMenuPage(providerListName(type))).toBeDefined();
    }
  });
});

describe("providerListRoute", () => {
  it.each([
    [ProviderType.MUSIC, "musicsettings"],
    [ProviderType.PLUGIN, "pluginproviders"],
    [ProviderType.PLAYER, "playerproviders"],
    [ProviderType.METADATA, "metadataproviders"],
    [ProviderType.AUDIO_ANALYSIS, "audioanalysisproviders"],
  ])("leads the %s list to the %s page", (type, name) => {
    expect(providerListRoute(type)).toEqual({ name });
  });

  it.each(["bogus", ""])(
    "leads the unknown type %j to the music sources",
    (type) => {
      expect(providerListRoute(type)).toEqual({ name: "musicsettings" });
    },
  );
});

describe("providerOwnPage", () => {
  it("leads Home Assistant to its page below System", () => {
    expect(providerOwnPage("hass")?.key).toBe("home_assistant");
  });

  it("leads the built-in MCP server to the AI page", () => {
    expect(providerOwnPage("mcp_server")?.key).toBe("ai");
  });

  it("gives any other provider none", () => {
    expect(providerOwnPage("hass_players")).toBeUndefined();
  });
});

describe("providerListingRoute", () => {
  it("leads a provider with a settings page of its own to that page", () => {
    expect(
      providerListingRoute({ domain: "hass", type: ProviderType.PLUGIN }, [
        ProviderOffering.AUDIO_SOURCE,
      ]),
    ).toEqual({ name: "homeassistantsettings" });
  });

  it("leads a plugin offering audio sources to Music", () => {
    expect(
      providerListingRoute(
        { domain: "airplay_receiver", type: ProviderType.PLUGIN },
        [ProviderOffering.AUDIO_SOURCE],
      ),
    ).toEqual({ name: "musicsettings" });
  });

  it("leads any other plugin to the plugins", () => {
    expect(
      providerListingRoute({ domain: "lastfm", type: ProviderType.PLUGIN }),
    ).toEqual({ name: "pluginproviders" });
  });
});

describe("settingsHeading", () => {
  it.each([
    ["music", "settings.music", "settings.music_description"],
    ["players", "settings.players", "settings.players_description"],
    ["system", "settings.system", "settings.system_description"],
    ["metadata", "metadata", "settings.metadata_description"],
    [
      "audio_analysis",
      "settings.audio_analysis_providers",
      "settings.audio_analysis_description",
    ],
    [
      "remote_access",
      "settings.remote_access",
      "settings.remote_access_description",
    ],
    [
      "interface",
      "auth.profile_pages.interface",
      "auth.profile_pages.interface_description",
    ],
  ])("names %s as its card or tile does", (name, label, description) => {
    expect(settingsHeading(name)).toMatchObject({ label, description });
  });

  it.each([
    ["remote_access", "network"],
    ["security", "profile"],
  ])(
    "colours %s, which a row leads to, as the page above it",
    (key, parent) => {
      const parentColor = settingsHeading(parent)?.color;
      expect(parentColor).toBeDefined();
      expect(settingsHeading(key)?.color).toBe(parentColor);
    },
  );

  it("names nothing it does not know", () => {
    expect(settingsHeading("constructor")).toBeUndefined();
    expect(settingsHeading(undefined)).toBeUndefined();
  });
});
