import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand, mockGetTrack } = vi.hoisted(() => {
  return {
    mockSendCommand: vi.fn(),
    mockGetTrack: vi.fn(),
  };
});

vi.mock("@/plugins/api", () => {
  return {
    api: {
      sendCommand: mockSendCommand,
      getTrack: mockGetTrack,
    },
  };
});

import {
  classifyRetry,
  useAudioAnalysisFailures,
  type RawFailure,
} from "@/composables/useAudioAnalysisFailures";

/** Server `audio_analysis/failures` row shape (snake_case, epoch seconds). */
interface ServerFailure {
  item_id: string;
  provider: string;
  aa_provider_domain: string;
  reason: string;
  next_retry: number | null;
  timestamp_created: number;
}

function serverFailure(over: Partial<ServerFailure> = {}): ServerFailure {
  return {
    item_id: "1",
    provider: "tidal",
    aa_provider_domain: "sonic_analysis",
    reason: "decode error",
    next_retry: null,
    timestamp_created: 1000,
    ...over,
  };
}

/** Mock the failures list + clear command bus. */
function mockFailures(rows: ServerFailure[]) {
  mockSendCommand.mockImplementation((cmd: string) => {
    if (cmd === "audio_analysis/failures") return Promise.resolve(rows);
    if (cmd === "audio_analysis/failures/clear") return Promise.resolve(1);
    return Promise.resolve(undefined);
  });
}

beforeEach(() => {
  mockSendCommand.mockReset();
  mockGetTrack.mockReset();
  mockGetTrack.mockImplementation((itemId: string) =>
    Promise.resolve({ name: `Track ${itemId}`, artists: [{ name: "Artist" }] }),
  );
});

describe("classifyRetry", () => {
  it("returns blocked when next_retry is null (never auto-retries)", () => {
    expect(classifyRetry(null, 1000)).toEqual({ kind: "blocked" });
  });

  it("returns eligible when next_retry is in the past", () => {
    expect(classifyRetry(500, 1000)).toEqual({ kind: "eligible" });
  });

  it("treats next_retry equal to now as eligible", () => {
    expect(classifyRetry(1000, 1000)).toEqual({ kind: "eligible" });
  });

  it("returns scheduled with seconds remaining when next_retry is in the future", () => {
    expect(classifyRetry(4600, 1000)).toEqual({
      kind: "scheduled",
      seconds: 3600,
    });
  });
});

