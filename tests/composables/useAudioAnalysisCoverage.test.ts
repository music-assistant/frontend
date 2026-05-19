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

import { useAudioAnalysisCoverage } from "@/composables/useAudioAnalysisCoverage";

function setProviders(list: Array<Record<string, unknown>>) {
  for (const k of Object.keys(providersMock)) delete providersMock[k];
  for (const p of list) providersMock[p.instance_id as string] = p;
}

describe("useAudioAnalysisCoverage - coverage", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    setProviders([]);
  });

  it("discovers only AUDIO_ANALYSIS providers and derives coverage %", async () => {
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
    mockSendCommand.mockResolvedValueOnce({
      analyzed: 78,
      pending: 22,
      stale_version: 3,
      analysis_version: 2,
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
    expect(row.analysisVersion).toBe(2);
    expect(row.coveragePct).toBe(78);
    expect(mockSendCommand).toHaveBeenCalledWith("audio_analysis/coverage", {
      aa_domain: "sonic_analysis",
    });
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
    mockSendCommand.mockResolvedValueOnce({
      analyzed: 0,
      pending: 0,
      stale_version: 0,
      analysis_version: 1,
    });

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    expect(c.rows.value[0].coveragePct).toBe(0);
    expect(c.rows.value[0].hasData).toBe(false);
  });

  it("skips unavailable providers: no coverage call, row marked unavailable", async () => {
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

    expect(mockSendCommand).not.toHaveBeenCalledWith(
      "audio_analysis/coverage",
      { aa_domain: "sonic_analysis" },
    );
    expect(c.rows.value[0].available).toBe(false);
    expect(c.rows.value[0].hasData).toBe(false);
  });

  it("isolates a failed coverage call: other rows still resolve", async () => {
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
    mockSendCommand.mockImplementation(
      (_cmd: string, args: { aa_domain: string }) => {
        if (args.aa_domain === "bad")
          return Promise.reject(new Error("unavailable"));
        return Promise.resolve({
          analyzed: 10,
          pending: 0,
          stale_version: 0,
          analysis_version: 1,
        });
      },
    );

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    const bad = c.rows.value.find((r) => r.domain === "bad")!;
    const good = c.rows.value.find((r) => r.domain === "good")!;
    expect(bad.hasData).toBe(false);
    expect(bad.error).toBe(true);
    expect(good.hasData).toBe(true);
    expect(good.coveragePct).toBe(100);
  });
});

describe("useAudioAnalysisCoverage - scan", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    setProviders([]);
  });

  it("normalizes scan status; failure_count only surfaced when > 0", async () => {
    mockSendCommand.mockImplementation((cmd: string) => {
      if (cmd === "tasks/get")
        return Promise.resolve({
          status: "idle",
          last_run: "2026-05-18T10:00:00Z",
          next_run: "2026-05-18T14:00:00Z",
          failure_count: 0,
        });
      return Promise.resolve({});
    });

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    expect(mockSendCommand).toHaveBeenCalledWith("tasks/get", {
      task_id: "audio_analysis_background_scan",
    });
    expect(c.scan.value).toEqual({
      status: "idle",
      lastRun: "2026-05-18T10:00:00Z",
      nextRun: "2026-05-18T14:00:00Z",
      failureCount: 0,
      unavailable: false,
    });
  });

  it("marks scan unavailable when tasks/get rejects (table still usable)", async () => {
    mockSendCommand.mockImplementation((cmd: string) => {
      if (cmd === "tasks/get") return Promise.reject(new Error("nope"));
      return Promise.resolve({});
    });

    const c = useAudioAnalysisCoverage();
    await c.refresh();

    expect(c.scan.value.unavailable).toBe(true);
  });
});
