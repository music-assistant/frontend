import { getIngressClientKey } from "@/helpers/ingress";
import { beforeEach, describe, expect, it } from "vitest";

describe("getIngressClientKey", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a random key on first use and reuses it afterwards", () => {
    const key = getIngressClientKey();

    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(getIngressClientKey()).toBe(key);
  });

  it("returns the key another tab of this browser created", () => {
    localStorage.setItem("ingress_client_key", "key-of-this-browser");

    expect(getIngressClientKey()).toBe("key-of-this-browser");
  });

  it("gives another browser a key of its own", () => {
    const key = getIngressClientKey();
    localStorage.clear();

    expect(getIngressClientKey()).not.toBe(key);
  });
});
