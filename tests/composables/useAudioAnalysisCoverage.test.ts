import { ProviderType } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand, providersMock } = vi.hoisted(() => {
  return {
    mockSendCommand: vi.fn(),
    providersMock: {} as Record<string, unknown>,
  };
});

vi.mock("@/plugins/api", () => {
  return {
    api: {
      get providers() {
        return providersMock;
      },
      sendCommand: mockSendCommand,
    },
  };
});

import { useAudioAnalysisCoverage } from "@/composables/useAudioAnalysisCoverage";

function setProviders(list: Array<Record<string, unknown>>) {
  for (const k of Object.keys(providersMock)) delete providersMock[k];
  for (const p of list) providersMock[p.instance_id as string] = p;
}

/**
 * Mock the single-call coverage flow: the server's `audio_analysis/coverage`
 * is the only endpoint we hit. It raises ProviderUnavailableError when the
 * provider isn't loaded — modeled here as `"reject"`.
 */
function mockAa(
  byDomain: Record<
    string,
    | {
        analyzed: number;
        pending: number;
        stale_version: number;
        analysis_version: number;
      }
    | "reject"
  >,
) {
  mockSendCommand.mockImplementation(
    (cmd: string, args: { aa_domain?: string }) => {
      if (cmd !== "audio_analysis/coverage") return Promise.resolve({});
      const entry = args.aa_domain ? byDomain[args.aa_domain] : undefined;
      if (!entry || entry === "reject")
        return Promise.reject(new Error("provider unavailable"));
      return Promise.resolve(entry);
    },
  );
}

describe("useAudioAnalysisCoverage", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    setProviders([]);
  });

  it("calls /coverage per AA provider; reads version from the response", async () => {
    setProviders([
      {
        type: ProviderType.AUDIO_ANALYSIS,
        domain: "sonic_analysis",
        name: "Sonic Analysis",
        instance_id: "sa1",
        available: true,
      },
      {
        type: ProviderType.MUSIC,
        domain: "spotify",
        name: "Spotify",
        instance_id: "sp1",
        available: true,
      },
    ]);
    mockAa({
      sonic_analysis: {
        analyzed: 78,
        pending: 22,
        stale_version: 3,
        analysis_version: 5,
      },
    });

    const c = useAudioAnalysisCoverage();
    expect(c.loading.value).toBe(false);
    const p = c.refresh();
    expect(c.loading.value).toBe(true);
    await p;
    expect(c.loading.value).toBe(false);

    expect(c.rows.value).toHaveLength(1);
    const row = c.rows.value[0];
    expect(row.domain).toBe("sonic_analysis");
    expect(row.name).toBe("Sonic Analysis");
    expect(row.available).toBe(true);
    expect(row.analyzed).toBe(78);
    expect(row.pending).toBe(22);
    expect(row.staleVersion).toBe(3);
    expect(row.analysisVersion).toBe(5);
    expect(row.coveragePct).toBe(78);
    expect(mockSendCommand).toHaveBeenCalledWith("audio_analysis/coverage", {
      aa_domain: "sonic_analysis",
    });
    // Only one call per AA provider — no /status probe.
    expect(mockSendCommand).toHaveBeenCalledTimes(1);
  });

  it("guards divide-by-zero (0 analyzed, 0 pending) -> 0 pct, hasData false", async () => {
    setProviders([
      {
        type: ProviderType.AUDIO_ANALYSIS,
        domain: "loudness",
        name: "Loudness",
        instance_id: "l1",
        available: true,
      },
    ]);
    mockAa({
      loudness: {
        analyzed: 0,
        pending: 0,
        stale_version: 0,
        analysis_version: 1,
      },
    });

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    expect(c.rows.value[0].coveragePct).toBe(0);
    expect(c.rows.value[0].hasData).toBe(false);
  });

  it("skips providers unavailable in api.providers: no /coverage call", async () => {
    setProviders([
      {
        type: ProviderType.AUDIO_ANALYSIS,
        domain: "sonic_analysis",
        name: "Sonic Analysis",
        instance_id: "sa1",
        available: false,
      },
    ]);

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    expect(mockSendCommand).not.toHaveBeenCalled();
    expect(c.rows.value[0].available).toBe(false);
    expect(c.rows.value[0].hasData).toBe(false);
  });

  it("/coverage rejecting overrides an optimistic api.providers flag: unavailable row", async () => {
    setProviders([
      {
        type: ProviderType.AUDIO_ANALYSIS,
        domain: "sonic_analysis",
        name: "Sonic Analysis",
        instance_id: "sa1",
        available: true,
      },
    ]);
    mockAa({ sonic_analysis: "reject" });

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    const row = c.rows.value[0];
    expect(row.available).toBe(false);
    expect(row.hasData).toBe(false);
  });

  it("one provider failing does not drop the others", async () => {
    setProviders([
      {
        type: ProviderType.AUDIO_ANALYSIS,
        domain: "bad",
        name: "Bad",
        instance_id: "b1",
        available: true,
      },
      {
        type: ProviderType.AUDIO_ANALYSIS,
        domain: "good",
        name: "Good",
        instance_id: "g1",
        available: true,
      },
    ]);
    mockAa({
      bad: "reject",
      good: {
        analyzed: 10,
        pending: 0,
        stale_version: 0,
        analysis_version: 1,
      },
    });

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    const bad = c.rows.value.find((r) => r.domain === "bad")!;
    const good = c.rows.value.find((r) => r.domain === "good")!;
    expect(bad.available).toBe(false);
    expect(bad.hasData).toBe(false);
    expect(good.hasData).toBe(true);
    expect(good.coveragePct).toBe(100);
  });
});

