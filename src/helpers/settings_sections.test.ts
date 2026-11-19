import { AUDIO_SOURCES } from "@/helpers/settings_pages";
import { ProviderFeature, ProviderType, Scope } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  BUILTIN_ROLE_SCOPES,
  MEMBER_WITHOUT_OWN_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../../tests/fixtures/scopes";
import {
  availableSettingsSections,
  isSettingsHub,
  pageProviderLists,
  providerListingRoute,
  providerListName,
  providerListPage,
  providerListRoute,
  providerSettingsSectionName,
  sectionPages,
  SECTION_PAGES,
  SETTINGS_SECTIONS,
  settingsHeading,
} from "./settings_sections";

// the menu, in display order
const ALL_SECTIONS = [
  "catalog",
  "music",
  "players",
  "plugin_providers",
  "profile",
  "users",
  "system",
  "about",
];

function sectionNames(scopes: readonly Scope[]): string[] {
  return availableSettingsSections(scopeChecker(scopes)).map(
    (section) => section.name,
  );
}

function pageKeys(section: string, scopes: readonly Scope[]): string[] {
  return sectionPages(section, scopeChecker(scopes)).map((page) => page.key);
}

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
  it("leads Music to the genres, the metadata and the audio analysis for an admin", () => {
    expect(pageKeys("music", BUILTIN_ROLE_SCOPES.admin)).toEqual([
      "genres",
      "metadata_providers",
      "audio_analysis_providers",
    ]);
  });

  it("leads the players to the player support for an admin", () => {
    expect(pageKeys("players", BUILTIN_ROLE_SCOPES.admin)).toEqual([
      "player_support",
    ]);
  });

  it("leads a member nowhere from its music sources", () => {
    expect(pageKeys("music", BUILTIN_ROLE_SCOPES.user)).toEqual([]);
  });

  it.each([
    [Scope.LIBRARY_MANAGE, ["genres"]],
    [
      Scope.CONFIG_PROVIDERS_WRITE,
      ["metadata_providers", "audio_analysis_providers"],
    ],
  ])("leads a role granting %s to the pages it needs", (scope, keys) => {
    expect(pageKeys("music", [...BUILTIN_ROLE_SCOPES.user, scope])).toEqual(
      keys,
    );
  });

  it("names an existing section for every page", () => {
    const names = SETTINGS_SECTIONS.map((section) => section.name);
    for (const page of SECTION_PAGES) {
      expect(names).toContain(page.section);
    }
  });
});

describe("providerListPage", () => {
  it.each([
    [ProviderType.PLAYER, "player_support"],
    [ProviderType.METADATA, "metadata_providers"],
    [ProviderType.AUDIO_ANALYSIS, "audio_analysis_providers"],
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
    [AUDIO_SOURCES, "music"],
    [ProviderType.PLUGIN, "plugin_providers"],
    [ProviderType.METADATA, "metadata_providers"],
    [ProviderType.AUDIO_ANALYSIS, "audio_analysis_providers"],
    [ProviderType.PLAYER, "player_support"],
  ])("names the page listing the %s providers", (type, name) => {
    expect(providerListName(type)).toBe(name);
  });
});

describe("providerSettingsSectionName", () => {
  it("names an existing section for every provider type", () => {
    const sectionNames = SETTINGS_SECTIONS.map((section) => section.name);
    for (const type of Object.values(ProviderType)) {
      expect(sectionNames).toContain(providerSettingsSectionName(type));
    }
  });

  it.each([
    [ProviderType.MUSIC, "music"],
    [AUDIO_SOURCES, "music"],
    [ProviderType.METADATA, "music"],
    [ProviderType.AUDIO_ANALYSIS, "music"],
    [ProviderType.PLAYER, "players"],
    [ProviderType.PLUGIN, "plugin_providers"],
  ])("puts the %s providers in the %s section", (type, section) => {
    expect(providerSettingsSectionName(type)).toBe(section);
  });

  it("names no section for an unknown or missing type", () => {
    expect(providerSettingsSectionName("constructor")).toBeUndefined();
    expect(providerSettingsSectionName(undefined)).toBeUndefined();
  });
});

describe("pageProviderLists", () => {
  it("lists the music sources and then the audio sources on Music", () => {
    expect(pageProviderLists(ProviderType.MUSIC)).toEqual([
      ProviderType.MUSIC,
      AUDIO_SOURCES,
    ]);
  });

  it("shows Music for the audio sources too", () => {
    expect(pageProviderLists(AUDIO_SOURCES)).toEqual([
      ProviderType.MUSIC,
      AUDIO_SOURCES,
    ]);
  });

  it.each([
    ProviderType.PLUGIN,
    ProviderType.PLAYER,
    ProviderType.METADATA,
    ProviderType.AUDIO_ANALYSIS,
  ])("lists the %s providers alone on their page", (type) => {
    expect(pageProviderLists(type)).toEqual([type]);
  });
});

describe("providerListRoute", () => {
  it.each([
    [ProviderType.MUSIC, ProviderType.MUSIC],
    [AUDIO_SOURCES, ProviderType.MUSIC],
    [ProviderType.PLUGIN, ProviderType.PLUGIN],
    [ProviderType.PLAYER, ProviderType.PLAYER],
    [ProviderType.METADATA, ProviderType.METADATA],
    [ProviderType.AUDIO_ANALYSIS, ProviderType.AUDIO_ANALYSIS],
  ])("leads the %s list to the page of the %s providers", (type, page) => {
    expect(providerListRoute(type)).toEqual({
      name: "providersettings",
      query: { types: page },
    });
  });
});

describe("providerListingRoute", () => {
  it("leads a provider with a settings page of its own to that page", () => {
    expect(
      providerListingRoute({ domain: "hass", type: ProviderType.PLUGIN }, [
        ProviderFeature.AUDIO_SOURCE,
      ]),
    ).toEqual({ name: "homeassistantsettings" });
  });

  it("leads a plugin offering audio sources to Music", () => {
    expect(
      providerListingRoute(
        { domain: "airplay_receiver", type: ProviderType.PLUGIN },
        [ProviderFeature.AUDIO_SOURCE],
      ),
    ).toEqual({ name: "providersettings", query: { types: "music" } });
  });

  it("leads any other plugin to the plugins", () => {
    expect(
      providerListingRoute({ domain: "lastfm", type: ProviderType.PLUGIN }),
    ).toEqual({ name: "providersettings", query: { types: "plugin" } });
  });
});

describe("settingsHeading", () => {
  it.each([
    ["music", "settings.music", "settings.music_description"],
    ["players", "settings.players", "settings.players_description"],
    ["system", "settings.system", "settings.system_description"],
    [
      "metadata_providers",
      "metadata",
      "settings.metadata_providers_description",
    ],
    [
      "audio_analysis_providers",
      "settings.audio_analysis_providers",
      "settings.audio_analysis_providers_description",
    ],
  ])("names %s as its card or tile does", (name, label, description) => {
    expect(settingsHeading(name)).toMatchObject({ label, description });
  });

  it("names nothing it does not know", () => {
    expect(settingsHeading("constructor")).toBeUndefined();
    expect(settingsHeading(undefined)).toBeUndefined();
  });
});

describe("isSettingsHub", () => {
  it.each([
    "music",
    "players",
    "metadata_providers",
    "audio_analysis_providers",
  ])("takes %s for a hub, leading to pages below it", (name) => {
    expect(isSettingsHub(name)).toBe(true);
  });

  it.each(["plugin_providers", "player_support", undefined])(
    "takes %s for a plain list",
    (name) => {
      expect(isSettingsHub(name)).toBe(false);
    },
  );
});
