import { afterEach, describe, expect, it } from "vitest";
import { api } from "./index";
import type { ProviderInstance, ProviderManifest } from "./interfaces";

const instance = (instance_id: string, name: string): ProviderInstance =>
  ({
    domain: instance_id.split("--")[0],
    name,
    instance_id,
  }) as ProviderInstance;

const manifest = (domain: string, name: string): ProviderManifest =>
  ({ domain, name }) as ProviderManifest;

describe("getProviderName", () => {
  afterEach(() => {
    Object.keys(api.providers).forEach((k) => delete api.providers[k]);
    Object.keys(api.providerManifests).forEach(
      (k) => delete api.providerManifests[k],
    );
  });

  it("prefers the configured name of a loaded instance", () => {
    api.providers["tidal--abc"] = instance("tidal--abc", "My Tidal");
    api.providerManifests["tidal"] = manifest("tidal", "Tidal");
    expect(api.getProviderName("tidal--abc")).toBe("My Tidal");
  });

  it("falls back to the generic provider name when the instance isn't loaded", () => {
    // instance not shared with this user, so absent from api.providers
    api.providerManifests["tidal"] = manifest("tidal", "Tidal");
    expect(api.getProviderName("tidal--abc")).toBe("Tidal");
  });

  it("resolves a bare domain to the manifest name", () => {
    api.providerManifests["tidal"] = manifest("tidal", "Tidal");
    expect(api.getProviderName("tidal")).toBe("Tidal");
  });

  it("returns the raw id when neither instance nor domain is known", () => {
    expect(api.getProviderName("tidal--abc")).toBe("tidal--abc");
  });
});
