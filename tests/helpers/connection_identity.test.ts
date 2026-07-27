import {
  createLocalConnectionIdentity,
  createRemoteConnectionIdentity,
} from "@/helpers/connection_identity";
import { describe, expect, it } from "vitest";

describe("connection identity", () => {
  it("normalizes local server addresses", () => {
    expect(
      createLocalConnectionIdentity("http://music-assistant.local:8095/"),
    ).toBe("local:http://music-assistant.local:8095");
    expect(
      createLocalConnectionIdentity(
        "https://home.example/hassio_ingress/server/",
      ),
    ).toBe("local:https://home.example/hassio_ingress/server");
  });

  it("normalizes remote IDs", () => {
    expect(
      createRemoteConnectionIdentity("abcdefgh-12345-12345-abcdefgh"),
    ).toBe("remote:ABCDEFGH1234512345ABCDEFGH");
    expect(createRemoteConnectionIdentity("invalid")).toBeUndefined();
  });
});
