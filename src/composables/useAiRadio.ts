import api from "@/plugins/api";
import type {
  AIRadioMode,
  AIRadioSession,
  AIRadioStation,
  AIRadioStatus,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";

const stations = ref<AIRadioStation[]>([]);
const sessions = ref<AIRadioSession[]>([]);
const loadingStations = ref(false);
const loadingStatus = ref(false);
const startingRun = ref(false);
const stoppingRun = ref(false);

interface StartRunOptions {
  playerIdOverride?: string;
  sourcePlaylistIdOverride?: string;
  sourcePlaylistProviderOverride?: string;
  dynamicSourcePlaytimeCapOverride?: number;
  dynamicBatchSizeOverride?: number;
}

const sortByName = (items: AIRadioStation[]) => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

const sortSessions = (items: AIRadioSession[]) => {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

async function loadStations(silent = false): Promise<AIRadioStation[]> {
  loadingStations.value = true;
  try {
    const result = await api.sendCommand<AIRadioStation[]>(
      "ai_radio/stations/list",
    );
    stations.value = sortByName(result);
    if (!silent) {
      toast.success($t("providers.ai_radio.toast.stations_loaded"));
    }
    return stations.value;
  } catch (error) {
    if (!silent) {
      toast.error($t("providers.ai_radio.toast.stations_load_failed"));
    }
    throw error;
  } finally {
    loadingStations.value = false;
  }
}

async function loadStatus(silent = false): Promise<AIRadioSession[]> {
  loadingStatus.value = true;
  try {
    const result = await api.sendCommand<AIRadioStatus>("ai_radio/status");
    sessions.value = sortSessions(result.sessions || []);
    if (!silent) {
      toast.success($t("providers.ai_radio.toast.status_refreshed"));
    }
    return sessions.value;
  } catch (error) {
    if (!silent) {
      toast.error($t("providers.ai_radio.toast.status_load_failed"));
    }
    throw error;
  } finally {
    loadingStatus.value = false;
  }
}

async function startRun(
  stationId: string,
  mode: AIRadioMode,
  options?: StartRunOptions,
): Promise<AIRadioSession> {
  startingRun.value = true;
  try {
    const args: Record<string, unknown> = {
      station_id: stationId,
      mode,
    };
    if (options?.playerIdOverride && mode === "dynamic") {
      args.player_id_override = options.playerIdOverride;
    }
    if (options?.sourcePlaylistIdOverride) {
      args.source_playlist_id_override = options.sourcePlaylistIdOverride;
    }
    if (options?.sourcePlaylistProviderOverride) {
      args.source_playlist_provider_override =
        options.sourcePlaylistProviderOverride;
    }
    if (typeof options?.dynamicSourcePlaytimeCapOverride === "number") {
      args.dynamic_source_playtime_cap_override =
        options.dynamicSourcePlaytimeCapOverride;
    }
    if (typeof options?.dynamicBatchSizeOverride === "number") {
      args.dynamic_batch_size_override = options.dynamicBatchSizeOverride;
    }
    const result = await api.sendCommand<AIRadioSession>(
      "ai_radio/start",
      args,
    );
    toast.success(
      mode === "playlist"
        ? $t("providers.ai_radio.toast.playlist_starting")
        : $t("providers.ai_radio.toast.live_starting"),
    );
    await loadStatus(true);
    return result;
  } catch (error) {
    toast.error(
      mode === "playlist"
        ? $t("providers.ai_radio.toast.playlist_start_failed")
        : $t("providers.ai_radio.toast.live_start_failed"),
    );
    throw error;
  } finally {
    startingRun.value = false;
  }
}

async function stopRun(sessionId: string): Promise<void> {
  stoppingRun.value = true;
  try {
    await api.sendCommand("ai_radio/stop", { session_id: sessionId });
    toast.success($t("providers.ai_radio.toast.session_stopped"));
    await loadStatus(true);
  } catch (error) {
    toast.error($t("providers.ai_radio.toast.session_stop_failed"));
    throw error;
  } finally {
    stoppingRun.value = false;
  }
}

async function refreshAll(silent = false): Promise<void> {
  await Promise.all([loadStations(silent), loadStatus(silent)]);
}

export function useAiRadio() {
  return {
    stations,
    sessions,
    loadingStations,
    loadingStatus,
    startingRun,
    stoppingRun,
    loadStations,
    loadStatus,
    startRun,
    stopRun,
    refreshAll,
  };
}
