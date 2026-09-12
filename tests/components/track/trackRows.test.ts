import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference, providersMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockSetUserPreference: vi.fn(),
  providersMock: {} as Record<string, unknown>,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/api", () => ({
  api: { providers: providersMock },
}));

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
}));

import {
  TRACK_ROWS_PREFERENCE_KEY,
  TRACK_ROW_SOURCES_PREFERENCE_KEY,
  availableTrackRowIds,
  trackRows,
  type TrackRowId,
} from "@/components/track/trackRows";
import { ProviderFeature } from "@/plugins/api/interfaces";
import { track } from "../../fixtures/track";

const ALL_ROWS: TrackRowId[] = [
  "lyrics",
  "appears_on",
  "other_versions",
  "similar_tracks",
  "provider_mappings",
];

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

// registers a loaded provider instance with the given capabilities
function addProvider(instanceId: string, features: ProviderFeature[]) {
  providersMock[instanceId] = {
    instance_id: instanceId,
    name: instanceId,
    domain: instanceId.split("--")[0],
    supported_features: features,
  };
}

describe("trackRows", () => {
  beforeEach(() => {
    mockSetUserPreference.mockReset();
    setPreferences({});
    for (const key of Object.keys(providersMock)) delete providersMock[key];
  });

  describe("availableTrackRowIds", () => {
    it("offers the similar tracks row only while a provider can supply it", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      expect(availableTrackRowIds()).toEqual([
        "lyrics",
        "appears_on",
        "other_versions",
        "provider_mappings",
      ]);

      addProvider("lastfm--def", [ProviderFeature.SIMILAR_TRACKS]);
      expect(availableTrackRowIds()).toEqual(ALL_ROWS);
    });
  });

  describe("sources", () => {
    it("offers no source picker for any row", () => {
      for (const rowId of ALL_ROWS) {
        expect(trackRows.sources(rowId, track())).toEqual([]);
      }
    });
  });

  describe("resolve", () => {
    it("returns the default order with nothing hidden without preferences", () => {
      const { order, hidden } = trackRows.resolve(ALL_ROWS);
      expect(order).toEqual(ALL_ROWS);
      expect(hidden.size).toBe(0);
    });

    it("applies the saved order and visibility", () => {
      setPreferences({
        [TRACK_ROWS_PREFERENCE_KEY]: {
          hidden: ["lyrics"],
          order: ["similar_tracks", "lyrics", "appears_on"],
        },
      });
      const { order, hidden } = trackRows.resolve(ALL_ROWS);
      // the rows the user never ordered follow their default sibling
      expect(order).toEqual([
        "similar_tracks",
        "provider_mappings",
        "lyrics",
        "appears_on",
        "other_versions",
      ]);
      expect(hidden).toEqual(new Set(["lyrics"]));
    });

    it("ignores rows that don't apply right now", () => {
      setPreferences({
        [TRACK_ROWS_PREFERENCE_KEY]: {
          hidden: ["similar_tracks"],
          order: ["similar_tracks", "lyrics"],
        },
      });
      const available = ALL_ROWS.filter((id) => id !== "similar_tracks");
      const { order, hidden } = trackRows.resolve(available);
      expect(order).not.toContain("similar_tracks");
      expect(hidden.size).toBe(0);
    });
  });

  describe("setHidden / reset", () => {
    it("persists the hidden row under the track page's key", async () => {
      await trackRows.setHidden("lyrics", true);
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        TRACK_ROWS_PREFERENCE_KEY,
        expect.objectContaining({ hidden: ["lyrics"], shown: [] }),
      );
    });

    it("clears both preferences", async () => {
      await trackRows.reset();
      expect(mockSetUserPreference).toHaveBeenCalledWith(
        TRACK_ROWS_PREFERENCE_KEY,
        { hidden: [], shown: [], order: [] },
      );
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        TRACK_ROW_SOURCES_PREFERENCE_KEY,
        {},
      );
    });
  });
});
