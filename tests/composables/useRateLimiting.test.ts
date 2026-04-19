import { useRateLimiting } from "@/composables/useRateLimiting";
import type { PartyConfig } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BOOST_STORAGE_KEY = "guest_boost_bucket";
const ADD_QUEUE_STORAGE_KEY = "guest_add_queue_bucket";
const SKIP_SONG_STORAGE_KEY = "guest_skip_song_bucket";

const createLocalStorageMock = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
};

describe("useRateLimiting", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("localStorage", createLocalStorageMock());
    localStorage.removeItem(BOOST_STORAGE_KEY);
    localStorage.removeItem(ADD_QUEUE_STORAGE_KEY);
    localStorage.removeItem(SKIP_SONG_STORAGE_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes with default values", () => {
    const rateLimiting = useRateLimiting();

    expect(rateLimiting.rateLimitingEnabled.value).toBe(true);
    expect(rateLimiting.addQueueEnabled.value).toBe(true);
    expect(rateLimiting.boostEnabled.value).toBe(true);
    expect(rateLimiting.skipSongEnabled.value).toBe(true);

    expect(rateLimiting.boostTokens.value).toBe(3);
    expect(rateLimiting.addQueueTokens.value).toBe(10);
    expect(rateLimiting.skipSongTokens.value).toBe(1);
  });

  it("consumes boost token and persists bucket to localStorage", () => {
    const rateLimiting = useRateLimiting();

    const result = rateLimiting.consumeBoostToken();

    expect(result).toBe(true);
    expect(rateLimiting.boostTokens.value).toBe(
      rateLimiting.BOOST_MAX_TOKENS.value - 1,
    );

    const stored = localStorage.getItem(BOOST_STORAGE_KEY);
    expect(stored).toBeTruthy();
    const bucket = JSON.parse(stored || "{}") as { tokens?: number };
    expect(bucket.tokens).toBe(rateLimiting.boostTokens.value);
  });

  it("returns false when no tokens are available", () => {
    const now = Date.now();
    localStorage.setItem(
      BOOST_STORAGE_KEY,
      JSON.stringify({
        tokens: 0,
        lastRefill: now,
      }),
    );

    const rateLimiting = useRateLimiting();

    const result = rateLimiting.consumeBoostToken();

    expect(result).toBe(false);
    // Token ref remains at its current value when no token is consumed
    expect(rateLimiting.boostTokens.value).toBe(
      rateLimiting.BOOST_MAX_TOKENS.value,
    );
  });

  it("applies configuration from server", () => {
    const rateLimiting = useRateLimiting();

    const config: PartyConfig = {
      enable_rate_limiting: false,
      enable_add_queue: false,
      enable_boost: false,
      enable_skip_song: false,
      add_queue_limit: 5,
      add_queue_refill_minutes: 3,
      boost_limit: 2,
      boost_refill_minutes: 10,
      skip_song_limit: 2,
      skip_song_refill_minutes: 30,
      karaoke_mode: false,
      highlight_ahead: true,
      request_badge_color: "#000000",
      boost_badge_color: "#ffffff",
      anti_burn_in: false,
      party_name: "Test Party",
      qr_text: "Test QR",
      hide_back_button: false,
      show_progress_bar: false,
    };

    rateLimiting.configure(config);

    expect(rateLimiting.rateLimitingEnabled.value).toBe(false);
    expect(rateLimiting.addQueueEnabled.value).toBe(false);
    expect(rateLimiting.boostEnabled.value).toBe(false);
    expect(rateLimiting.skipSongEnabled.value).toBe(false);

    expect(rateLimiting.ADD_QUEUE_MAX_TOKENS.value).toBe(5);
    expect(rateLimiting.BOOST_MAX_TOKENS.value).toBe(2);
    expect(rateLimiting.SKIP_SONG_MAX_TOKENS.value).toBe(2);

    expect(rateLimiting.requestBadgeColor.value).toBe("#000000");
    expect(rateLimiting.boostBadgeColor.value).toBe("#ffffff");
  });

  it("initializes buckets and countdowns when starting countdown", () => {
    const now = Date.now();

    localStorage.setItem(
      BOOST_STORAGE_KEY,
      JSON.stringify({
        tokens: 0,
        lastRefill: now,
      }),
    );
    localStorage.setItem(
      ADD_QUEUE_STORAGE_KEY,
      JSON.stringify({
        tokens: 0,
        lastRefill: now,
      }),
    );
    localStorage.setItem(
      SKIP_SONG_STORAGE_KEY,
      JSON.stringify({
        tokens: 0,
        lastRefill: now,
      }),
    );

    const rateLimiting = useRateLimiting();

    const cleanup = rateLimiting.startCountdown();

    expect(rateLimiting.boostTokens.value).toBe(0);
    expect(rateLimiting.addQueueTokens.value).toBe(0);
    expect(rateLimiting.skipSongTokens.value).toBe(0);

    expect(typeof rateLimiting.nextTokenCountdown.value).toBe("string");
    expect(rateLimiting.nextTokenCountdown.value.length).toBeGreaterThan(0);

    expect(typeof rateLimiting.addQueueTokenCountdown.value).toBe("string");
    expect(rateLimiting.addQueueTokenCountdown.value.length).toBeGreaterThan(0);

    expect(typeof rateLimiting.skipTokenCountdown.value).toBe("string");
    expect(rateLimiting.skipTokenCountdown.value.length).toBeGreaterThan(0);

    cleanup();
  });

  it("clears addQueueTokenCountdown when tokens are full", () => {
    const rateLimiting = useRateLimiting();

    const cleanup = rateLimiting.startCountdown();

    expect(rateLimiting.addQueueTokens.value).toBe(10);
    expect(rateLimiting.addQueueTokenCountdown.value).toBe("");

    cleanup();
  });
});
