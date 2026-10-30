import { describe, expect, it, vi } from "vitest";
import { MusicAssistantApi } from "./index";
import type { Player } from "./interfaces";

describe("group volume command", () => {
  it("returns the command promise and updates the cached volume immediately", async () => {
    const api = new MusicAssistantApi();
    api.players["group"] = { group_volume: 15 } as Player;
    let rejectCommand!: (reason: Error) => void;
    const command = new Promise<void>((_resolve, reject) => {
      rejectCommand = reject;
    });
    const send = vi.spyOn(api, "playerCommand").mockReturnValue(command);

    const result = api.playerCommandGroupVolume("group", 50);
    expect(api.players["group"].group_volume).toBe(50);
    expect(send).toHaveBeenCalledWith("group", "group_volume", {
      volume_level: 50,
    });
    rejectCommand(new Error("group command failed"));
    await expect(result).rejects.toThrow("group command failed");
  });
});
