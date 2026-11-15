import {
  CATALOG_ROW_SIZE,
  type CatalogSuggestion,
  getCatalogSuggestions,
  getReleaseLine,
  getSuggestionRows,
  getTopPicks,
  isPersonalSuggestion,
  readDismissedSuggestions,
  TOP_PICK_COUNT,
} from "@/helpers/catalog_recommendations";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import {
  type CatalogRecommendation,
  CatalogRecommendationReason,
  ProviderTier,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { communityProvider } from "../../tests/fixtures/communityProvider";
import { providerManifest } from "../../tests/fixtures/providerManifest";

const { DISCOVERED, COMPLEMENTS, POPULAR, NEW, UPDATED } =
  CatalogRecommendationReason;

// noon, so the day is the same in every time zone
const day = (date: string) => Date.parse(`${date}T12:00:00`);
const NAMES: Record<string, string> = { spotify: "Spotify", tidal: "Tidal" };
const getName = (domain: string) => NAMES[domain];

describe("getCatalogSuggestions", () => {
  const entries = [
    entry("spotify"),
    entry("sonos"),
    entry("spotify_connect"),
    entry("chromecast", false),
  ];

  it("matches the server's suggestions with the entries, in the server's order", () => {
    const suggestions = getCatalogSuggestions(
      entries,
      [
        recommend("sonos", DISCOVERED),
        recommend("spotify_connect", COMPLEMENTS, "spotify"),
        recommend("spotify", POPULAR),
        recommend("sonos", POPULAR),
      ],
      [],
      getName,
    );

    expect(describeAll(suggestions)).toEqual([
      ["sonos", DISCOVERED, null],
      ["spotify_connect", COMPLEMENTS, "Spotify"],
      ["spotify", POPULAR, null],
      ["sonos", POPULAR, null],
    ]);
  });

  it("leaves out a domain or a reason it does not know, and what cannot be added", () => {
    const suggestions = getCatalogSuggestions(
      entries,
      [
        recommend("unknown", POPULAR),
        recommend("sonos", "favourite"),
        recommend("chromecast", DISCOVERED),
        recommend("spotify", POPULAR),
      ],
      [],
      getName,
    );

    expect(describeAll(suggestions)).toEqual([["spotify", POPULAR, null]]);
  });

  it("leaves out what the user let go, for every reason", () => {
    const suggestions = getCatalogSuggestions(
      entries,
      [recommend("sonos", DISCOVERED), recommend("sonos", POPULAR)],
      ["sonos"],
      getName,
    );

    expect(suggestions).toEqual([]);
  });

  it("names what it goes well with only when that is known", () => {
    const suggestions = getCatalogSuggestions(
      entries,
      [
        recommend("spotify_connect", COMPLEMENTS, "gone"),
        recommend("sonos", COMPLEMENTS, null),
        recommend("spotify", POPULAR, "tidal"),
      ],
      [],
      getName,
    );

    expect(suggestions.map(({ pairedWith }) => pairedWith)).toEqual([
      null,
      null,
      null,
    ]);
  });
});

describe("getTopPicks", () => {
  const suggestions = [
    suggestion("spotify", POPULAR),
    suggestion("sonos", POPULAR),
    suggestion("lastfm", COMPLEMENTS),
    suggestion("bose", DISCOVERED),
    suggestion("tidal", POPULAR),
    suggestion("sonos", DISCOVERED),
  ];

  it("picks what is found, then what goes well, then what is popular, each once", () => {
    const picks = getTopPicks(suggestions, day("2026-11-14"));

    expect(picks).toHaveLength(TOP_PICK_COUNT);
    expect(rotatedFrom(domains(picks), "bose")).toEqual([
      "bose",
      "sonos",
      "lastfm",
      "spotify",
    ]);
    expect(
      picks.find((pick) => pick.entry.manifest.domain === "sonos")?.reason,
    ).toBe(DISCOVERED);
  });

  it("lets the next one lead the next day, the whole day", () => {
    const today = domains(getTopPicks(suggestions, day("2026-11-14")));

    expect(
      domains(getTopPicks(suggestions, Date.parse("2026-11-15T00:30:00"))),
    ).toEqual([...today.slice(1), today[0]]);
    expect(
      domains(getTopPicks(suggestions, Date.parse("2026-11-15T23:30:00"))),
    ).toEqual([...today.slice(1), today[0]]);
  });

  it("picks nothing that is only new or updated", () => {
    expect(
      getTopPicks(
        [suggestion("radio", NEW), suggestion("dj", UPDATED)],
        day("2026-11-14"),
      ),
    ).toEqual([]);
  });
});

describe("getSuggestionRows", () => {
  it("shows a row per reason in their order, built-in news apart from the community's", () => {
    const rows = getSuggestionRows(
      [
        suggestion("radio", NEW, true),
        suggestion("dj", UPDATED, true),
        suggestion("tidal", POPULAR),
        suggestion("soundcloud", NEW),
        suggestion("lastfm", COMPLEMENTS),
        suggestion("bose", DISCOVERED),
      ],
      true,
    );

    expect(
      rows.map((row) => [row.key, row.title, domains(row.suggestions)]),
    ).toEqual([
      ["discovered", "settings.catalog.discovered_title", ["bose"]],
      ["complements", "settings.catalog.complements_title", ["lastfm"]],
      ["popular", "settings.catalog.popular", ["tidal"]],
      ["new", "settings.catalog.new_in_version", ["soundcloud"]],
      ["community-new", "settings.catalog.community.new_title", ["radio"]],
      ["community-updated", "settings.catalog.community.updated_title", ["dj"]],
    ]);
  });

  it("leaves the community catalog out while it is not enabled for the user", () => {
    const rows = getSuggestionRows(
      [
        suggestion("radio", NEW, true),
        suggestion("dj", UPDATED, true),
        suggestion("soundcloud", NEW),
        // an installed one may well be on the network
        suggestion("dj", DISCOVERED, true),
      ],
      false,
    );

    expect(rows.map((row) => [row.key, domains(row.suggestions)])).toEqual([
      ["discovered", ["dj"]],
      ["new", ["soundcloud"]],
    ]);
  });

  it("keeps whatever is updated out of the rows unless it is of the community catalog", () => {
    const rows = getSuggestionRows([suggestion("tidal", UPDATED)], true);

    expect(rows).toEqual([]);
  });

  it("shows at most CATALOG_ROW_SIZE in a row", () => {
    const many = Array.from({ length: CATALOG_ROW_SIZE + 3 }, (_, index) =>
      suggestion(`source${index}`, POPULAR),
    );

    expect(getSuggestionRows(many, true)[0].suggestions).toHaveLength(
      CATALOG_ROW_SIZE,
    );
  });

  it("leaves the pick out of the first row it is in only", () => {
    const sonos = suggestion("sonos", DISCOVERED);
    const rows = getSuggestionRows(
      [sonos, suggestion("bose", DISCOVERED), suggestion("sonos", POPULAR)],
      true,
      sonos,
    );

    expect(rows.map((row) => [row.key, domains(row.suggestions)])).toEqual([
      ["discovered", ["bose"]],
      ["popular", ["sonos"]],
    ]);
  });

  it("leaves out a row that only held the pick", () => {
    const sonos = suggestion("sonos", DISCOVERED);

    expect(
      getSuggestionRows([sonos, suggestion("tidal", POPULAR)], true, sonos).map(
        (row) => row.key,
      ),
    ).toEqual(["popular"]);
  });
});

describe("isPersonalSuggestion", () => {
  it.each([
    [DISCOVERED, true],
    [COMPLEMENTS, true],
    [POPULAR, false],
    [NEW, false],
    [UPDATED, false],
  ])("lets go of a suggestion for %s: %s", (reason, personal) => {
    expect(isPersonalSuggestion(suggestion("sonos", reason))).toBe(personal);
  });
});

describe("readDismissedSuggestions", () => {
  it.each([
    [
      ["sonos", "bose"],
      ["sonos", "bose"],
    ],
    [["sonos", 42, null, { domain: "bose" }], ["sonos"]],
    ["sonos", []],
    [undefined, []],
    [null, []],
  ])("reads %o as %o", (stored, domainsRead) => {
    expect(readDismissedSuggestions(stored)).toEqual(domainsRead);
  });
});

describe("getReleaseLine", () => {
  it.each([
    ["2.11.0b3", "2.11"],
    ["2.11.0", "2.11"],
    ["12.3", "12.3"],
    ["dev", "dev"],
    ["", ""],
  ])("names %s as %s", (version, line) => {
    expect(getReleaseLine(version)).toBe(line);
  });
});

function entry(domain: string, canAdd = true): CatalogEntry {
  return {
    manifest: providerManifest({ domain, name: domain }),
    instances: [],
    canAdd,
  };
}

function recommend(
  domain: string,
  reason: CatalogRecommendationReason | string,
  detail: string | null = null,
): CatalogRecommendation {
  return { domain, reason: reason as CatalogRecommendationReason, detail };
}

function suggestion(
  domain: string,
  reason: CatalogRecommendationReason,
  fromCommunity = false,
): CatalogSuggestion {
  if (!fromCommunity) return { entry: entry(domain), reason, pairedWith: null };
  const provider = communityProvider(domain, {
    manifest: providerManifest({
      domain,
      name: domain,
      tier: ProviderTier.COMMUNITY,
    }),
  });
  return {
    entry: {
      manifest: provider.manifest,
      instances: [],
      canAdd: true,
      community: provider,
    },
    reason,
    pairedWith: null,
  };
}

function domains(suggestions: CatalogSuggestion[]): string[] {
  return suggestions.map(({ entry }) => entry.manifest.domain);
}

function describeAll(suggestions: CatalogSuggestion[]) {
  return suggestions.map(({ entry, reason, pairedWith }) => [
    entry.manifest.domain,
    reason,
    pairedWith,
  ]);
}

// the picks in their own order, starting at one of them
function rotatedFrom(list: string[], first: string): string[] {
  const start = list.indexOf(first);
  return [...list.slice(start), ...list.slice(0, start)];
}
