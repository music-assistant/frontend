import { describe, expect, it } from "vitest";
import { providerMapping } from "../../tests/fixtures/providerMapping";
import { providerLinks } from "./provider_links";

describe("providerLinks", () => {
  it("shares the source link once across provider accounts", () => {
    const mapping = providerMapping({
      provider_domain: "ytmusic",
      url: "https://music.youtube.com/watch?v=meuR1l4j-xs&si=tracking",
    });
    expect(
      providerLinks([mapping, { ...mapping, provider_instance: "other" }]),
    ).toEqual([{ url: mapping.url, provider: "ytmusic" }]);
  });

  it("keeps album browse URLs without inventing a track ID", () => {
    const url = "https://music.youtube.com/browse/MPREb_pRx4LBJiFWR";
    expect(
      providerLinks([providerMapping({ provider_domain: "ytmusic", url })]),
    ).toEqual([{ url, provider: "ytmusic" }]);
  });

  it("excludes local paths, internal URIs and malformed provider links", () => {
    expect(
      providerLinks([
        providerMapping(),
        providerMapping({ url: "not a URL" }),
        providerMapping({ url: "ytmusic://track/x" }),
        providerMapping({ url: "javascript:alert(1)" }),
        providerMapping({
          url: "https://music.youtube.com/playlist?list=None",
        }),
        providerMapping({
          provider_domain: "filesystem_local",
          url: "https://server/music/file.flac",
        }),
      ]),
    ).toEqual([]);
  });
});
