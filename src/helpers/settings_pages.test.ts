import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import {
  ACCOUNT_ACCESS_CATEGORY,
  AUDIO_ANALYSIS_CATEGORY,
  CACHE_DOMAIN,
  canEditSettingsPage,
  coreOwner,
  isKnownOwner,
  LOG_LEVEL_KEY,
  SETTINGS_PAGES,
  settingsSectionLinks,
  sourceIncludesEntry,
  STREAMS_DOMAIN,
  TASKS_DOMAIN,
  WEBSERVER_DOMAIN,
  type SettingsOwner,
  type SettingsPageId,
} from "./settings_pages";
import { SETTINGS_SECTIONS } from "./settings_sections";

const STREAMS = coreOwner(STREAMS_DOMAIN);
const TASKS = coreOwner(TASKS_DOMAIN);
const WEBSERVER = coreOwner(WEBSERVER_DOMAIN);
// the core modules the server offers settings of
const CONFIGURABLE_CORE_MODULES = [
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
    for (const whole of ALL_SOURCES.filter((source) => !source.categories)) {
      const sameOwner = ALL_SOURCES.filter(
        (source) =>
          source.owner.kind === whole.owner.kind &&
          source.owner.id === whole.owner.id,
      );
      expect(sameOwner).toEqual([whole]);
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

  it("links each page from an existing settings section", () => {
    const sectionNames = SETTINGS_SECTIONS.map((section) => section.name);
    for (const page of Object.values(SETTINGS_PAGES)) {
      if (page.link) expect(sectionNames).toContain(page.link.section);
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
    ).toEqual(["user_management"]);
    expect(
      pagesShowing(WEBSERVER, entry("auth_allow_self_registration", "generic")),
    ).toEqual(["network"]);
  });

  it("shows the task settings on a page of their own", () => {
    expect(
      pagesShowing(TASKS, entry("max_concurrent_tasks", "generic")),
    ).toEqual(["task_settings"]);
  });

  it("shows the cache actions with the diagnostics", () => {
    expect(
      pagesShowing(coreOwner(CACHE_DOMAIN), entry("clear_cache", "generic")),
    ).toEqual(["diagnostics"]);
  });

  it("shows no log level on any page", () => {
    for (const source of ALL_SOURCES) {
      expect(
        pagesShowing(source.owner, entry(LOG_LEVEL_KEY, "generic")),
      ).toEqual([]);
    }
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

describe("settingsSectionLinks", () => {
  it("links the audio analysis section to the analysis status for an admin", () => {
    expect(
      settingsSectionLinks(
        "audio_analysis_providers",
        scopeChecker(BUILTIN_ROLE_SCOPES.admin),
      ).map((link) => link.id),
    ).toEqual(["audio_analysis"]);
  });

  it("links the players section to the playback defaults for an admin", () => {
    expect(
      settingsSectionLinks(
        "players",
        scopeChecker(BUILTIN_ROLE_SCOPES.admin),
      ).map((link) => link.id),
    ).toEqual(["playback"]);
  });

  it("leaves the playback defaults out for a role that may not change server settings", () => {
    expect(
      settingsSectionLinks(
        "players",
        scopeChecker([Scope.CONFIG_PLAYERS_WRITE]),
      ),
    ).toEqual([]);
  });

  it("leaves a link out for a role without its scope", () => {
    expect(
      settingsSectionLinks(
        "audio_analysis_providers",
        scopeChecker([Scope.CONFIG_PROVIDERS_WRITE]),
      ),
    ).toEqual([]);
  });

  it.each([
    ["music_providers", "library"],
    ["metadata_providers", "metadata"],
  ])(
    "links the %s section to the %s settings for an admin",
    (section, pageId) => {
      expect(
        settingsSectionLinks(
          section,
          scopeChecker(BUILTIN_ROLE_SCOPES.admin),
        ).map((link) => link.id),
      ).toEqual([pageId]);
    },
  );

  it("leaves the library options out for a member", () => {
    expect(
      settingsSectionLinks(
        "music_providers",
        scopeChecker(BUILTIN_ROLE_SCOPES.user),
      ),
    ).toEqual([]);
  });

  it("links nothing from a section without pages", () => {
    expect(
      settingsSectionLinks(
        "plugin_providers",
        scopeChecker(BUILTIN_ROLE_SCOPES.admin),
      ),
    ).toEqual([]);
  });
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
});
