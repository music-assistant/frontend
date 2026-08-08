import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/plugins/api";
import {
  MediaType,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";

import { useResolvedItemProviders } from "./useResolvedItemProviders";

// A stub ItemMapping, as returned by music/recommendations/items for the
// recently-played folder: no provider_mappings, provider reads "library".
const itemMapping = (uri: string): ItemMapping =>
  ({
    item_id: uri.split("/").pop(),
    provider: "library",
    name: "Test Item",
    uri,
    media_type: MediaType.TRACK,
    is_playable: true,
    available: true,
  }) as unknown as ItemMapping;

// A full item, as returned by api.getItemByUri, with real provider_mappings.
const fullItem = (uri: string, providerInstanceIds: string[]): MediaItemType =>
  ({
    item_id: uri.split("/").pop(),
    provider: "library",
    name: "Test Item",
    uri,
    media_type: MediaType.TRACK,
    is_playable: true,
    favorite: false,
    provider_mappings: providerInstanceIds.map((provider_instance) => ({
      item_id: "provider-item-id",
      provider_domain: provider_instance.split("--")[0],
      provider_instance,
      available: true,
    })),
  }) as unknown as MediaItemType;

describe("useResolvedItemProviders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined before resolution lands", () => {
    const item = itemMapping("library://track/1");
    vi.spyOn(api, "getItemByUri").mockReturnValue(new Promise(() => {}));
    const { resolve, providerIdsFor } = useResolvedItemProviders();

    resolve([item]);

    expect(providerIdsFor(item)).toBeUndefined();
  });

  it("resolves provider ids via getItemByUri for a stub ItemMapping", async () => {
    const item = itemMapping("library://track/2");
    const spy = vi
      .spyOn(api, "getItemByUri")
      .mockResolvedValue(fullItem(item.uri, ["spotify--abc"]));
    const { resolve, providerIdsFor } = useResolvedItemProviders();

    resolve([item]);
    await vi.waitFor(() => expect(providerIdsFor(item)).toBeDefined());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(item.uri);
    expect(providerIdsFor(item)).toEqual(["spotify--abc"]);
  });

  it("resolves multiple provider ids for an item matched on several providers", async () => {
    const item = itemMapping("library://track/3");
    vi.spyOn(api, "getItemByUri").mockResolvedValue(
      fullItem(item.uri, ["spotify--abc", "filesystem_local--def"]),
    );
    const { resolve, providerIdsFor } = useResolvedItemProviders();

    resolve([item]);
    await vi.waitFor(() => expect(providerIdsFor(item)).toBeDefined());

    expect(providerIdsFor(item)).toEqual([
      "spotify--abc",
      "filesystem_local--def",
    ]);
  });

  it("skips the lookup for an item that already carries provider_mappings", () => {
    const item = fullItem("library://track/4", ["filesystem_local--def"]);
    const spy = vi.spyOn(api, "getItemByUri");
    const { resolve, providerIdsFor } = useResolvedItemProviders();

    resolve([item]);

    expect(spy).not.toHaveBeenCalled();
    expect(providerIdsFor(item)).toEqual(["filesystem_local--def"]);
  });

  it("caches by uri: resolving the same uri again does not re-fetch", async () => {
    const item = itemMapping("library://track/5");
    const spy = vi
      .spyOn(api, "getItemByUri")
      .mockResolvedValue(fullItem(item.uri, ["spotify--abc"]));
    const { resolve, providerIdsFor } = useResolvedItemProviders();

    resolve([item]);
    await vi.waitFor(() => expect(providerIdsFor(item)).toBeDefined());
    resolve([item]);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent resolve() calls for the same in-flight uri", async () => {
    const item = itemMapping("library://track/6");
    const spy = vi
      .spyOn(api, "getItemByUri")
      .mockResolvedValue(fullItem(item.uri, ["spotify--abc"]));
    const { resolve, providerIdsFor } = useResolvedItemProviders();

    resolve([item]);
    resolve([item]);
    await vi.waitFor(() => expect(providerIdsFor(item)).toBeDefined());

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
