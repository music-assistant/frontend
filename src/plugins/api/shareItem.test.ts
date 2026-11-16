import { describe, expect, it, vi } from "vitest";
import { MusicAssistantApi } from "./index";

describe("share item API", () => {
  it("requests the plugin's typed share information", async () => {
    const api = new MusicAssistantApi();
    const result = {
      title: "Track",
      text: null,
      links: [
        {
          provider_domain: "spotify",
          provider_instance: "spotify--1",
          url: "https://open.spotify.com/track/1",
        },
      ],
    };
    const send = vi.spyOn(api, "sendCommand").mockResolvedValue(result);

    await expect(api.getItemShareInfo("library://track/1")).resolves.toEqual(
      result,
    );
    expect(send).toHaveBeenCalledWith(
      "share/item",
      { uri: "library://track/1" },
      { suppressGlobalError: true },
    );
  });
});
