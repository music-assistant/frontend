import api from "@/plugins/api";
import type {
  AIRadioMode,
  AIRadioSession,
  AIRadioStatus,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";

const sessions = ref<AIRadioSession[]>([]);
const loadingStatus = ref(false);
const startingRun = ref(false);
// Session id currently being stopped, so only that session's button reflects it.
const stoppingSessionId = ref("");

interface StartRunOptions {
  playerIdOverride?: string;
  sourcePlaylistIdOverride?: string;
  sourcePlaylistProviderOverride?: string;
  dynamicSourcePlaytimeCapOverride?: number;
  dynamicBatchSizeOverride?: number;
}

const sortSessions = (items: AIRadioSession[]) => {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

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
    await loadStatus();
    return result;
  } finally {
    startingRun.value = false;
  }
}

async function stopRun(sessionId: string): Promise<void> {
  stoppingSessionId.value = sessionId;
  try {
    await api.sendCommand("ai_radio/stop", { session_id: sessionId });
    toast.success($t("providers.ai_radio.toast.session_stopped"));
    await loadStatus();
  } finally {
    stoppingSessionId.value = "";
  }
}

export function useAiRadio() {
  return {
    sessions,
    loadingStatus,
    startingRun,
    stoppingSessionId,
    loadStatus,
    startRun,
    stopRun,
  };
}
