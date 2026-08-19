import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "./index";

describe("getRecommendationItems", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits providers when not given", async () => {
    const spy = vi.spyOn(api, "sendCommand").mockResolvedValue([]);
    await api.getRecommendationItems("library", "recently_played");

    expect(spy).toHaveBeenCalledWith(
      "music/recommendations/items",
      { provider: "library", item_id: "recently_played", providers: undefined },
      { suppressGlobalError: true },
    );
  });

  it("sends the given provider instance ids", async () => {
    const spy = vi.spyOn(api, "sendCommand").mockResolvedValue([]);
    await api.getRecommendationItems("library", "recently_played", [
      "spotify--abc",
    ]);

    expect(spy).toHaveBeenCalledWith(
      "music/recommendations/items",
      {
        provider: "library",
        item_id: "recently_played",
        providers: ["spotify--abc"],
      },
      { suppressGlobalError: true },
    );
  });

  it("sends an explicit empty list to filter out every provider", async () => {
    const spy = vi.spyOn(api, "sendCommand").mockResolvedValue([]);
    await api.getRecommendationItems("library", "recently_played", []);

    expect(spy).toHaveBeenCalledWith(
      "music/recommendations/items",
      { provider: "library", item_id: "recently_played", providers: [] },
      { suppressGlobalError: true },
    );
  });
});
