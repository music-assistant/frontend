import { describe, expect, it } from "vitest";

import { ProviderType, type ProviderInstance } from "@/plugins/api/interfaces";

import {
  eligibleFilterProviders,
  resolveProviderFilterParam,
} from "./rowProviderFilter";

const provider = (
  instance_id: string,
  type: ProviderType = ProviderType.MUSIC,
): ProviderInstance =>
  ({
    type,
    domain: instance_id.split("--")[0],
    name: instance_id,
    instance_id,
    supported_features: [],
    available: true,
    is_streaming_provider: null,
  }) as ProviderInstance;

describe("eligibleFilterProviders", () => {
  it("includes only music providers", () => {
    const providers = [
      provider("spotify--abc"),
      provider("chromecast--def", ProviderType.PLAYER),
    ];

    expect(eligibleFilterProviders(providers, [])).toEqual([providers[0]]);
  });

  it("is unrestricted when the user has no provider_filter", () => {
    const providers = [provider("spotify--abc"), provider("filesystem--def")];

    expect(eligibleFilterProviders(providers, [])).toEqual(providers);
  });

  it("restricts to the user's provider_filter when set", () => {
    const providers = [provider("spotify--abc"), provider("filesystem--def")];

    expect(eligibleFilterProviders(providers, ["spotify--abc"])).toEqual([
      providers[0],
    ]);
  });
});

describe("resolveProviderFilterParam", () => {
  const eligible = ["spotify--abc", "filesystem--def", "audiobookshelf--ghi"];

  it("omits the filter when nothing is hidden", () => {
    expect(resolveProviderFilterParam(eligible, [])).toBeUndefined();
  });

  it("omits the filter when only stale providers are hidden", () => {
    expect(
      resolveProviderFilterParam(eligible, ["removed-provider--abc"]),
    ).toBeUndefined();
  });

  it("returns the allowed (non-hidden) ids when some providers are hidden", () => {
    expect(
      resolveProviderFilterParam(eligible, ["audiobookshelf--ghi"]),
    ).toEqual(["spotify--abc", "filesystem--def"]);
  });

  it("returns an explicit empty array when every eligible provider is hidden", () => {
    expect(resolveProviderFilterParam(eligible, eligible)).toEqual([]);
  });
});
