import api from "@/plugins/api";
import type {
  AIRadioMode,
  AIRadioSession,
  AIRadioStation,
  AIRadioStatus,
} from "@/plugins/api/interfaces";
import { ref } from "vue";
import { toast } from "vue-sonner";

const stations = ref<AIRadioStation[]>([]);
const sessions = ref<AIRadioSession[]>([]);
const loadingStations = ref(false);
const loadingStatus = ref(false);
const startingRun = ref(false);
const stoppingRun = ref(false);

const sortByName = (items: AIRadioStation[]) => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

const sortSessions = (items: AIRadioSession[]) => {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

async function loadStations(silent = false): Promise<AIRadioStation[]> {
  loadingStations.value = true;
  try {
    const result = await api.sendCommand<AIRadioStation[]>("ai_radio/stations/list");
    stations.value = sortByName(result);
    if (!silent) {
      toast.success("AI Radio stations loaded");
    }
    return stations.value;
  } catch (error) {
    if (!silent) {
      toast.error("Failed to load AI Radio stations");
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
      toast.success("AI Radio status refreshed");
    }
    return sessions.value;
  } catch (error) {
    if (!silent) {
      toast.error("Failed to load AI Radio status");
    }
    throw error;
  } finally {
    loadingStatus.value = false;
  }
}

async function startRun(
  stationId: string,
  mode: AIRadioMode,
  playerIdOverride?: string,
): Promise<AIRadioSession> {
  startingRun.value = true;
  try {
    const args: Record<string, unknown> = {
      station_id: stationId,
      mode,
    };
    if (playerIdOverride && mode === "dynamic") {
      args.player_id_override = playerIdOverride;
    }
    const result = await api.sendCommand<AIRadioSession>("ai_radio/start", args);
    toast.success(
      mode === "playlist" ? "Playlist generation started" : "Live radio started",
    );
    await loadStatus(true);
    return result;
  } catch (error) {
    toast.error(
      mode === "playlist"
        ? "Failed to start playlist generation"
        : "Failed to start live radio",
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
    toast.success("AI Radio session stopped");
    await loadStatus(true);
  } catch (error) {
    toast.error("Failed to stop AI Radio session");
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
