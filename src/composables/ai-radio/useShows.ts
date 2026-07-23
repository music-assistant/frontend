import api from "@/plugins/api";
import type {
  AIRadioMode,
  AIRadioSection,
  AIRadioSession,
  AIRadioStation,
  AIRadioStatus,
  Playlist,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";

const STATUS_POLL_ACTIVE_MS = 5000;
const STATUS_POLL_IDLE_MS = 30000;
const PLAYLIST_PAGE_SIZE = 200;
const PLAYLIST_FETCH_LIMIT = 5000;
const NO_AI_PROVIDER_MARKER = /no ai provider/i;

const shows = ref<AIRadioStation[]>([]);
const sections = ref<AIRadioSection[]>([]);
const sessions = ref<AIRadioSession[]>([]);
const playlists = ref<Playlist[]>([]);

const loadingShows = ref(false);
const loadingSections = ref(false);
const loadingStatus = ref(false);
const loadingPlaylists = ref(false);
const savingShow = ref(false);
// Station id currently being deleted/started, so only that card reflects it.
const deletingShowId = ref("");
const startingShowId = ref("");
const stoppingSessionId = ref("");

// Set when a start attempt fails with a "No AI provider" error; drives the
// gallery's persistent prereq banner (a toast alone isn't enough there).
const noAiProviderAlert = ref(false);
// Dynamic-mode runs fail asynchronously (the session starts fine and errors
// during generation), so failed sessions must raise the banner too.
const seenFailedSessionIds = new Set<string>();
let statusLoadedOnce = false;

let statusPollTimer: ReturnType<typeof setTimeout> | null = null;
let statusPollingEnabled = false;

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

async function loadPlaylists(): Promise<Playlist[]> {
  loadingPlaylists.value = true;
  try {
    // Load in pages to avoid truncating larger libraries.
    let offset = 0;
    let hasMore = true;
    const allItems: Playlist[] = [];
    while (hasMore && offset < PLAYLIST_FETCH_LIMIT) {
      const batch = await api.getLibraryPlaylists(
        undefined,
        undefined,
        PLAYLIST_PAGE_SIZE,
        offset,
      );
      allItems.push(...batch);
      hasMore = batch.length === PLAYLIST_PAGE_SIZE;
      offset += PLAYLIST_PAGE_SIZE;
    }
    if (hasMore) {
      toast.warning(
        $t("providers.ai_radio.toast.playlists_truncated", [
          PLAYLIST_FETCH_LIMIT,
        ]),
      );
    }
    playlists.value = sortByName(allItems);
    return playlists.value;
  } finally {
    loadingPlaylists.value = false;
  }
}

/** Finds a loaded library playlist by provider+id, for artwork/name resolution on cards. */
function playlistFor(provider: string, itemId: string): Playlist | undefined {
  return playlists.value.find(
    (playlist) => playlist.provider === provider && playlist.item_id === itemId,
  );
}

async function getShow(stationId: string): Promise<AIRadioStation> {
  return api.sendCommand<AIRadioStation>("ai_radio/stations/get", {
    station_id: stationId,
  });
}

async function saveShow(
  station: AIRadioStation,
  successMessage?: string,
): Promise<AIRadioStation> {
  savingShow.value = true;
  try {
    const saved = await api.sendCommand<AIRadioStation>(
      "ai_radio/stations/save",
      { station },
    );
    toast.success(
      successMessage || $t("providers.ai_radio.toast.station_saved"),
    );
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
    for (const session of sessions.value) {
      if (
        session.status !== "failed" ||
        seenFailedSessionIds.has(session.session_id)
      ) {
        continue;
      }
      seenFailedSessionIds.add(session.session_id);
      if (statusLoadedOnce) {
        toast.error(
          $t("providers.ai_radio.toast.session_failed", [
            session.error || $t("providers.ai_radio.card.session_failed"),
          ]),
        );
      }
      reportStartError(session.error || "");
    }
    statusLoadedOnce = true;
    return sessions.value;
  } finally {
    loadingStatus.value = false;
    rescheduleStatusPoll();
  }
}

async function startShow(
  stationId: string,
  mode: AIRadioMode,
  overrides?: StartShowOptions,
): Promise<AIRadioSession> {
  startingShowId.value = stationId;
  dismissNoAiProviderAlert();
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
    const updated = await loadStatus();
    const current = updated.find(
      (item) => item.session_id === result.session_id,
    );
    if (current?.status !== "failed") {
      toast.success(
        mode === "playlist"
          ? $t("providers.ai_radio.toast.playlist_starting")
          : $t("providers.ai_radio.toast.live_starting"),
      );
    }
    return current || result;
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
  } catch (error) {
    await loadStatus().catch(() => undefined);
    throw error;
  } finally {
    stoppingSessionId.value = "";
  }
}

/** Flags the prereq banner when a start attempt's error indicates no AI provider is configured. */
function reportStartError(message: string): void {
  if (NO_AI_PROVIDER_MARKER.test(message)) {
    noAiProviderAlert.value = true;
  }
}

function dismissNoAiProviderAlert(): void {
  noAiProviderAlert.value = false;
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

function hasActiveSession(): boolean {
  return sessions.value.some((session) => session.status === "running");
}

function clearStatusPollTimer(): void {
  if (statusPollTimer) {
    clearTimeout(statusPollTimer);
    statusPollTimer = null;
  }
}

/**
 * (Re)arms the poll timer: 5s while a session is running, 30s when idle,
 * suspended entirely while the browser tab is hidden.
 */
function rescheduleStatusPoll(): void {
  clearStatusPollTimer();
  if (!statusPollingEnabled || document.hidden) return;
  statusPollTimer = setTimeout(
    () => {
      void loadStatus();
    },
    hasActiveSession() ? STATUS_POLL_ACTIVE_MS : STATUS_POLL_IDLE_MS,
  );
}

function onVisibilityChange(): void {
  if (document.hidden) {
    clearStatusPollTimer();
  } else if (statusPollingEnabled) {
    void loadStatus();
  }
}

/** Starts adaptive status polling; the view calls this on mount/activation. */
function startStatusPolling(): void {
  if (statusPollingEnabled) return;
  statusPollingEnabled = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
  void loadStatus();
}

/** Stops status polling; the view calls this on unmount/deactivation. */
function stopStatusPolling(): void {
  statusPollingEnabled = false;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  clearStatusPollTimer();
}

export function useShows() {
  return {
    shows,
    sections,
    sessions,
    playlists,
    loadingShows,
    loadingSections,
    loadingStatus,
    loadingPlaylists,
    savingShow,
    deletingShowId,
    startingShowId,
    stoppingSessionId,
    noAiProviderAlert,
    loadShows,
    loadSections,
    loadPlaylists,
    playlistFor,
    getShow,
    saveShow,
    deleteShow,
    loadStatus,
    startShow,
    stopShow,
    runningSessionForStation,
    startStatusPolling,
    stopStatusPolling,
    reportStartError,
    dismissNoAiProviderAlert,
  };
}
