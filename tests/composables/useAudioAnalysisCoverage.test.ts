import { ProviderType } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { useAudioAnalysisCoverage } from "@/composables/audio-analysis/useAudioAnalysisCoverage";

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