describe("useAudioAnalysisFailures", () => {
  it("fetches all failures (no domain filter) and exposes the total", async () => {
    mockFailures([
      serverFailure({ item_id: "1" }),
      serverFailure({ item_id: "2" }),
    ]);

    const f = useAudioAnalysisFailures();
    expect(f.loading.value).toBe(false);
    const p = f.refresh();
    expect(f.loading.value).toBe(true);
    await p;

    expect(f.loading.value).toBe(false);
    expect(f.total.value).toBe(2);
    expect(mockSendCommand).toHaveBeenCalledWith("audio_analysis/failures");
  });

  it("degrades to an empty list when the failures command is unsupported", async () => {
    mockSendCommand.mockImplementation((cmd: string) => {
      if (cmd === "audio_analysis/failures")
        return Promise.reject(new Error("command not found"));
      return Promise.resolve(undefined);
    });

    const f = useAudioAnalysisFailures();
    await f.refresh();

    expect(f.loading.value).toBe(false);
    expect(f.total.value).toBe(0);
    expect(f.pageRows.value).toEqual([]);
  });

  it("maps server snake_case rows into camelCase fields", async () => {
    mockFailures([
      serverFailure({
        item_id: "42",
        provider: "tidal",
        aa_provider_domain: "sonic_analysis",
        reason: "timeout",
        next_retry: 5000,
        timestamp_created: 1234,
      }),
    ]);

    const f = useAudioAnalysisFailures();
    await f.refresh();

    const row = f.pageRows.value[0];
    expect(row.itemId).toBe("42");
    expect(row.provider).toBe("tidal");
    expect(row.aaDomain).toBe("sonic_analysis");
    expect(row.reason).toBe("timeout");
    expect(row.nextRetry).toBe(5000);
    expect(row.timestampCreated).toBe(1234);
  });

  it("resolves the track name + artist for the current page", async () => {
    mockFailures([serverFailure({ item_id: "1", provider: "tidal" })]);
    mockGetTrack.mockResolvedValueOnce({
      name: "Creep",
      artists: [{ name: "Radiohead" }],
    });

    const f = useAudioAnalysisFailures();
    await f.refresh();

    expect(mockGetTrack).toHaveBeenCalledWith("1", "tidal");
    expect(f.pageRows.value[0].name).toBe("Creep");
    expect(f.pageRows.value[0].artist).toBe("Radiohead");
  });

  it("falls back to the raw item_id when the track lookup fails", async () => {
    mockFailures([
      serverFailure({ item_id: "gone" }),
      serverFailure({ item_id: "ok" }),
    ]);
    mockGetTrack.mockImplementation((itemId: string) => {
      if (itemId === "gone") return Promise.reject(new Error("not found"));
      return Promise.resolve({ name: "Fine", artists: [{ name: "Band" }] });
    });

    const f = useAudioAnalysisFailures();
    await f.refresh();

    const gone = f.pageRows.value.find((r) => r.itemId === "gone")!;
    const ok = f.pageRows.value.find((r) => r.itemId === "ok")!;
    expect(gone.name).toBe("gone");
    expect(gone.artist).toBeNull();
    expect(ok.name).toBe("Fine");
  });

  it("only resolves names for the visible page, not the whole list", async () => {
    mockFailures([
      serverFailure({ item_id: "1" }),
      serverFailure({ item_id: "2" }),
      serverFailure({ item_id: "3" }),
    ]);

    const f = useAudioAnalysisFailures({ pageSize: 2 });
    await f.refresh();

    // page 1 has 2 rows -> only 2 lookups so far
    expect(mockGetTrack).toHaveBeenCalledTimes(2);
    expect(f.pageRows.value).toHaveLength(2);

    await f.next();
    // page 2 has the 3rd row -> one more lookup
    expect(mockGetTrack).toHaveBeenCalledTimes(3);
    expect(f.pageRows.value).toHaveLength(1);
    expect(f.pageRows.value[0].itemId).toBe("3");
  });

  it("computes pagination state and clamps next/prev to bounds", async () => {
    mockFailures([
      serverFailure({ item_id: "1" }),
      serverFailure({ item_id: "2" }),
      serverFailure({ item_id: "3" }),
    ]);

    const f = useAudioAnalysisFailures({ pageSize: 2 });
    await f.refresh();

    expect(f.page.value).toBe(1);
    expect(f.pageCount.value).toBe(2);
    expect(f.hasNextPage.value).toBe(true);

    await f.next();
    expect(f.page.value).toBe(2);
    expect(f.hasNextPage.value).toBe(false);

    await f.next(); // clamp at last page
    expect(f.page.value).toBe(2);

    await f.prev();
    expect(f.page.value).toBe(1);
    await f.prev(); // clamp at first page
    expect(f.page.value).toBe(1);
  });

  it("clearOne deletes the exact row and removes it optimistically", async () => {
    mockFailures([
      serverFailure({ item_id: "1", provider: "tidal" }),
      serverFailure({ item_id: "2", provider: "tidal" }),
    ]);

    const f = useAudioAnalysisFailures();
    await f.refresh();

    const target = f.pageRows.value.find((r) => r.itemId === "1")!;
    const count = await f.clearOne(target);

    expect(count).toBe(1);
    expect(mockSendCommand).toHaveBeenCalledWith(
      "audio_analysis/failures/clear",
      {
        item_id: "1",
        provider: "tidal",
        aa_domain: "sonic_analysis",
      },
    );
    expect(f.total.value).toBe(1);
    expect(f.pageRows.value.map((r) => r.itemId)).toEqual(["2"]);
  });

  it("resolves names independently for the same item_id under different providers", async () => {
    mockFailures([
      serverFailure({ item_id: "1", provider: "tidal" }),
      serverFailure({ item_id: "1", provider: "qobuz" }),
    ]);
    mockGetTrack.mockImplementation((_itemId: string, provider: string) =>
      Promise.resolve({
        name: provider === "tidal" ? "Tidal Track" : "Qobuz Track",
        artists: [],
      }),
    );

    const f = useAudioAnalysisFailures();
    await f.refresh();

    const tidal = f.pageRows.value.find((r) => r.provider === "tidal")!;
    const qobuz = f.pageRows.value.find((r) => r.provider === "qobuz")!;
    expect(tidal.name).toBe("Tidal Track");
    expect(qobuz.name).toBe("Qobuz Track");
  });

  it("does not re-fetch names when paging back to a visited page", async () => {
    mockFailures([
      serverFailure({ item_id: "1" }),
      serverFailure({ item_id: "2" }),
      serverFailure({ item_id: "3" }),
    ]);

    const f = useAudioAnalysisFailures({ pageSize: 2 });
    await f.refresh();
    expect(mockGetTrack).toHaveBeenCalledTimes(2);
    await f.next();
    expect(mockGetTrack).toHaveBeenCalledTimes(3);
    await f.prev();
    // page 1 is already resolved -> no new lookups
    expect(mockGetTrack).toHaveBeenCalledTimes(3);
  });

  it("does not retry a failed name lookup when paging back", async () => {
    mockFailures([
      serverFailure({ item_id: "1" }),
      serverFailure({ item_id: "2" }),
    ]);
    mockGetTrack.mockImplementation((itemId: string) =>
      itemId === "1"
        ? Promise.reject(new Error("not found"))
        : Promise.resolve({ name: "Two", artists: [] }),
    );

    const f = useAudioAnalysisFailures({ pageSize: 1 });
    await f.refresh(); // page 1: item "1" rejects -> negative cache
    await f.next(); // page 2: item "2"
    await f.prev(); // page 1 again: must not retry "1"

    const lookupsForOne = mockGetTrack.mock.calls.filter(
      (c) => c[0] === "1",
    ).length;
    expect(lookupsForOne).toBe(1);
  });

  it("clearOne removes only the targeted row when a track failed under multiple AA domains", async () => {
    mockFailures([
      serverFailure({
        item_id: "1",
        provider: "tidal",
        aa_provider_domain: "sonic_analysis",
      }),
      serverFailure({
        item_id: "1",
        provider: "tidal",
        aa_provider_domain: "loudness",
      }),
    ]);

    const f = useAudioAnalysisFailures();
    await f.refresh();
    expect(f.total.value).toBe(2);

    const target = f.pageRows.value.find(
      (r) => r.aaDomain === "sonic_analysis",
    )!;
    await f.clearOne(target);

    expect(mockSendCommand).toHaveBeenCalledWith(
      "audio_analysis/failures/clear",
      { item_id: "1", provider: "tidal", aa_domain: "sonic_analysis" },
    );
    expect(f.total.value).toBe(1);
    expect(f.pageRows.value.map((r) => r.aaDomain)).toEqual(["loudness"]);
  });

  it("clearOne on the last row of the last page steps back a page", async () => {
    mockFailures([
      serverFailure({ item_id: "1" }),
      serverFailure({ item_id: "2" }),
      serverFailure({ item_id: "3" }),
    ]);

    const f = useAudioAnalysisFailures({ pageSize: 2 });
    await f.refresh();
    await f.next();
    expect(f.page.value).toBe(2);

    await f.clearOne(f.pageRows.value[0]);

    expect(f.page.value).toBe(1);
    expect(f.pageRows.value.map((r) => r.itemId)).toEqual(["1", "2"]);
  });

  it("clearAll re-syncs from the server and throws when a domain clear fails", async () => {
    const rows = [
      serverFailure({ item_id: "1", aa_provider_domain: "sonic_analysis" }),
      serverFailure({ item_id: "2", aa_provider_domain: "loudness" }),
    ];
    mockSendCommand.mockImplementation(
      (cmd: string, args?: { aa_domain?: string }) => {
        if (cmd === "audio_analysis/failures") return Promise.resolve(rows);
        if (cmd === "audio_analysis/failures/clear") {
          return args?.aa_domain === "sonic_analysis"
            ? Promise.reject(new Error("boom"))
            : Promise.resolve(1);
        }
        return Promise.resolve(undefined);
      },
    );

    const f = useAudioAnalysisFailures();
    await f.refresh();
    const fetchesBefore = mockSendCommand.mock.calls.filter(
      (c) => c[0] === "audio_analysis/failures",
    ).length;

    await expect(f.clearAll()).rejects.toThrow();

    // refresh() must still run so the table reflects what was actually cleared.
    const fetchesAfter = mockSendCommand.mock.calls.filter(
      (c) => c[0] === "audio_analysis/failures",
    ).length;
    expect(fetchesAfter).toBe(fetchesBefore + 1);
  });

  it("clearAll deletes once per distinct AA domain and re-syncs from the server", async () => {
    const rows = [
      serverFailure({ item_id: "1", aa_provider_domain: "sonic_analysis" }),
      serverFailure({ item_id: "2", aa_provider_domain: "sonic_analysis" }),
      serverFailure({ item_id: "3", aa_provider_domain: "loudness" }),
    ];
    mockSendCommand.mockImplementation((cmd: string) => {
      if (cmd === "audio_analysis/failures") {
        // After clearAll the server returns an empty list on re-fetch.
        return Promise.resolve(cleared ? [] : rows);
      }
      if (cmd === "audio_analysis/failures/clear") {
        cleared = true;
        return Promise.resolve(1);
      }
      return Promise.resolve(undefined);
    });
    let cleared = false;

    const f = useAudioAnalysisFailures();
    await f.refresh();

    const total = await f.clearAll();

    const clearCalls = mockSendCommand.mock.calls.filter(
      (c) => c[0] === "audio_analysis/failures/clear",
    );
    expect(clearCalls).toHaveLength(2); // two distinct domains
    expect(clearCalls.map((c) => c[1])).toEqual(
      expect.arrayContaining([
        { aa_domain: "sonic_analysis" },
        { aa_domain: "loudness" },
      ]),
    );
    expect(total).toBe(2);
    expect(f.total.value).toBe(0);
  });
});

// Keep the RawFailure import meaningful so the public type is part of the contract.
const _typecheck: RawFailure | undefined = undefined;
void _typecheck;
