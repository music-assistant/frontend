import { getIngressClientKey } from "@/helpers/ingress";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getIngressClientKey", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a random key on first use and reuses it afterwards", () => {
    const key = getIngressClientKey();

    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(getIngressClientKey()).toBe(key);
  });

  it("creates a key on plain http, where crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    expect(getIngressClientKey()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns the key another tab of this browser created", () => {
    localStorage.setItem("ma_ingress_client_key", "key-of-this-browser");

    expect(getIngressClientKey()).toBe("key-of-this-browser");
  });

  it("gives another browser a key of its own", () => {
    const key = getIngressClientKey();
    localStorage.clear();

    expect(getIngressClientKey()).not.toBe(key);
  });
});
