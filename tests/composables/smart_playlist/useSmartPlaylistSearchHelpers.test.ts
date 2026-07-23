import { effectScope, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupDebouncedSearch } from "@/composables/smart-playlist/useSmartPlaylistSearchHelpers";

describe("setupDebouncedSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not search below min length and clears results", async () => {
    const query = ref("");
    const results = ref<string[]>(["keep"]);
    const isSearching = ref(false);
    const searchFn = vi.fn().mockResolvedValue(["ignored"]);

    const scope = effectScope();
    scope.run(() => {
      setupDebouncedSearch({
        query,
        results,
        isSearching,
        searchFn,
        minLength: 2,
        debounceMs: 100,
      });
    });

    query.value = "a";
    await Promise.resolve();

    expect(searchFn).not.toHaveBeenCalled();
    expect(results.value).toEqual([]);
    expect(isSearching.value).toBe(false);

    scope.stop();
  });

  it("runs debounced search and updates results", async () => {
    const query = ref("");
    const results = ref<string[]>([]);
    const isSearching = ref(false);
    const searchFn = vi.fn().mockResolvedValue(["match"]);

    const scope = effectScope();
    scope.run(() => {
      setupDebouncedSearch({
        query,
        results,
        isSearching,
        searchFn,
        debounceMs: 100,
      });
    });

    query.value = "ab";
    await Promise.resolve();
    expect(isSearching.value).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();

    expect(searchFn).toHaveBeenCalledWith("ab");
    expect(results.value).toEqual(["match"]);
    expect(isSearching.value).toBe(false);

    scope.stop();
  });

  it("keeps latest query result only", async () => {
    const query = ref("");
    const results = ref<string[]>([]);
    const isSearching = ref(false);
    const searchFn = vi
      .fn<(q: string) => Promise<string[]>>()
      .mockImplementation(async (q: string) => {
        await Promise.resolve();
        return [q];
      });

    const scope = effectScope();
    scope.run(() => {
      setupDebouncedSearch({
        query,
        results,
        isSearching,
        searchFn,
        debounceMs: 100,
      });
    });

    query.value = "ab";
    await Promise.resolve();
    query.value = "abc";
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();

    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenLastCalledWith("abc");
    expect(results.value).toEqual(["abc"]);

    scope.stop();
  });
});
