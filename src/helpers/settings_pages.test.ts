import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import {
  AUDIO_ANALYSIS_CATEGORY,
  canEditSettingsPage,
  claimedEntries,
  coreOwner,
  DISCOVERY_DOMAIN,
  isEntryClaimed,
  isOwnerFullyClaimed,
  METADATA_DOMAIN,
  MUSIC_DOMAIN,
  pageOfWholeOwner,
  PLAYER_QUEUES_DOMAIN,
  PLAYERS_DOMAIN,
  SETTINGS_PAGES,
  settingsSectionLinks,
  sourceIncludesEntry,
  STREAMS_DOMAIN,
  TASKS_DOMAIN,
  WEBSERVER_DOMAIN,
} from "./settings_pages";
import { SETTINGS_SECTIONS } from "./settings_sections";

const STREAMS = coreOwner(STREAMS_DOMAIN);
const TASKS = coreOwner(TASKS_DOMAIN);
// a controller no settings page shows
const CACHE = coreOwner("cache");

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
  it("includes every entry for a source without categories", () => {
    expect(
      sourceIncludesEntry({ owner: TASKS }, entry("log_level", "advanced")),
    ).toBe(true);
  });

  it("includes only the listed categories otherwise", () => {
    const source = { owner: STREAMS, categories: ["playback"] };
    expect(sourceIncludesEntry(source, entry("a", "playback"))).toBe(true);
    expect(sourceIncludesEntry(source, entry("b", "generic"))).toBe(false);
  });

  it("leaves the log level of the owner out of listed categories", () => {
    expect(
      sourceIncludesEntry(
        { owner: STREAMS, categories: ["generic"] },
        entry("log_level", "generic"),
      ),
    ).toBe(false);
  });
});

describe("isEntryClaimed", () => {
  it("claims the audio analysis entries of the streams controller", () => {
    expect(
      isEntryClaimed(
        STREAMS,
        entry("background_scan_concurrency", AUDIO_ANALYSIS_CATEGORY),
      ),
    ).toBe(true);
  });

  it("claims the source selection entries of the streams controller", () => {
    expect(
      isEntryClaimed(STREAMS, entry("stream_source_mode", "source_selection")),
    ).toBe(true);
  });

  it.each(["playback", "crossfade", "volume_normalization"])(
    "claims the %s entries of the streams controller",
    (category) => {
      expect(isEntryClaimed(STREAMS, entry("buffer_size", category))).toBe(
        true,
      );
    },
  );

  it("claims the network entries of the streams controller", () => {
    expect(isEntryClaimed(STREAMS, entry("bind_port", "generic"))).toBe(true);
  });

  it("leaves the log level of the streams controller alone", () => {
    expect(isEntryClaimed(STREAMS, entry("log_level", "generic"))).toBe(false);
  });

  it("counts an entry without a category as generic", () => {
    expect(isEntryClaimed(STREAMS, entry("publish_ip", ""))).toBe(true);
  });

  it("claims every entry of the tasks controller", () => {
    expect(isEntryClaimed(TASKS, entry("log_level", "advanced"))).toBe(true);
  });

  it("claims nothing of an owner no page shows", () => {
    expect(isEntryClaimed(CACHE, entry("bind_port", "generic"))).toBe(false);
  });
});

describe("claimedEntries", () => {
  it("keeps the claimed entries in their order", () => {
    const first = entry("smart_fades_log_level", AUDIO_ANALYSIS_CATEGORY);
    const second = entry(
      "background_scan_concurrency",
      AUDIO_ANALYSIS_CATEGORY,
    );
    expect(
      claimedEntries(STREAMS, [first, entry("log_level", "generic"), second]),
    ).toEqual([first, second]);
  });
});

describe("isOwnerFullyClaimed", () => {
  it("is true for an owner a page shows as a whole", () => {
    expect(isOwnerFullyClaimed(TASKS)).toBe(true);
  });

  it("is false for an owner a page shows some categories of", () => {
    expect(isOwnerFullyClaimed(STREAMS)).toBe(false);
  });

  it("is false for an owner no page shows", () => {
    expect(isOwnerFullyClaimed(CACHE)).toBe(false);
  });
});

describe("pageOfWholeOwner", () => {
  it("names the page showing an owner as a whole", () => {
    expect(pageOfWholeOwner(TASKS)).toBe("background_tasks");
    expect(pageOfWholeOwner(coreOwner(WEBSERVER_DOMAIN))).toBe("network");
    expect(pageOfWholeOwner(coreOwner(DISCOVERY_DOMAIN))).toBe("network");
    expect(pageOfWholeOwner(coreOwner(PLAYER_QUEUES_DOMAIN))).toBe("playback");
    expect(pageOfWholeOwner(coreOwner(PLAYERS_DOMAIN))).toBe("playback");
    expect(pageOfWholeOwner(coreOwner(MUSIC_DOMAIN))).toBe("library");
    expect(pageOfWholeOwner(coreOwner(METADATA_DOMAIN))).toBe("metadata");
    expect(pageOfWholeOwner(STREAMS)).toBeUndefined();
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
