import { describe, expect, it } from "vitest";
import { remoteAccessLink } from "./remote_access";

describe("remoteAccessLink", () => {
  it("opens the web app with the remote ID filled in", () => {
    expect(remoteAccessLink("ABC123")).toBe(
      "https://app.music-assistant.io/?remote_id=ABC123",
    );
  });
});
