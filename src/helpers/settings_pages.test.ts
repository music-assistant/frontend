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
  isEntryClaimed,
  isOwnerFullyClaimed,
  pageOfWholeOwner,
  SETTINGS_PAGES,
  settingsSectionLinks,
  sourceIncludesEntry,
  STREAMS_DOMAIN,
  TASKS_DOMAIN,
} from "./settings_pages";
import { SETTINGS_SECTIONS } from "./settings_sections";

const STREAMS = coreOwner(STREAMS_DOMAIN);
const TASKS = coreOwner(TASKS_DOMAIN);

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

  it("leaves the other entries of the streams controller alone", () => {
    expect(isEntryClaimed(STREAMS, entry("fade_in", "playback"))).toBe(false);
  });

  it("counts an entry without a category as generic", () => {
    expect(isEntryClaimed(STREAMS, entry("bind_port", ""))).toBe(false);
    expect(isEntryClaimed(TASKS, entry("max_concurrent_tasks", ""))).toBe(true);
  });

  it("claims every entry of the tasks controller", () => {
    expect(isEntryClaimed(TASKS, entry("log_level", "advanced"))).toBe(true);
  });

  it("claims nothing of an owner no page shows", () => {
    expect(
      isEntryClaimed(coreOwner("webserver"), entry("bind_port", "generic")),
    ).toBe(false);
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
      claimedEntries(STREAMS, [first, entry("fade_in", "playback"), second]),
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
    expect(isOwnerFullyClaimed(coreOwner("webserver"))).toBe(false);
  });
});

describe("pageOfWholeOwner", () => {
  it("names the page showing an owner as a whole", () => {
    expect(pageOfWholeOwner(TASKS)).toBe("background_tasks");
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

  it("leaves a link out for a role without its scope", () => {
    expect(
      settingsSectionLinks(
        "audio_analysis_providers",
        scopeChecker([Scope.CONFIG_PROVIDERS_WRITE]),
      ),
    ).toEqual([]);
  });

  it("links nothing from a section without pages", () => {
    expect(
      settingsSectionLinks(
        "music_providers",
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
