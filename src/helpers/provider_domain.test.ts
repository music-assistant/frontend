import { describe, expect, it } from "vitest";
import {
  embeddedProviderDomain,
  embeddedProviderDomains,
  type KnownProviders,
  resolveProviderDomain,
} from "./provider_domain";

const known: KnownProviders = {
  providers: {
    "spotify--abc": { domain: "spotify" },
    // a source converted by the server keeps its id and is loaded as Local files
    "filesystem_smb--loaded": { domain: "filesystem_local" },
  },
  providerManifests: {
    spotify: {},
    filesystem_local: {},
    fanarttv: {},
  },
};

describe("resolveProviderDomain", () => {
  it("takes the domain of a loaded instance", () => {
    expect(resolveProviderDomain("spotify--abc", known)).toBe("spotify");
    expect(resolveProviderDomain("filesystem_smb--loaded", known)).toBe(
      "filesystem_local",
    );
  });

  it("takes a known domain as it is", () => {
    expect(resolveProviderDomain("fanarttv", known)).toBe("fanarttv");
  });

  it("knows an instance that is not loaded by the domain its id names", () => {
    expect(resolveProviderDomain("spotify--notshared", known)).toBe("spotify");
  });

  it.each(["filesystem_smb--fyQZakP3", "filesystem_nfs--k2Lm9xQa"])(
    "reads the converted source %s as Local files",
    (id) => {
      expect(resolveProviderDomain(id, known)).toBe("filesystem_local");
    },
  );

  it("reads a domain of a folded provider as the provider it went into", () => {
    expect(resolveProviderDomain("filesystem_smb", known)).toBe(
      "filesystem_local",
    );
  });

  it.each(["mystery--abc", "mystery", ""])(
    "does not know the domain of %j",
    (id) => {
      expect(resolveProviderDomain(id, known)).toBeUndefined();
    },
  );

  it("does not guess Local files when the app has no manifest for it", () => {
    const withoutLocalFiles: KnownProviders = {
      providers: {},
      providerManifests: { spotify: {} },
    };

    expect(
      resolveProviderDomain("filesystem_smb--fyQZakP3", withoutLocalFiles),
    ).toBeUndefined();
  });
});

describe("embeddedProviderDomain", () => {
  it.each([
    ["spotify--abc", "spotify"],
    ["spotify", "spotify"],
    ["filesystem_smb--fyQZakP3", "filesystem_local"],
    ["filesystem_nfs--k2Lm9xQa", "filesystem_local"],
    ["filesystem_nfs", "filesystem_local"],
    ["filesystem_local--abc", "filesystem_local"],
  ])("reads %s as %s", (id, domain) => {
    expect(embeddedProviderDomain(id)).toBe(domain);
  });
});

describe("embeddedProviderDomains", () => {
  it.each([
    ["spotify--abc", ["spotify"]],
    ["spotify", ["spotify"]],
    ["filesystem_local--abc", ["filesystem_local"]],
    ["filesystem_smb--fyQZakP3", ["filesystem_smb", "filesystem_local"]],
    ["filesystem_nfs", ["filesystem_nfs", "filesystem_local"]],
  ])("reads %s as %j", (id, domains) => {
    expect(embeddedProviderDomains(id)).toEqual(domains);
  });
});
