import { effectScope, nextTick, ref } from "vue";
import type { EffectScope, Ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupSubmitSearch } from "@/composables/smart-playlist/useSmartPlaylistSearchHelpers";

describe("setupSubmitSearch", () => {
  let scope: EffectScope;
  let query: Ref<string>;
  let results: Ref<string[]>;
  let isSearching: Ref<boolean>;

  function setup(searchFn: (q: string) => Promise<string[]>) {
    scope = effectScope();
    query = ref("");
    results = ref([]);
    isSearching = ref(false);
    return scope.run(() =>
      setupSubmitSearch({ query, results, isSearching, searchFn }),
    )!;
  }

  afterEach(() => {
    scope.stop();
  });

  it("does not search while typing", async () => {
    const searchFn = vi.fn().mockResolvedValue(["match"]);
    const { isSubmitted } = setup(searchFn);

    query.value = "abc";
    await nextTick();

    expect(searchFn).not.toHaveBeenCalled();
    expect(results.value).toEqual([]);
    expect(isSearching.value).toBe(false);
    expect(isSubmitted.value).toBe(false);
  });

  it("does nothing on submit below the minimum length", async () => {
    const searchFn = vi.fn().mockResolvedValue(["match"]);
    const { submit, isSubmitted } = setup(searchFn);

    query.value = " a ";
    await nextTick();
    await submit();

    expect(searchFn).not.toHaveBeenCalled();
    expect(isSearching.value).toBe(false);
    expect(isSubmitted.value).toBe(false);
  });

  it("searches the trimmed query on submit", async () => {
    const pending = Promise.withResolvers<string[]>();
    const searchFn = vi.fn().mockReturnValue(pending.promise);
    const { submit, isSubmitted } = setup(searchFn);

    query.value = "  ab ";
    await nextTick();
    const done = submit();

    expect(searchFn).toHaveBeenCalledWith("ab");
    expect(isSearching.value).toBe(true);
    expect(isSubmitted.value).toBe(true);

    pending.resolve(["match"]);
    await done;

    expect(results.value).toEqual(["match"]);
    expect(isSearching.value).toBe(false);
    expect(isSubmitted.value).toBe(true);
  });

  it("keeps the results when only surrounding whitespace changes", async () => {
    const searchFn = vi.fn().mockResolvedValue(["match"]);
    const { submit, isSubmitted } = setup(searchFn);

    query.value = "ab";
    await nextTick();
    await submit();
    query.value = "ab ";
    await nextTick();

    expect(results.value).toEqual(["match"]);
    expect(isSubmitted.value).toBe(true);
  });

  it("clears the results on edit and ignores the late response", async () => {
    const pending = Promise.withResolvers<string[]>();
    const searchFn = vi.fn().mockReturnValue(pending.promise);
    const { submit, isSubmitted } = setup(searchFn);

    query.value = "ab";
    await nextTick();
    const done = submit();
    query.value = "abc";
    await nextTick();

    expect(results.value).toEqual([]);
    expect(isSearching.value).toBe(false);
    expect(isSubmitted.value).toBe(false);

    pending.resolve(["stale"]);
    await done;

    expect(results.value).toEqual([]);
    expect(isSearching.value).toBe(false);
  });

  it("lets a second submit win over a still running first one", async () => {
    const first = Promise.withResolvers<string[]>();
    const second = Promise.withResolvers<string[]>();
    const searchFn = vi
      .fn<(q: string) => Promise<string[]>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { submit, isSubmitted } = setup(searchFn);

    query.value = "ab";
    await nextTick();
    const firstDone = submit();
    const secondDone = submit();
    first.resolve(["first"]);
    await firstDone;

    expect(results.value).toEqual([]);
    expect(isSearching.value).toBe(true);

    second.resolve(["second"]);
    await secondDone;

    expect(results.value).toEqual(["second"]);
    expect(isSearching.value).toBe(false);
    expect(isSubmitted.value).toBe(true);
  });

  it("can be submitted again after a failed search", async () => {
    const searchFn = vi
      .fn<(q: string) => Promise<string[]>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(["match"]);
    const { submit, isSubmitted } = setup(searchFn);

    query.value = "ab";
    await nextTick();
    await expect(submit()).rejects.toThrow("offline");

    expect(results.value).toEqual([]);
    expect(isSearching.value).toBe(false);
    expect(isSubmitted.value).toBe(false);

    await submit();

    expect(searchFn).toHaveBeenCalledTimes(2);
    expect(results.value).toEqual(["match"]);
    expect(isSubmitted.value).toBe(true);
  });
});
