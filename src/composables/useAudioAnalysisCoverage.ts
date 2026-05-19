import { api } from "@/plugins/api";
import {
  ProviderType,
  TaskStatus,
  type BackgroundTask,
} from "@/plugins/api/interfaces";
import { ref, type Ref } from "vue";

export const BACKGROUND_SCAN_TASK_ID = "audio_analysis_background_scan";

export interface CoverageResponse {
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
  error: boolean;
}

export interface ScanStatus {
  status: TaskStatus;
  lastRun?: string;
  nextRun?: string;
  failureCount: number;
  unavailable: boolean;
}

export function useAudioAnalysisCoverage(): {
  rows: Ref<ProviderCoverageRow[]>;
  scan: Ref<ScanStatus>;
  loading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const rows = ref<ProviderCoverageRow[]>([]);
  const scan = ref<ScanStatus>({
    status: TaskStatus.UNKNOWN,
    failureCount: 0,
    unavailable: false,
  });
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

  function emptyRow(
    meta: {
      domain: string;
      name: string;
      instanceId: string;
      available: boolean;
    },
    error = false,
  ): ProviderCoverageRow {
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
      error,
    };
  }

  async function fetchCoverage(): Promise<void> {
    const providers = discover();
    const results = await Promise.allSettled(
      providers.map(async (meta) => {
        if (!meta.available) return emptyRow(meta);
        try {
          const cov = await api.sendCommand<CoverageResponse>(
            "audio_analysis/coverage",
            { aa_domain: meta.domain },
          );
          const total = cov.analyzed + cov.pending;
          return {
            ...emptyRow(meta),
            analyzed: cov.analyzed,
            pending: cov.pending,
            staleVersion: cov.stale_version,
            analysisVersion: cov.analysis_version,
            coveragePct:
              total > 0 ? Math.round((cov.analyzed / total) * 100) : 0,
            hasData: total > 0,
          } satisfies ProviderCoverageRow;
        } catch {
          return emptyRow(meta, true);
        }
      }),
    );
    rows.value = results.map((r, i) =>
      r.status === "fulfilled" ? r.value : emptyRow(providers[i], true),
    );
  }

  async function fetchScan(): Promise<void> {
    try {
      const task = await api.sendCommand<BackgroundTask>("tasks/get", {
        task_id: BACKGROUND_SCAN_TASK_ID,
      });
      scan.value = {
        status: task.status,
        lastRun: task.last_run,
        nextRun: task.next_run,
        failureCount: task.failure_count ?? 0,
        unavailable: false,
      };
    } catch {
      scan.value = {
        status: TaskStatus.UNKNOWN,
        failureCount: 0,
        unavailable: true,
      };
    }
  }

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      await Promise.all([fetchCoverage(), fetchScan()]);
    } finally {
      loading.value = false;
    }
  }

  return { rows, scan, loading, refresh };
}
