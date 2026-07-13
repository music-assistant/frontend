import { api } from "@/plugins/api";
import { ProviderType } from "@/plugins/api/interfaces";
import { ref, type Ref } from "vue";

/**
 * Mirrors music_assistant_models.audio_analysis.AudioAnalysisCoverage —
 * the response payload of the server's `audio_analysis/coverage` command.
 */
export interface AudioAnalysisCoverage {
  analyzed: number;
  pending: number;
  stale_version: number;
  analysis_version: number;
}

export interface ProviderCoverageRow {
  domain: string;
  name: string;
  instanceId: string;
  available: boolean;
  analyzed: number;
  pending: number;
  staleVersion: number;
  analysisVersion: number;
  coveragePct: number;
  hasData: boolean;
}

export function useAudioAnalysisCoverage(): {
  rows: Ref<ProviderCoverageRow[]>;
  loading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const rows = ref<ProviderCoverageRow[]>([]);
  const loading = ref(false);

  function discover() {
    return Object.values(api.providers)
      .filter((p) => p.type === ProviderType.AUDIO_ANALYSIS)
      .map((p) => ({
        domain: p.domain,
        name: p.name,
        instanceId: p.instance_id,
        available: p.available,
      }));
  }

  function emptyRow(meta: {
    domain: string;
    name: string;
    instanceId: string;
    available: boolean;
  }): ProviderCoverageRow {
    return {
      domain: meta.domain,
      name: meta.name,
      instanceId: meta.instanceId,
      available: meta.available,
      analyzed: 0,
      pending: 0,
      staleVersion: 0,
      analysisVersion: 0,
      coveragePct: 0,
      hasData: false,
    };
  }

  async function fetchCoverage(): Promise<void> {
    const providers = discover();
    const results = await Promise.allSettled(
      providers.map(async (meta) => {
        if (!meta.available) return emptyRow(meta);
        // audio_analysis/coverage raises ProviderUnavailableError when the
        // provider isn't loaded; rejection here authoritatively overrides
        // an optimistic api.providers flag.
        try {
          const cov = await api.sendCommand<AudioAnalysisCoverage>(
            "audio_analysis/coverage",
            { aa_domain: meta.domain },
          );
          const total = cov.analyzed + cov.pending;
          return {
            ...emptyRow(meta),
            available: true,
            analyzed: cov.analyzed,
            pending: cov.pending,
            staleVersion: cov.stale_version,
            analysisVersion: cov.analysis_version,
            coveragePct:
              total > 0 ? Math.round((cov.analyzed / total) * 100) : 0,
            hasData: total > 0,
          } satisfies ProviderCoverageRow;
        } catch {
          return { ...emptyRow(meta), available: false };
        }
      }),
    );
    rows.value = results.map((r, i) =>
      r.status === "fulfilled" ? r.value : emptyRow(providers[i]),
    );
  }

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      await fetchCoverage();
    } finally {
      loading.value = false;
    }
  }

  return { rows, loading, refresh };
}
