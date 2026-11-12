import { beforeEach, describe, expect, it, vi } from "vitest";
import { radio } from "../../fixtures/radio";

const { storeMock, setUserPreferenceMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  setUserPreferenceMock: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: setUserPreferenceMock,
}));

import {
  availableRadioRowIds,
  RADIO_ROWS,
  RADIO_ROWS_PREFERENCE_KEY,
  radioRows,
} from "@/components/radio/radioRows";

describe("radioRows", () => {
  beforeEach(() => {
    storeMock.currentUser = { preferences: {} };
    setUserPreferenceMock.mockReset();
  });

  it("defines radio rows and their preference key", () => {
    expect(RADIO_ROWS.map((row) => row.id)).toEqual([
      "description",
      "dynamic_sample",
      "tracklist",
      "other_versions",
      "provider_mappings",
    ]);
    expect(RADIO_ROWS_PREFERENCE_KEY).toBe("radio.rows");
    expect(radioRows.preferenceKey).toBe("radio.rows");
  });

  it.each([
    {
      name: "dynamic stations",
      item: radio({ is_dynamic: true }),
      contentRow: "dynamic_sample",
    },
    {
      name: "finite static stations",
      item: radio({ is_dynamic: false, is_endless: false }),
      contentRow: "tracklist",
    },
    {
      name: "endless static stations",
      item: radio({ is_dynamic: false, is_endless: true }),
      contentRow: "other_versions",
    },
    {
      name: "stations without an endless flag",
      item: radio({ is_dynamic: false, is_endless: undefined }),
      contentRow: "other_versions",
    },
  ])("offers the right content row for $name", ({ item, contentRow }) => {
    expect(availableRadioRowIds(item)).toEqual([
      "description",
      contentRow,
      "provider_mappings",
    ]);
  });

  it("resolves saved order and hidden rows against station-specific availability", () => {
    storeMock.currentUser = {
      preferences: {
        "radio.rows": {
          order: [
            "provider_mappings",
            "other_versions",
            "dynamic_sample",
            "description",
          ],
          hidden: ["description", "tracklist"],
        },
      },
    };

    const availableRows = availableRadioRowIds(radio({ is_dynamic: true }));
    const { order, hidden } = radioRows.resolve(availableRows);

    expect(order).toEqual([
      "provider_mappings",
      "dynamic_sample",
      "description",
    ]);
    expect(hidden).toEqual(new Set(["description"]));
  });

  it("persists visibility with the radio-specific preference key", async () => {
    await radioRows.setHidden("dynamic_sample", true);

    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "radio.rows",
      expect.objectContaining({
        hidden: ["dynamic_sample"],
        shown: [],
        order: [],
      }),
    );
  });
});
