import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./index";

afterEach(() => vi.restoreAllMocks());

describe("item sharing API", () => {
  it("sends the item URI and returns the server payload unchanged", async () => {
    const payload = { title: "Station", text: "Station", links: [] };
    const command = vi.spyOn(api, "sendCommand").mockResolvedValue(payload);
    expect(await api.getItemShareInfo("library://radio/42")).toBe(payload);
    expect(command).toHaveBeenCalledWith(
      "music/share_item",
      { uri: "library://radio/42" },
      { suppressGlobalError: true },
    );
  });
});
