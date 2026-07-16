import api from "@/plugins/api";
import type {
  AIRadioMode,
  AIRadioSection,
  AIRadioSession,
  AIRadioStation,
  AIRadioStatus,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";

const STATUS_POLL_INTERVAL_MS = 5000;

const shows = ref<AIRadioStation[]>([]);
const sections = ref<AIRadioSection[]>([]);
const sessions = ref<AIRadioSession[]>([]);

const loadingShows = ref(false);
const loadingSections = ref(false);
const loadingStatus = ref(false);
const savingShow = ref(false);
// Station id currently being deleted/started, so only that card reflects it.
const deletingShowId = ref("");
const startingShowId = ref("");
const stoppingSessionId = ref("");

let statusPollTimer: ReturnType<typeof setInterval> | null = null;

interface StartShowOptions {
  playerIdOverride?: string;
  sourcePlaylistIdOverride?: string;
  sourcePlaylistProviderOverride?: string;
  dynamicSourcePlaytimeCapOverride?: number;
  dynamicBatchSizeOverride?: number;
}

const sortByName = <T extends { name: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

const sortSessions = (items: AIRadioSession[]): AIRadioSession[] => {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

async function loadShows(): Promise<AIRadioStation[]> {
  loadingShows.value = true;
  try {
    const result = await api.sendCommand<AIRadioStation[]>(
      "ai_radio/stations/list",
    );
    shows.value = sortByName(result || []);
    return shows.value;
  } finally {
    loadingShows.value = false;
  }
}

async function loadSections(): Promise<AIRadioSection[]> {
  loadingSections.value = true;
  try {
    const result = await api.sendCommand<AIRadioSection[]>(
      "ai_radio/sections/list",
    );
    sections.value = sortByName(result || []);
    return sections.value;
  } finally {
    loadingSections.value = false;
  }
}

async function getShow(stationId: string): Promise<AIRadioStation> {
  return api.sendCommand<AIRadioStation>("ai_radio/stations/get", {
    station_id: stationId,
  });
}

async function saveShow(station: AIRadioStation): Promise<AIRadioStation> {
  savingShow.value = true;
  try {
    const saved = await api.sendCommand<AIRadioStation>(
      "ai_radio/stations/save",
      { station },
    );
    toast.success($t("providers.ai_radio.toast.station_saved"));
    await loadShows();
    return saved;
  } finally {
    savingShow.value = false;
  }
}

async function deleteShow(stationId: string): Promise<void> {
  deletingShowId.value = stationId;
  try {
    await api.sendCommand("ai_radio/stations/delete", {
      station_id: stationId,
    });
    toast.success($t("providers.ai_radio.toast.station_deleted"));
    await loadShows();
  } finally {
    deletingShowId.value = "";
  }
}

async function loadStatus(): Promise<AIRadioSession[]> {
  loadingStatus.value = true;
  try {
    const result = await api.sendCommand<AIRadioStatus>("ai_radio/status");
    sessions.value = sortSessions(result.sessions || []);
    return sessions.value;
  } finally {
    loadingStatus.value = false;
  }
}

async function startShow(
  stationId: string,
  mode: AIRadioMode,
  overrides?: StartShowOptions,
): Promise<AIRadioSession> {
  startingShowId.value = stationId;
  try {
    const args: Record<string, unknown> = {
      station_id: stationId,
      mode,
    };
    if (overrides?.playerIdOverride && mode === "dynamic") {
      args.player_id_override = overrides.playerIdOverride;
    }
    if (overrides?.sourcePlaylistIdOverride) {
      args.source_playlist_id_override = overrides.sourcePlaylistIdOverride;
    }
    if (overrides?.sourcePlaylistProviderOverride) {
      args.source_playlist_provider_override =
        overrides.sourcePlaylistProviderOverride;
    }
    if (typeof overrides?.dynamicSourcePlaytimeCapOverride === "number") {
      args.dynamic_source_playtime_cap_override =
        overrides.dynamicSourcePlaytimeCapOverride;
    }
    if (typeof overrides?.dynamicBatchSizeOverride === "number") {
      args.dynamic_batch_size_override = overrides.dynamicBatchSizeOverride;
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
    await loadStatus();
    return result;
  } finally {
    startingShowId.value = "";
  }
}

async function stopShow(sessionId: string): Promise<void> {
  stoppingSessionId.value = sessionId;
  try {
    await api.sendCommand("ai_radio/stop", { session_id: sessionId });
    toast.success($t("providers.ai_radio.toast.session_stopped"));
    await loadStatus();
  } finally {
    stoppingSessionId.value = "";
  }
}

/** The running session for a station, if any (drives a show card's "On air" state). */
function runningSessionForStation(
  stationId: string,
): AIRadioSession | undefined {
  return sessions.value.find(
    (session) =>
      session.station_id === stationId && session.status === "running",
  );
}

/** Starts 5s status polling; the view calls this on mount/activation. */
function startStatusPolling(): void {
  if (statusPollTimer) return;
  void loadStatus();
  statusPollTimer = setInterval(() => {
    void loadStatus();
  }, STATUS_POLL_INTERVAL_MS);
}

/** Stops status polling; the view calls this on unmount/deactivation. */
function stopStatusPolling(): void {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

export function useShows() {
  return {
    shows,
    sections,
    sessions,
    loadingShows,
    loadingSections,
    loadingStatus,
    savingShow,
    deletingShowId,
    startingShowId,
    stoppingSessionId,
    loadShows,
    loadSections,
    getShow,
    saveShow,
    deleteShow,
    loadStatus,
    startShow,
    stopShow,
    runningSessionForStation,
    startStatusPolling,
    stopStatusPolling,
  };
}
