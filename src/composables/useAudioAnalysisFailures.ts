import { api } from "@/plugins/api";
import { computed, ref, type Ref } from "vue";

/**
 * Join artist names the same way `helpers/utils.getArtistsString` does, inlined
 * to keep this data composable free of that module's heavy SFC import chain.
 */
function artistString(
  artists: ReadonlyArray<{ name: string }> | undefined,
): string | null {
  if (!artists || artists.length === 0) return null;
  return artists.map((a) => a.name).join(" | ");
}

/**
 * Mirrors a row of the server's `audio_analysis/failures` command, mapped from
 * the wire snake_case into camelCase. Timestamps are epoch seconds; `nextRetry`
 * is null when the failure never auto-retries (permanently blocked).
 */
export interface RawFailure {
  itemId: string;
  provider: string;
  aaDomain: string;
  reason: string;
  nextRetry: number | null;
  timestampCreated: number;
}

/** A failure row enriched with the resolved track name/artist for display. */
export interface FailureRow extends RawFailure {
  /** Resolved track name, or the raw item_id when the lookup failed. */
  name: string;
  /** Resolved artist string, or null when unknown. */
  artist: string | null;
}

/** Classification of a failure's retry state, derived from `nextRetry`. */
export type RetryStatus =
  | { kind: "blocked" }
  | { kind: "eligible" }
  | { kind: "scheduled"; seconds: number };

/**
 * Classify a failure's `nextRetry` (epoch seconds) against the current time.
 * null -> blocked (never auto-retries); past/now -> eligible; future -> scheduled.
 */
export function classifyRetry(
  nextRetry: number | null,
  nowSeconds: number,
): RetryStatus {
  if (nextRetry === null) return { kind: "blocked" };
  const seconds = nextRetry - nowSeconds;
  if (seconds <= 0) return { kind: "eligible" };
  return { kind: "scheduled", seconds };
}

interface ServerFailure {
  item_id: string;
  provider: string;
  aa_provider_domain: string;
  reason: string;
  next_retry: number | null;
  timestamp_created: number;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Name-resolution cache key. The resolved track name is the same regardless of
 * which AA provider failed it, so this intentionally omits the AA domain.
 */
function cacheKey(f: RawFailure): string {
  return `${f.provider}::${f.itemId}`;
}

/**
 * Stable row identity: the server's natural key for a failure is the
 * (item_id, provider, aa_provider_domain) triple, so the same track can appear
 * as distinct rows under different AA providers. Used for row equality, the
 * delete predicate, and the Vue list key.
 */
export function rowId(f: RawFailure): string {
  return `${f.provider}::${f.itemId}::${f.aaDomain}`;
}

export function useAudioAnalysisFailures(options?: { pageSize?: number }): {
  pageRows: Ref<FailureRow[]>;
  total: Ref<number>;
  page: Ref<number>;
  pageCount: Ref<number>;
  hasNextPage: Ref<boolean>;
  loading: Ref<boolean>;
  refresh: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  clearOne: (row: RawFailure) => Promise<number>;
  clearAll: () => Promise<number>;
} {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;

  const failures = ref<RawFailure[]>([]);
  const pageRows = ref<FailureRow[]>([]);
  const page = ref(1);
  const loading = ref(false);

  // Resolved-name cache keyed by provider+item_id. A null value means the
  // lookup was attempted and failed, so we don't retry it on re-paging.
  const nameCache = new Map<
    string,
    { name: string; artist: string | null } | null
  >();

  const total = computed(() => failures.value.length);
  const pageCount = computed(() =>
    Math.max(1, Math.ceil(failures.value.length / pageSize)),
  );
  const hasNextPage = computed(() => page.value < pageCount.value);

  function toRow(f: RawFailure): FailureRow {
    const resolved = nameCache.get(cacheKey(f));
    return {
      ...f,
      name: resolved?.name ?? f.itemId,
      artist: resolved?.artist ?? null,
    };
  }

  function currentSlice(): RawFailure[] {
    const start = (page.value - 1) * pageSize;
    return failures.value.slice(start, start + pageSize);
  }

  async function resolveCurrentPage(): Promise<void> {
    const slice = currentSlice();
    // Render immediately with whatever is cached (raw item_id as fallback)...
    pageRows.value = slice.map(toRow);
    // ...then resolve the names we haven't tried yet, one lookup per row.
    const pending = slice.filter((f) => !nameCache.has(cacheKey(f)));
    await Promise.allSettled(
      pending.map(async (f) => {
        try {
          const track = await api.getTrack(f.itemId, f.provider);
          nameCache.set(cacheKey(f), {
            name: track.name,
            artist: artistString(track.artists),
          });
        } catch {
          nameCache.set(cacheKey(f), null);
        }
      }),
    );
    pageRows.value = slice.map(toRow);
  }

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      const rows = await api.sendCommand<ServerFailure[]>(
        "audio_analysis/failures",
      );
      failures.value = rows.map((r) => ({
        itemId: r.item_id,
        provider: r.provider,
        aaDomain: r.aa_provider_domain,
        reason: r.reason,
        nextRetry: r.next_retry,
        timestampCreated: r.timestamp_created,
      }));
      page.value = 1;
      await resolveCurrentPage();
    } catch (error) {
      // The `audio_analysis/failures` command is absent on servers without
      // failure tracking (version skew), so degrade to an empty list rather
      // than throwing and breaking the rest of the settings page. Logged so a
      // genuine (non-version-skew) failure still leaves a diagnostic trail.
      console.warn("Failed to load audio analysis failures:", error);
      failures.value = [];
      pageRows.value = [];
      page.value = 1;
    } finally {
      loading.value = false;
    }
  }

  async function next(): Promise<void> {
    if (!hasNextPage.value) return;
    page.value += 1;
    await resolveCurrentPage();
  }

  async function prev(): Promise<void> {
    if (page.value <= 1) return;
    page.value -= 1;
    await resolveCurrentPage();
  }

  async function clearOne(row: RawFailure): Promise<number> {
    const count = await api.sendCommand<number>(
      "audio_analysis/failures/clear",
      {
        item_id: row.itemId,
        provider: row.provider,
        aa_domain: row.aaDomain,
      },
    );
    failures.value = failures.value.filter((f) => rowId(f) !== rowId(row));
    if (page.value > pageCount.value) page.value = pageCount.value;
    await resolveCurrentPage();
    return count;
  }

  async function clearAll(): Promise<number> {
    const domains = [...new Set(failures.value.map((f) => f.aaDomain))];
    const results = await Promise.allSettled(
      domains.map((aa_domain) =>
        api.sendCommand<number>("audio_analysis/failures/clear", { aa_domain }),
      ),
    );
    // Re-sync from the server regardless of partial outcomes so the table
    // reflects what was actually cleared rather than an optimistic guess.
    await refresh();
    const deleted = results.reduce(
      (sum, r) => sum + (r.status === "fulfilled" ? r.value : 0),
      0,
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      throw new Error(`Failed to clear ${failed} of ${domains.length} domains`);
    }
    return deleted;
  }

  return {
    pageRows,
    total,
    page,
    pageCount,
    hasNextPage,
    loading,
    refresh,
    next,
    prev,
    clearOne,
    clearAll,
  };
}
