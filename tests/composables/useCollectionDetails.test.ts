import { useCollectionDetails } from "@/composables/useCollectionDetails";
import type { LoadDataParams } from "@/composables/useItemsListing";
import type { MusicAssistantApi } from "@/plugins/api";
import type { Audiobook, MediaCollection } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, reactive, type EffectScope } from "vue";

const { getAudiobookCollection } = vi.hoisted(() => ({
  getAudiobookCollection: vi.fn<MusicAssistantApi["getAudiobookCollection"]>(),
}));
vi.mock("@/plugins/api", () => ({ api: { getAudiobookCollection } }));

const scopes: EffectScope[] = [];
const params: LoadDataParams = {
  offset: 0,
  limit: 50,
  sortBy: "original",
  search: "",
};

function setupCollection() {
  const collection = reactive({
    itemId: "audiobook___First",
    provider: "library",
  });
  const scope = effectScope();
  scopes.push(scope);
  const details = scope.run(() => useCollectionDetails(() => collection))!;
  return { collection, ...details };
}

function snapshot(itemId = "audiobook___First") {
  return {
    item_id: itemId,
    name: "Collection",
    provider: "library",
    provider_mappings: [],
    items: [{ item_id: "book-1" }, { item_id: "book-2" }],
  } as unknown as MediaCollection<Audiobook>;
}

describe("useCollectionDetails", () => {
  beforeEach(() => {
    getAudiobookCollection.mockReset().mockResolvedValue(snapshot());
  });
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  it("keeps the full snapshot when pages are empty or filtered", async () => {
    const details = setupCollection();
    const full = snapshot();
    getAudiobookCollection.mockResolvedValueOnce(full);
    await details.loadCollectionItems(params);
    expect(getAudiobookCollection).toHaveBeenNthCalledWith(
      1,
      "audiobook___First",
      undefined,
      0,
    );

    getAudiobookCollection.mockResolvedValueOnce({ ...full, items: [] });
    expect(
      await details.loadCollectionItems({ ...params, offset: 50 }),
    ).toEqual([]);
    expect(details.itemDetails.value).toEqual(full);

    getAudiobookCollection.mockResolvedValueOnce({
      ...full,
      items: [full.items[0]],
    });
    await details.loadCollectionItems({
      ...params,
      search: "First",
      favoritesOnly: true,
    });
    expect(details.itemDetails.value).toEqual(full);
  });

  it.each([true, false, undefined])(
    "maps the favorite-only toggle %s to the collection filter",
    async (favoritesOnly) => {
      const details = setupCollection();
      await details.loadCollectionItems({ ...params, favoritesOnly });

      expect(getAudiobookCollection).toHaveBeenLastCalledWith(
        "audiobook___First",
        "",
        50,
        0,
        favoritesOnly || undefined,
      );
    },
  );

  it("retries the snapshot after a failed listing load", async () => {
    const details = setupCollection();
    getAudiobookCollection.mockRejectedValueOnce(new Error("snapshot failed"));

    await expect(details.loadCollectionItems(params)).rejects.toThrow(
      "snapshot failed",
    );
    expect(details.itemDetails.value).toBeUndefined();

    await details.loadCollectionItems(params);
    expect(getAudiobookCollection).toHaveBeenNthCalledWith(
      2,
      "audiobook___First",
      undefined,
      0,
    );
    expect(details.itemDetails.value).toEqual(snapshot());
  });

  it("ignores a snapshot that arrives after navigation", async () => {
    let resolveSnapshot!: (value: MediaCollection<Audiobook>) => void;
    getAudiobookCollection.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    );
    const details = setupCollection();
    const previousLoad = details.loadCollectionItems(params);

    details.collection.itemId = "audiobook___Second";
    await nextTick();
    const nextSnapshot = snapshot("audiobook___Second");
    getAudiobookCollection.mockResolvedValueOnce(nextSnapshot);
    await details.loadCollectionItems(params);

    resolveSnapshot(snapshot());
    expect(await previousLoad).toEqual([]);
    expect(details.itemDetails.value).toEqual(nextSnapshot);
  });
});
