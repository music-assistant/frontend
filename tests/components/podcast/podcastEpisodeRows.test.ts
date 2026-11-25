import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, setPreference, setPreferences } = vi.hoisted(() => ({
  storeMock: { currentUser: { preferences: {} as Record<string, unknown> } },
  setPreference: vi.fn(),
  setPreferences: vi.fn(),
}));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: setPreference,
  setUserPreferences: setPreferences,
}));

import {
  PODCAST_EPISODE_ROWS,
  PODCAST_EPISODE_ROWS_PREFERENCE_KEY,
  podcastEpisodeRows,
} from "@/components/podcast/podcastEpisodeRows";
import { podcastEpisode } from "../../fixtures/podcastEpisode";

const ids = PODCAST_EPISODE_ROWS.map((row) => row.id);

describe("podcastEpisodeRows", () => {
  beforeEach(() => {
    storeMock.currentUser.preferences = {};
    setPreference.mockReset();
    setPreferences.mockReset();
  });

  it("defaults to about, chapters and other episodes without source pickers", () => {
    const resolved = podcastEpisodeRows.resolve(ids);
    expect(resolved.order).toEqual(["about", "chapters", "episodes"]);
    expect(resolved.hidden.size).toBe(0);
    for (const id of ids)
      expect(podcastEpisodeRows.sources(id, podcastEpisode())).toEqual([]);
  });

  it("applies the user's saved order and hidden rows", () => {
    storeMock.currentUser.preferences[PODCAST_EPISODE_ROWS_PREFERENCE_KEY] = {
      order: ["episodes", "chapters", "about"],
      hidden: ["chapters"],
    };
    const resolved = podcastEpisodeRows.resolve(ids);
    expect(resolved.order).toEqual(["episodes", "chapters", "about"]);
    expect(resolved.hidden).toEqual(new Set(["chapters"]));
  });

  it("persists hiding under the podcast episode preference key", async () => {
    await podcastEpisodeRows.setHidden("about", true);
    expect(setPreference).toHaveBeenCalledWith(
      PODCAST_EPISODE_ROWS_PREFERENCE_KEY,
      expect.objectContaining({ hidden: ["about"] }),
    );
  });

  it("persists reordering and resets only podcast episode preferences", async () => {
    await podcastEpisodeRows.setOrder(["episodes", "about", "chapters"], ids);
    expect(setPreference).toHaveBeenLastCalledWith(
      PODCAST_EPISODE_ROWS_PREFERENCE_KEY,
      expect.objectContaining({ order: ["episodes", "about", "chapters"] }),
    );
    await podcastEpisodeRows.reset();
    expect(setPreferences).toHaveBeenCalledExactlyOnceWith({
      [PODCAST_EPISODE_ROWS_PREFERENCE_KEY]: {
        hidden: [],
        shown: [],
        order: [],
      },
    });
  });
});
