import type { LoadDataParams } from "@/composables/useItemsListing";
import {
  useLetterIndex,
  type LoadLetterIndexFn,
} from "@/composables/useLetterIndex";
import {
  SortDirection,
  SortField,
  type LetterIndexEntry,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const scopes: EffectScope[] = [];

const INDEX: LetterIndexEntry[] = [
  { letter: "#", offset: 0 },
  { letter: "B", offset: 3 },
  { letter: "D", offset: 7 },
];

function setupLetterIndex(
  loader: LoadLetterIndexFn | undefined,
  overrides: Partial<LoadDataParams> = {},
) {
  const params = ref<LoadDataParams>({
    offset: 0,
    limit: 50,
    sortBy: "name",
    sortField: SortField.SORT_NAME,
    sortDirection: SortDirection.ASC,
    search: "",
    ...overrides,
  });
  const scope = effectScope();
  scopes.push(scope);
  const index = scope.run(() => useLetterIndex(() => loader, params))!;
  return { params, ...index };
}

const labels = (letters: { label: string }[]) =>
  letters.map((letter) => letter.label);

describe("useLetterIndex", () => {
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  describe("letters", () => {
    it("lists the whole alphabet with # first and marks the letters with items", async () => {
      const index = setupLetterIndex(async () => INDEX);
      await flushPromises();

      const letters = index.letters.value;
      expect(labels(letters)).toEqual(["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]);
      expect(
        letters.filter((letter) => letter.available).map((l) => l.label),
      ).toEqual(["#", "B", "D"]);
    });

    it("lists the alphabet backwards with # last when sorted descending", async () => {
      const index = setupLetterIndex(async () => INDEX, {
        sortDirection: SortDirection.DESC,
      });
      await flushPromises();

      expect(labels(index.letters.value)).toEqual([
        ..."ZYXWVUTSRQPONMLKJIHGFEDCBA",
        "#",
      ]);
    });

    it("leaves out # when no item starts with a number or symbol", async () => {
      const index = setupLetterIndex(async () => INDEX.slice(1));
      await flushPromises();

      expect(labels(index.letters.value)).not.toContain("#");
    });
  });

  describe("rowFor", () => {
    it("gives the first row of a letter with items", async () => {
      const index = setupLetterIndex(async () => INDEX);
      await flushPromises();

      expect(index.rowFor("#")).toBe(0);
      expect(index.rowFor("D")).toBe(7);
    });

    it("goes to the next letter with items, or the one before it at the end", async () => {
      const index = setupLetterIndex(async () => INDEX);
      await flushPromises();

      expect(index.rowFor("A")).toBe(3);
      expect(index.rowFor("C")).toBe(7);
      expect(index.rowFor("Z")).toBe(7);
    });

    it("follows the listing order when sorted descending", async () => {
      const index = setupLetterIndex(
        async () => [
          { letter: "D", offset: 0 },
          { letter: "B", offset: 4 },
        ],
        { sortDirection: SortDirection.DESC },
      );
      await flushPromises();

      expect(index.rowFor("C")).toBe(4);
      expect(index.rowFor("A")).toBe(4);
      expect(index.rowFor("Z")).toBe(0);
    });

    it("gives no row for a label that is not in the index", async () => {
      const index = setupLetterIndex(async () => INDEX);
      await flushPromises();

      expect(index.rowFor("?")).toBeUndefined();
    });
  });

  describe("letterAt", () => {
    it("gives the letter whose items a row belongs to", async () => {
      const index = setupLetterIndex(async () => INDEX);
      await flushPromises();

      expect(index.letterAt(0)).toBe("#");
      expect(index.letterAt(3)).toBe("B");
      expect(index.letterAt(6)).toBe("B");
      expect(index.letterAt(40)).toBe("D");
    });

    it("gives no letter before the index is loaded", () => {
      const index = setupLetterIndex(async () => INDEX);

      expect(index.letterAt(3)).toBeUndefined();
    });
  });

  describe("loading", () => {
    it.each([SortField.NAME, SortField.SORT_NAME])(
      "loads the index for the %s sort with the listing's parameters",
      async (sortField) => {
        const loader = vi.fn<LoadLetterIndexFn>().mockResolvedValue(INDEX);
        const index = setupLetterIndex(loader, {
          sortField,
          favoritesOnly: true,
        });
        await flushPromises();

        expect(loader).toHaveBeenCalledWith(
          expect.objectContaining({ sortField, favoritesOnly: true }),
        );
        expect(index.entries.value).toEqual(INDEX);
      },
    );

    it.each<[string, Partial<LoadDataParams>]>([
      ["another sort", { sortField: SortField.TIMESTAMP_ADDED }],
      ["a search", { search: "abba" }],
    ])("holds no letters for %s", async (_, overrides) => {
      const loader = vi.fn<LoadLetterIndexFn>().mockResolvedValue(INDEX);
      const index = setupLetterIndex(loader, overrides);
      await flushPromises();

      expect(loader).not.toHaveBeenCalled();
      expect(index.entries.value).toEqual([]);
      expect(index.letters.value.some((letter) => letter.available)).toBe(
        false,
      );
    });

    it("holds no letters for a listing without an index", async () => {
      const index = setupLetterIndex(undefined);
      await flushPromises();

      expect(index.entries.value).toEqual([]);
    });

    it("clears the letters when a search starts", async () => {
      const index = setupLetterIndex(async () => INDEX);
      await flushPromises();

      index.params.value.search = "abba";
      await flushPromises();

      expect(index.entries.value).toEqual([]);
    });

    it("keeps only the result of the latest load", async () => {
      const finishers: ((entries: LetterIndexEntry[]) => void)[] = [];
      const loader = vi.fn<LoadLetterIndexFn>(
        () => new Promise((resolve) => finishers.push(resolve)),
      );
      const index = setupLetterIndex(loader);
      await flushPromises();
      index.params.value.favoritesOnly = true;
      await flushPromises();
      expect(loader).toHaveBeenCalledTimes(2);

      finishers[1](INDEX);
      finishers[0]([{ letter: "Z", offset: 0 }]);
      await flushPromises();

      expect(index.entries.value).toEqual(INDEX);
    });

    it("loads again when a filter changes but not when the listing pages or its sort is picked", async () => {
      const loader = vi.fn<LoadLetterIndexFn>().mockResolvedValue(INDEX);
      const index = setupLetterIndex(loader);
      await flushPromises();

      Object.assign(index.params.value, {
        offset: 100,
        limit: 25,
        refresh: true,
        randomSeed: 42,
        sortBy: "name:desc",
      });
      await flushPromises();
      expect(loader).toHaveBeenCalledTimes(1);
      expect(index.entries.value).toEqual(INDEX);

      index.params.value.genreIds = [3];
      await flushPromises();
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("holds no letters when the index fails to load", async () => {
      const index = setupLetterIndex(async () => {
        throw new Error("offline");
      });
      await flushPromises();

      expect(index.entries.value).toEqual([]);
    });
  });
});
