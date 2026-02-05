/**
 * Token bucket rate limiting composable for guest view.
 * Manages boost, add-to-queue, and skip-song token buckets
 * with localStorage persistence and countdown timers.
 */

import { ref, type Ref } from "vue";
import type { PartyModeConfig } from "@/plugins/api/interfaces";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const BOOST_STORAGE_KEY = "guest_boost_bucket";
const ADD_QUEUE_STORAGE_KEY = "guest_add_queue_bucket";
const SKIP_SONG_STORAGE_KEY = "guest_skip_song_bucket";

export function useRateLimiting() {
  // Default values (will be overridden by server config)
  const BOOST_MAX_TOKENS = ref(3);
  const BOOST_REFILL_RATE = ref(1000 * 60 * 20); // 20 minutes

  const ADD_QUEUE_MAX_TOKENS = ref(10);
  const ADD_QUEUE_REFILL_RATE = ref(1000 * 60 * 2); // 2 minutes per token

  const SKIP_SONG_MAX_TOKENS = ref(1);
  const SKIP_SONG_REFILL_RATE = ref(1000 * 60 * 60); // 60 minutes per token

  // Feature toggles
  const rateLimitingEnabled = ref(true);
  const addQueueEnabled = ref(true);
  const boostEnabled = ref(true);
  const skipSongEnabled = ref(true);

  // Badge colors
  const requestBadgeColor = ref("");
  const boostBadgeColor = ref("");

  // Token counts
  const boostTokens = ref(3);
  const addQueueTokens = ref(10);
  const skipSongTokens = ref(1);

  // Countdown displays
  const nextTokenCountdown = ref<string>("");
  const skipTokenCountdown = ref<string>("");

  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  // --- Internal helpers ---

  const loadTokenBucket = (
    storageKey: string,
    maxTokens: number,
    refillRate: number,
  ): TokenBucket => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return {
        tokens: maxTokens,
        lastRefill: Date.now(),
      };
    }

    try {
      const bucket: TokenBucket = JSON.parse(stored);
      const now = Date.now();
      const timeSinceRefill = now - bucket.lastRefill;
      const tokensToAdd = Math.floor(timeSinceRefill / refillRate);

      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }

      return bucket;
    } catch {
      return {
        tokens: maxTokens,
        lastRefill: Date.now(),
      };
    }
  };

  const saveTokenBucket = (storageKey: string, bucket: TokenBucket) => {
    localStorage.setItem(storageKey, JSON.stringify(bucket));
  };

  const consumeToken = (
    storageKey: string,
    maxTokens: number,
    refillRate: number,
    tokenRef: Ref<number>,
  ): boolean => {
    const bucket = loadTokenBucket(storageKey, maxTokens, refillRate);
    if (bucket.tokens <= 0) {
      return false;
    }

    bucket.tokens -= 1;
    saveTokenBucket(storageKey, bucket);
    tokenRef.value = bucket.tokens;
    return true;
  };

  const getTimeUntilNextTokenRefill = (
    storageKey: string,
    maxTokens: number,
    refillRate: number,
  ): number => {
    const bucket = loadTokenBucket(storageKey, maxTokens, refillRate);
    if (bucket.tokens >= maxTokens) {
      return 0;
    }

    const timeSinceRefill = Date.now() - bucket.lastRefill;
    const timeUntilNext = refillRate - (timeSinceRefill % refillRate);
    return Math.ceil(timeUntilNext / 1000 / 60); // Return minutes
  };

  const formatCountdown = (milliseconds: number): string => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  const updateCountdown = () => {
    // Update Boost tokens
    const boostBucket = loadTokenBucket(
      BOOST_STORAGE_KEY,
      BOOST_MAX_TOKENS.value,
      BOOST_REFILL_RATE.value,
    );
    boostTokens.value = boostBucket.tokens;

    if (boostBucket.tokens >= BOOST_MAX_TOKENS.value) {
      nextTokenCountdown.value = "";
    } else {
      const timeSinceRefill = Date.now() - boostBucket.lastRefill;
      const timeUntilNext =
        BOOST_REFILL_RATE.value - (timeSinceRefill % BOOST_REFILL_RATE.value);
      nextTokenCountdown.value = formatCountdown(timeUntilNext);
    }

    // Update Skip Song tokens
    const skipBucket = loadTokenBucket(
      SKIP_SONG_STORAGE_KEY,
      SKIP_SONG_MAX_TOKENS.value,
      SKIP_SONG_REFILL_RATE.value,
    );
    skipSongTokens.value = skipBucket.tokens;

    if (skipBucket.tokens >= SKIP_SONG_MAX_TOKENS.value) {
      skipTokenCountdown.value = "";
    } else {
      const timeSinceRefill = Date.now() - skipBucket.lastRefill;
      const timeUntilNext =
        SKIP_SONG_REFILL_RATE.value -
        (timeSinceRefill % SKIP_SONG_REFILL_RATE.value);
      skipTokenCountdown.value = formatCountdown(timeUntilNext);
    }
  };

  // --- Public API ---

  const consumeBoostToken = (): boolean =>
    consumeToken(
      BOOST_STORAGE_KEY,
      BOOST_MAX_TOKENS.value,
      BOOST_REFILL_RATE.value,
      boostTokens,
    );

  const consumeAddQueueToken = (): boolean =>
    consumeToken(
      ADD_QUEUE_STORAGE_KEY,
      ADD_QUEUE_MAX_TOKENS.value,
      ADD_QUEUE_REFILL_RATE.value,
      addQueueTokens,
    );

  const consumeSkipSongToken = (): boolean =>
    consumeToken(
      SKIP_SONG_STORAGE_KEY,
      SKIP_SONG_MAX_TOKENS.value,
      SKIP_SONG_REFILL_RATE.value,
      skipSongTokens,
    );

  const getTimeUntilNextToken = (): number =>
    getTimeUntilNextTokenRefill(
      BOOST_STORAGE_KEY,
      BOOST_MAX_TOKENS.value,
      BOOST_REFILL_RATE.value,
    );

  const getTimeUntilNextAddQueueToken = (): number =>
    getTimeUntilNextTokenRefill(
      ADD_QUEUE_STORAGE_KEY,
      ADD_QUEUE_MAX_TOKENS.value,
      ADD_QUEUE_REFILL_RATE.value,
    );

  const getTimeUntilNextSkipToken = (): number =>
    getTimeUntilNextTokenRefill(
      SKIP_SONG_STORAGE_KEY,
      SKIP_SONG_MAX_TOKENS.value,
      SKIP_SONG_REFILL_RATE.value,
    );

  /**
   * Apply server config to rate limiting parameters.
   * Called after fetching party_mode/config from the server.
   */
  const configure = (config: PartyModeConfig) => {
    rateLimitingEnabled.value = config.enable_rate_limiting ?? true;
    addQueueEnabled.value = config.enable_add_queue ?? true;
    boostEnabled.value = config.enable_boost ?? true;
    skipSongEnabled.value = config.enable_skip_song ?? true;

    ADD_QUEUE_MAX_TOKENS.value = config.add_queue_limit || 10;
    ADD_QUEUE_REFILL_RATE.value =
      (config.add_queue_refill_minutes || 2) * 60 * 1000;
    BOOST_MAX_TOKENS.value = config.boost_limit || 3;
    BOOST_REFILL_RATE.value = (config.boost_refill_minutes || 20) * 60 * 1000;
    SKIP_SONG_MAX_TOKENS.value = config.skip_song_limit || 1;
    SKIP_SONG_REFILL_RATE.value =
      (config.skip_song_refill_minutes || 60) * 60 * 1000;

    requestBadgeColor.value = config.request_badge_color || "#2196F3";
    boostBadgeColor.value = config.boost_badge_color || "#FF5722";
  };

  /**
   * Initialize token buckets from localStorage and start countdown timer.
   * Returns a cleanup function to clear the interval.
   */
  const startCountdown = (): (() => void) => {
    // Initialize token buckets
    const boostBucket = loadTokenBucket(
      BOOST_STORAGE_KEY,
      BOOST_MAX_TOKENS.value,
      BOOST_REFILL_RATE.value,
    );
    boostTokens.value = boostBucket.tokens;

    const addQueueBucket = loadTokenBucket(
      ADD_QUEUE_STORAGE_KEY,
      ADD_QUEUE_MAX_TOKENS.value,
      ADD_QUEUE_REFILL_RATE.value,
    );
    addQueueTokens.value = addQueueBucket.tokens;

    const skipSongBucket = loadTokenBucket(
      SKIP_SONG_STORAGE_KEY,
      SKIP_SONG_MAX_TOKENS.value,
      SKIP_SONG_REFILL_RATE.value,
    );
    skipSongTokens.value = skipSongBucket.tokens;

    // Start countdown timer
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    };
  };

  return {
    // Reactive state for template
    rateLimitingEnabled,
    boostEnabled,
    addQueueEnabled,
    skipSongEnabled,
    requestBadgeColor,
    boostBadgeColor,
    boostTokens,
    addQueueTokens,
    skipSongTokens,
    BOOST_MAX_TOKENS,
    ADD_QUEUE_MAX_TOKENS,
    SKIP_SONG_MAX_TOKENS,
    nextTokenCountdown,
    skipTokenCountdown,
    // Actions
    consumeBoostToken,
    consumeAddQueueToken,
    consumeSkipSongToken,
    getTimeUntilNextToken,
    getTimeUntilNextAddQueueToken,
    getTimeUntilNextSkipToken,
    configure,
    startCountdown,
  };
}
