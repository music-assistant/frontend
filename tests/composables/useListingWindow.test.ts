import { useListingWindow } from "@/composables/useListingWindow";
import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const scopes: EffectScope[] = [];

const PAGE = 50;

// a listing whose rows above load a page at a time
function fakeListing(baseOffset: number) {
  const listing = {
    baseOffset: ref(baseOffset),
    loading: ref(false),
    isDisposed: () => false,
    loadRow: vi.fn<(row: number) => Promise<boolean>>(),
    loadPreviousPage: vi.fn(async (onPrepend: () => void) => {
      listing.baseOffset.value = Math.max(0, listing.baseOffset.value - PAGE);
      onPrepend();
      return true;
    }),
  };
  return listing;
}

function setupListingWindow(listing: ReturnType<typeof fakeListing>) {
  const scroller = document.createElement("div");
  const rowElement = vi.fn(() => document.createElement("div"));
  const scope = effectScope();
  scopes.push(scope);
  const listingWindow = scope.run(() =>
    useListingWindow({
      scroller: () => scroller,
      topSentinel: ref(null),
      rowElement,
      margin: 0,
      listing,
    }),
  )!;
  return { rowElement, ...listingWindow };
}

describe("useListingWindow", () => {
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  it("scrolls to a row once it is loaded", async () => {
    const listing = fakeListing(80);
    listing.loadRow.mockResolvedValue(true);
    const listingWindow = setupListingWindow(listing);

    await listingWindow.jumpToRow(100);

    expect(listing.loadRow).toHaveBeenCalledWith(100);
    expect(listingWindow.rowElement).toHaveBeenCalledWith(20);
  });

  it("does not scroll to a row that failed to load", async () => {
    const listing = fakeListing(0);
    listing.loadRow.mockResolvedValue(false);
    const listingWindow = setupListingWindow(listing);

    await listingWindow.jumpToRow(100);

    expect(listingWindow.rowElement).not.toHaveBeenCalled();
  });

  it("only scrolls to the latest row when a newer jump starts", async () => {
    const listing = fakeListing(180);
    let finishFirst: (loaded: boolean) => void = () => {};
    listing.loadRow
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishFirst = resolve)),
      )
      .mockResolvedValueOnce(true);
    const listingWindow = setupListingWindow(listing);

    const first = listingWindow.jumpToRow(100);
    await listingWindow.jumpToRow(200);
    finishFirst(true);
    await first;
    await flushPromises();

    expect(listingWindow.rowElement).toHaveBeenCalledTimes(1);
    expect(listingWindow.rowElement).toHaveBeenCalledWith(20);
  });

  it("loads every page above the loaded rows", async () => {
    const listing = fakeListing(120);
    const listingWindow = setupListingWindow(listing);

    await listingWindow.loadAllAbove();

    expect(listing.loadPreviousPage).toHaveBeenCalledTimes(3);
    expect(listing.baseOffset.value).toBe(0);
  });

  it("stops loading pages above when one adds no rows", async () => {
    const listing = fakeListing(120);
    listing.loadPreviousPage.mockResolvedValueOnce(false);
    const listingWindow = setupListingWindow(listing);

    await listingWindow.loadAllAbove();

    expect(listing.loadPreviousPage).toHaveBeenCalledTimes(1);
    expect(listing.baseOffset.value).toBe(120);
  });
});
