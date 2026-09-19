import { appUrlOf, readSetupEntry } from "@/helpers/first_run";
import { describe, expect, it } from "vitest";

describe("readSetupEntry", () => {
  it("reads the setup page without a client waiting", () => {
    expect(readSetupEntry(new URL("http://ma.local:8095/setup"))).toEqual({
      returnUrl: null,
      deviceName: null,
    });
  });

  it("reads what the client that started the setup asked for", () => {
    const url = new URL(
      "http://ma.local:8095/setup?return_url=musicassistant%3A%2F%2Fauth&device_name=Companion",
    );
    expect(readSetupEntry(url)).toEqual({
      returnUrl: "musicassistant://auth",
      deviceName: "Companion",
    });
  });

  it("reads the setup page of a server behind a path prefix", () => {
    expect(readSetupEntry(new URL("https://home.test/ma/setup/"))).toEqual({
      returnUrl: null,
      deviceName: null,
    });
  });

  it.each([
    "http://ma.local:8095/",
    "http://ma.local:8095/?code=token&onboard=true",
    "http://ma.local:8095/#/setup",
    "http://ma.local:8095/setup-notes",
  ])("is nothing on any other page: %s", (href) => {
    expect(readSetupEntry(new URL(href))).toBeNull();
  });
});

describe("appUrlOf", () => {
  it("moves the setup page onto the server's own path, query and all", () => {
    expect(
      appUrlOf(
        new URL("http://ma.local:8095/setup?return_url=x&device_name=y"),
      ),
    ).toBe("/?return_url=x&device_name=y");
  });

  it("keeps a path prefix", () => {
    expect(appUrlOf(new URL("https://home.test/ma/setup"))).toBe("/ma/");
  });
});