/** Force `document.hidden` / `visibilityState` and fire the change event. */
function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const AA_PROVIDER = {
  type: ProviderType.AUDIO_ANALYSIS,
  domain: "sonic_analysis",
  name: "Sonic Analysis",
  instance_id: "sa1",
  available: true,
} as const;

const POLL_MS = 5000;

describe("useAudioAnalysisCoverage auto-refresh", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    setProviders([]);
    setTabHidden(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-queries coverage every interval while pending > 0", async () => {
    setProviders([AA_PROVIDER]);
    mockAa({
      sonic_analysis: {
        analyzed: 50,
        pending: 50,
        stale_version: 0,
        analysis_version: 1,
      },
    });

    const c = useAudioAnalysisCoverage({ intervalMs: POLL_MS });
    await c.startAutoRefresh();
    expect(mockSendCommand).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mockSendCommand).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mockSendCommand).toHaveBeenCalledTimes(3);

    c.stopAutoRefresh();
  });

  it("stops polling once every provider reaches pending 0", async () => {
    setProviders([AA_PROVIDER]);
    // First poll still has pending work; second poll reports fully analyzed.
    mockSendCommand
      .mockResolvedValueOnce({
        analyzed: 90,
        pending: 10,
        stale_version: 0,
        analysis_version: 1,
      })
      .mockResolvedValue({
        analyzed: 100,
        pending: 0,
        stale_version: 0,
        analysis_version: 1,
      });

    const c = useAudioAnalysisCoverage({ intervalMs: POLL_MS });
    await c.startAutoRefresh(); // call 1: pending 10 -> keep polling
    expect(mockSendCommand).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_MS); // call 2: pending 0 -> go dormant
    expect(mockSendCommand).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(POLL_MS * 3); // no further polls
    expect(mockSendCommand).toHaveBeenCalledTimes(2);

    c.stopAutoRefresh();
  });

  it("pauses polling while the tab is hidden and resumes when visible", async () => {
    setProviders([AA_PROVIDER]);
    mockAa({
      sonic_analysis: {
        analyzed: 50,
        pending: 50,
        stale_version: 0,
        analysis_version: 1,
      },
    });

    const c = useAudioAnalysisCoverage({ intervalMs: POLL_MS });
    await c.startAutoRefresh();
    expect(mockSendCommand).toHaveBeenCalledTimes(1);

    setTabHidden(true);
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(mockSendCommand).toHaveBeenCalledTimes(1); // no polling while hidden

    setTabHidden(false); // becoming visible refreshes immediately
    await Promise.resolve();
    expect(mockSendCommand).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mockSendCommand).toHaveBeenCalledTimes(3);

    c.stopAutoRefresh();
  });

  it("resumes polling when a refresh surfaces new pending work after going dormant", async () => {
    setProviders([AA_PROVIDER]);
    // Starts fully analyzed -> the loop goes dormant after the first load.
    mockSendCommand
      .mockResolvedValueOnce({
        analyzed: 100,
        pending: 0,
        stale_version: 0,
        analysis_version: 1,
      })
      .mockResolvedValue({
        analyzed: 100,
        pending: 20,
        stale_version: 0,
        analysis_version: 1,
      });

    const c = useAudioAnalysisCoverage({ intervalMs: POLL_MS });
    await c.startAutoRefresh(); // call 1: pending 0 -> dormant
    expect(mockSendCommand).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    expect(mockSendCommand).toHaveBeenCalledTimes(1); // confirmed dormant

    // New pending work appears; the component's providers watch calls refresh().
    await c.refresh(); // call 2: pending 20 -> should re-arm polling
    expect(mockSendCommand).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mockSendCommand).toHaveBeenCalledTimes(3); // polling resumed

    c.stopAutoRefresh();
  });

  it("stopAutoRefresh halts polling and detaches the visibility listener", async () => {
    setProviders([AA_PROVIDER]);
    mockAa({
      sonic_analysis: {
        analyzed: 50,
        pending: 50,
        stale_version: 0,
        analysis_version: 1,
      },
    });

    const c = useAudioAnalysisCoverage({ intervalMs: POLL_MS });
    await c.startAutoRefresh();
    expect(mockSendCommand).toHaveBeenCalledTimes(1);

    c.stopAutoRefresh();

    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(mockSendCommand).toHaveBeenCalledTimes(1); // timer cleared

    setTabHidden(false); // listener detached -> no resume refresh
    await Promise.resolve();
    expect(mockSendCommand).toHaveBeenCalledTimes(1);
  });
});
