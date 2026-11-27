import {
  ConfigEntryType,
  ProviderOffering,
  ProviderType,
  Scope,
  type ConfigEntry,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import { MCP_SERVER_DOMAIN } from "./ai_engines";
import { HASS_DOMAIN } from "./home_assistant";
import {
  ACCOUNT_ACCESS_CATEGORY,
  AUDIO_ANALYSIS_CATEGORY,
  CACHE_DOMAIN,
  canEditSettingsPage,
  coreOwner,
  coreSettingsPageId,
  isKnownOwner,
  isSameOwner,
  LOG_LEVEL_KEY,
  PLAYER_QUEUES_DOMAIN,
  PLAYERS_DOMAIN,
  providerOwner,
  providerListType,
  providerPageEntries,
  providerSettingsPageId,
  SETTINGS_PAGES,
  settingsPageProviderDomain,
  settingsPageTitlesSections,
  sourceIncludesEntry,
  STREAMS_DOMAIN,
  TASKS_DOMAIN,
  WEBSERVER_DOMAIN,
  type SettingsOwner,
  type SettingsPageId,
} from "./settings_pages";

const STREAMS = coreOwner(STREAMS_DOMAIN);
const QUEUES = coreOwner(PLAYER_QUEUES_DOMAIN);
const TASKS = coreOwner(TASKS_DOMAIN);
const WEBSERVER = coreOwner(WEBSERVER_DOMAIN);
// the core modules the server offers settings of
const CONFIGURABLE_CORE_MODULES = [
  "ai",
  "cache",
  "discovery",
  "metadata",
  "music",
  "player_queues",
  "players",
  "statistics",
  "streams",
  "tasks",
  "webserver",
];

function entry(key: string, category: string): ConfigEntry {
  return {
    key,
    category,
    type: ConfigEntryType.INTEGER,
    label: key,
    default_value: null,
    required: false,
    options: [],
  };
}

const ALL_SOURCES = Object.values(SETTINGS_PAGES).flatMap(
  (page) => page.sources,
);

// the pages showing an entry of an owner
function pagesShowing(owner: SettingsOwner, configEntry: ConfigEntry) {
  return (Object.keys(SETTINGS_PAGES) as SettingsPageId[]).filter((id) =>
    SETTINGS_PAGES[id].sources.some(
      (source) =>
        source.owner.kind === owner.kind &&
        source.owner.id === owner.id &&
        sourceIncludesEntry(source, configEntry),
    ),
  );
}

describe("SETTINGS_PAGES", () => {
  it("shows no category of an owner on two pages", () => {
    const claims = ALL_SOURCES.flatMap((source) =>
      (source.categories ?? []).map(
        (category) => `${source.owner.kind}:${source.owner.id}:${category}`,
      ),
    );
    expect(new Set(claims).size).toBe(claims.length);
  });

  it("shows nothing else of an owner a page shows as a whole", () => {
    for (const whole of ALL_SOURCES.filter(
      (source) => !source.categories && !source.excludedCategories,
    )) {
      const sameOwner = ALL_SOURCES.filter(
        (source) =>
          source.owner.kind === whole.owner.kind &&
          source.owner.id === whole.owner.id,
      );
      expect(sameOwner).toEqual([whole]);
    }
  });

  it("shows the categories a source leaves to other pages on those pages, and nothing else there", () => {
    for (const rest of ALL_SOURCES.filter(
      (source) => source.excludedCategories,
    )) {
      const shown = ALL_SOURCES.filter(
        (source) => source !== rest && isSameOwner(source.owner, rest.owner),
      ).map((source) => source.categories);
      expect(shown).not.toContain(undefined);
      expect(shown.flat().sort()).toEqual(
        [...(rest.excludedCategories ?? [])].sort(),
      );
    }
  });

  it("shows each owner of a page from one source", () => {
    for (const page of Object.values(SETTINGS_PAGES)) {
      const owners = page.sources.map(
        ({ owner }) => `${owner.kind}:${owner.id}`,
      );
      expect(new Set(owners).size).toBe(owners.length);
    }
  });

  it("groups a page with several sources either by source or by category", () => {
    for (const page of Object.values(SETTINGS_PAGES)) {
      if (page.sources.length < 2) continue;
      const titled = page.sources.filter((source) => source.title);
      expect([0, page.sources.length]).toContain(titled.length);
    }
  });

  it("titles no source of a page with a single source", () => {
    for (const page of Object.values(SETTINGS_PAGES)) {
      if (page.sources.length === 1) expect(page.sources[0].title).toBeFalsy();
    }
  });
});

describe("sourceIncludesEntry", () => {
  it("includes every other entry for a source without categories", () => {
    expect(
      sourceIncludesEntry(
        { owner: TASKS },
        entry("max_concurrent_tasks", "generic"),
      ),
    ).toBe(true);
  });

  it("includes only the listed categories otherwise", () => {
    const source = { owner: STREAMS, categories: ["playback"] };
    expect(sourceIncludesEntry(source, entry("a", "playback"))).toBe(true);
    expect(sourceIncludesEntry(source, entry("b", "generic"))).toBe(false);
  });

  it("includes every category but the ones a source leaves to other pages", () => {
    const source = { owner: QUEUES, excludedCategories: ["click_actions"] };
    expect(sourceIncludesEntry(source, entry("a", "autoplay"))).toBe(true);
    expect(sourceIncludesEntry(source, entry("b", ""))).toBe(true);
    expect(sourceIncludesEntry(source, entry("c", "click_actions"))).toBe(
      false,
    );
  });

  it.each([
    ["a source without categories", { owner: TASKS }],
    ["listed categories", { owner: STREAMS, categories: ["generic"] }],
  ])("leaves the log level of the owner out of %s", (_name, source) => {
    expect(sourceIncludesEntry(source, entry(LOG_LEVEL_KEY, "generic"))).toBe(
      false,
    );
  });
});

describe("the page of each setting", () => {
  it("shows the audio analysis entries of the streams module on its page", () => {
    expect(
      pagesShowing(
        STREAMS,
        entry("background_scan_concurrency", AUDIO_ANALYSIS_CATEGORY),
      ),
    ).toEqual(["audio_analysis"]);
  });

  it("shows the source selection of the streams module with the library", () => {
    expect(
      pagesShowing(STREAMS, entry("stream_source_mode", "source_selection")),
    ).toEqual(["library"]);
  });

  it.each(["playback", "crossfade", "volume_normalization"])(
    "shows the %s entries of the streams module with the playback defaults",
    (category) => {
      expect(pagesShowing(STREAMS, entry("buffer_size", category))).toEqual([
        "playback",
      ]);
    },
  );

  it.each([
    ["click_actions", "tap_and_play"],
    ["default_enqueue_option", "tap_and_play"],
    ["items_to_select", "tap_and_play"],
    ["smart_shuffle", "playback"],
    ["autoplay", "playback"],
    ["crossfade", "playback"],
    ["volume_normalization", "playback"],
    ["playback", "playback"],
  ])(
    "shows the %s entries of the queue settings on the %s page",
    (category, page) => {
      expect(pagesShowing(QUEUES, entry("setting", category))).toEqual([page]);
    },
  );

  it("shows a category the queue settings get later with the playback defaults", () => {
    expect(pagesShowing(QUEUES, entry("setting", "radio_mode"))).toEqual([
      "playback",
    ]);
  });

  it.each([
    ["volume_step", "generic"],
    ["announce_tts_engine", "announcements"],
  ])(
    "shows the %s of the players module with the playback defaults",
    (key, category) => {
      expect(
        pagesShowing(coreOwner(PLAYERS_DOMAIN), entry(key, category)),
      ).toEqual(["playback"]);
    },
  );

  it("shows the network entries of the streams module on the network page", () => {
    expect(pagesShowing(STREAMS, entry("bind_port", "generic"))).toEqual([
      "network",
    ]);
  });

  it("counts an entry without a category as generic", () => {
    expect(pagesShowing(STREAMS, entry("publish_ip", ""))).toEqual(["network"]);
  });

  it("shows the self-registration with the user management once it has a category of its own", () => {
    expect(
      pagesShowing(
        WEBSERVER,
        entry("auth_allow_self_registration", ACCOUNT_ACCESS_CATEGORY),
      ),
    ).toEqual(["users"]);
    expect(
      pagesShowing(WEBSERVER, entry("auth_allow_self_registration", "generic")),
    ).toEqual(["network"]);
  });

  it("shows the task settings with the background tasks", () => {
    expect(
      pagesShowing(TASKS, entry("max_concurrent_tasks", "generic")),
    ).toEqual(["background_tasks"]);
  });

  it("shows the cache actions with the diagnostics", () => {
    expect(
      pagesShowing(coreOwner(CACHE_DOMAIN), entry("clear_cache", "generic")),
    ).toEqual(["diagnostics"]);
  });

  it("shows the player controls of Home Assistant on its page", () => {
    expect(
      pagesShowing(
        providerOwner(HASS_DOMAIN),
        entry("power_controls", "player_controls"),
      ),
    ).toEqual(["home_assistant"]);
  });

  it("shows no log level on any page", () => {
    for (const source of ALL_SOURCES) {
      expect(
        pagesShowing(source.owner, entry(LOG_LEVEL_KEY, "generic")),
      ).toEqual([]);
    }
  });

  it("sets the log levels of the core modules on the diagnostics page only", () => {
    expect(
      (Object.keys(SETTINGS_PAGES) as SettingsPageId[]).filter(
        (id) => SETTINGS_PAGES[id].logLevels,
      ),
    ).toEqual(["diagnostics"]);
  });
});

describe("isKnownOwner", () => {
  it("knows an owner a page shows as a whole", () => {
    expect(isKnownOwner(TASKS)).toBe(true);
  });

  it("knows an owner a page shows some categories of", () => {
    expect(isKnownOwner(STREAMS)).toBe(true);
  });

  it.each(CONFIGURABLE_CORE_MODULES)(
    "knows the %s module of the server",
    (domain) => {
      expect(isKnownOwner(coreOwner(domain))).toBe(true);
    },
  );

  it("does not know a module no page shows", () => {
    expect(isKnownOwner(coreOwner("radio_tuner"))).toBe(false);
  });
});

describe("providerSettingsPageId", () => {
  it("gives Home Assistant a page of its own", () => {
    expect(providerSettingsPageId(HASS_DOMAIN)).toBe("home_assistant");
  });

  it("manages the built-in MCP server from the AI page", () => {
    expect(providerSettingsPageId(MCP_SERVER_DOMAIN)).toBe("ai");
  });

  it("gives any other provider none", () => {
    expect(providerSettingsPageId("hass_players")).toBeUndefined();
  });
});

describe("coreSettingsPageId", () => {
  it.each([
    ["players", "playback"],
    ["player_queues", "playback"],
    ["ai", "ai"],
    ["tasks", "background_tasks"],
  ])("finds the page showing the settings of the %s module", (domain, id) => {
    expect(coreSettingsPageId(domain)).toBe(id);
  });

  it("finds none for a module no page shows", () => {
    expect(coreSettingsPageId("radio_tuner")).toBeUndefined();
  });
});

describe("providerListType", () => {
  it("lists a plugin offering audio sources with the music sources", () => {
    expect(
      providerListType(ProviderType.PLUGIN, [ProviderOffering.AUDIO_SOURCE]),
    ).toBe(ProviderType.MUSIC);
  });

  it("lists a plugin with the plugins when its manifest provides no audio sources", () => {
    expect(providerListType(ProviderType.PLUGIN)).toBe(ProviderType.PLUGIN);
    expect(providerListType(ProviderType.PLUGIN, [])).toBe(ProviderType.PLUGIN);
  });

  it("lists any other type with its type, whatever it offers", () => {
    // the Sendspin player provider declares audio sources for its line-ins
    expect(
      providerListType(ProviderType.PLAYER, [ProviderOffering.AUDIO_SOURCE]),
    ).toBe(ProviderType.PLAYER);
    expect(
      providerListType(ProviderType.METADATA, [ProviderOffering.AUDIO_SOURCE]),
    ).toBe(ProviderType.METADATA);
  });
});

describe("providerPageEntries", () => {
  const entries = [
    entry("power_controls", "player_controls"),
    entry("some_option", "generic"),
    entry(LOG_LEVEL_KEY, "generic"),
  ];

  it("gives the settings the page of the provider shows", () => {
    expect(
      providerPageEntries(HASS_DOMAIN, entries).map(({ key }) => key),
    ).toEqual(["power_controls"]);
  });

  it("gives none for a provider without a page of its own", () => {
    expect(providerPageEntries("spotify", entries)).toEqual([]);
  });
});

describe("settingsPageProviderDomain", () => {
  it("names the provider of a page showing only its settings", () => {
    expect(settingsPageProviderDomain("home_assistant")).toBe(HASS_DOMAIN);
  });

  it.each<SettingsPageId>(["metadata", "network"])(
    "names none for the %s page of core settings",
    (pageId) => {
      expect(settingsPageProviderDomain(pageId)).toBeUndefined();
    },
  );
});

describe("settingsPageTitlesSections", () => {
  it.each<SettingsPageId>(["diagnostics", "library", "network"])(
    "heads the sources of the %s page with their titles",
    (pageId) => {
      expect(settingsPageTitlesSections(pageId)).toBe(true);
    },
  );

  it.each<SettingsPageId>(["metadata", "playback"])(
    "leaves the %s page to the categories of its entries",
    (pageId) => {
      expect(settingsPageTitlesSections(pageId)).toBe(false);
    },
  );
});

describe("canEditSettingsPage", () => {
  it("needs the core write scope for core settings", () => {
    expect(
      canEditSettingsPage(
        "audio_analysis",
        scopeChecker([Scope.CONFIG_CORE_WRITE]),
      ),
    ).toBe(true);
    expect(
      canEditSettingsPage(
        "audio_analysis",
        scopeChecker(BUILTIN_ROLE_SCOPES.user),
      ),
    ).toBe(false);
  });

  it("needs the provider write scope for provider settings", () => {
    expect(
      canEditSettingsPage(
        "home_assistant",
        scopeChecker([Scope.CONFIG_PROVIDERS_WRITE]),
      ),
    ).toBe(true);
    expect(
      canEditSettingsPage(
        "home_assistant",
        scopeChecker([Scope.CONFIG_CORE_WRITE]),
      ),
    ).toBe(false);
  });
});
