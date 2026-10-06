import { canPlayShows } from "@/helpers/ai_radio_access";
import { trackAIRadioCache } from "@/helpers/ai_radio_events";
import api from "@/plugins/api";
import type {
  AIRadioQueueDJStatus,
  AIRadioSection,
  AIRadioStation,
  Playlist,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";

const PLAYLIST_PAGE_SIZE = 200;
const PLAYLIST_FETCH_LIMIT = 5000;
const NO_AI_PROVIDER_MARKER = /no ai provider/i;

const shows = ref<AIRadioStation[]>([]);
const sections = ref<AIRadioSection[]>([]);
const playlists = ref<Playlist[]>([]);
// queue_id -> DJ state; a show is on air on the queue whose station_id is its id.
const djStatus = ref<AIRadioQueueDJStatus>({});

const loadingShows = ref(false);
const loadingSections = ref(false);
const loadingPlaylists = ref(false);
const loadingDjStatus = ref(false);
const savingShow = ref(false);
// Station id currently being deleted, so only that card reflects it.
const deletingShowId = ref("");
// Station ids with a start or stop in flight; Sets because two shows on two
// different queues can be started or stopped at once.
const startingShowIds = reactive(new Set<string>());
const stoppingShowIds = reactive(new Set<string>());
// Refreshes can overlap (provider hints, a start, a stop's fresh check): the
// loading flag follows the in-flight count and only the newest result is applied.
let djStatusInFlight = 0;
let djStatusRequestSeq = 0;
let newestDjStatusRequest: Promise<AIRadioQueueDJStatus> | null = null;

// Set when a start attempt fails with a "No AI provider" error; drives the
// gallery's persistent prereq banner (a toast alone isn't enough there).
const noAiProviderAlert = ref(false);

const sortByName = <T extends { name: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

/** The dynamic radio media item uri a show plays as. */
export function showUri(showId: string): string {
  return `ai_radio://radio/${showId}`;
}

async function loadShows(): Promise<AIRadioStation[]> {
  loadingShows.value = true;
  try {
    const result = await api.sendCommand<AIRadioStation[]>(
      "ai_radio/stations/list",
    );
    shows.value = sortByName(result || []);
    trackAIRadioCache("stations_updated", loadShows);
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
    trackAIRadioCache("sections_updated", loadSections);
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

function refreshDjStatus(
  suppressGlobalError = false,
): Promise<AIRadioQueueDJStatus> {
  const seq = ++djStatusRequestSeq;
  djStatusInFlight++;
  loadingDjStatus.value = true;
  const request = (async (): Promise<AIRadioQueueDJStatus> => {
    try {
      const result = suppressGlobalError
        ? await api.sendCommand<AIRadioQueueDJStatus>(
            "ai_radio/queue_dj/status",
            undefined,
            { suppressGlobalError: true },
          )
        : await api.sendCommand<AIRadioQueueDJStatus>(
            "ai_radio/queue_dj/status",
          );
      // an older request finishing late must not overwrite a newer status; it hands
      // back the newer request's answer instead so every caller decides on the
      // newest state (stopShow does)
      if (seq !== djStatusRequestSeq) return await newestDjStatusRequest!;
      djStatus.value = result || {};
      trackAIRadioCache("queue_dj_updated", refetchDjStatus);
      return djStatus.value;
    } finally {
      if (--djStatusInFlight === 0) loadingDjStatus.value = false;
    }
  })();
  newestDjStatusRequest = request;
  return request;
}

/** The queue a show is currently on air on, if any (drives a show card's "On air" state). */
function onAirQueueId(showId: string): string | undefined {
  return Object.keys(djStatus.value).find(
    (queueId) => djStatus.value[queueId].station_id === showId,
  );
}

/** Whether a start is currently in flight for the given show. */
function isStarting(showId: string): boolean {
  return startingShowIds.has(showId);
}

/** Whether a stop is currently in flight for the given show. */
function isStopping(showId: string): boolean {
  return stoppingShowIds.has(showId);
}

/** Plays a show as its radio media item on the queue the given player plays from. */
async function startShow(showId: string, playerId: string): Promise<void> {
  startingShowIds.add(showId);
  dismissNoAiProviderAlert();
  try {
    await api.playMedia(showUri(showId), undefined, {
      queue_id: activeQueueId(playerId),
    });
    toast.success($t("providers.ai_radio.toast.live_starting"));
    // Best effort: the server's queue_dj_updated hint reconciles the on-air state
    // anyway, so a failure here must not add an error toast to the success one.
    await refreshDjStatus(true).catch(() => undefined);
  } finally {
    startingShowIds.delete(showId);
  }
}

/** Takes a show off air by clearing the queue it plays on; the server detaches the DJ itself. */
async function stopShow(showId: string): Promise<void> {
  const queueId = onAirQueueId(showId);
  if (!queueId) return;
  stoppingShowIds.add(showId);
  try {
    // The queue may have moved on to other content since djStatus was fetched;
    // re-check right before the destructive clear so that content isn't touched.
    // This also applies the fresh status.
    // Failures surface once, through the caller's own error handling.
    const fresh = await refreshDjStatus(true);
    if (fresh[queueId]?.station_id !== showId) return;
    await api.sendCommand(
      "player_queues/clear",
      { queue_id: queueId },
      { suppressGlobalError: true },
    );
    // Optimistic: the detach also lands as a queue_dj_updated hint, which refreshes the real state.
    const remaining = { ...djStatus.value };
    delete remaining[queueId];
    djStatus.value = remaining;
    toast.success($t("providers.ai_radio.toast.show_stopped"));
  } finally {
    stoppingShowIds.delete(showId);
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

/** The queue a player plays from: its group leader's when synced, else its own (mirrors api.playMedia's default). */
function activeQueueId(playerId: string): string {
  const player = api.players[playerId];
  return player?.active_source && player.active_source in api.queues
    ? player.active_source
    : playerId;
}

/** Background refetch: there is no user action to attach an error toast to. */
function refetchDjStatus(): Promise<AIRadioQueueDJStatus> {
  return refreshDjStatus(true);
}

export function useShows() {
  return {
    shows,
    sections,
    playlists,
    djStatus,
    loadingShows,
    loadingSections,
    loadingPlaylists,
    loadingDjStatus,
    savingShow,
    deletingShowId,
    noAiProviderAlert,
    loadShows,
    loadSections,
    loadPlaylists,
    playlistFor,
    getShow,
    saveShow,
    deleteShow,
    refreshDjStatus,
    onAirQueueId,
    isStarting,
    isStopping,
    startShow,
    stopShow,
    reportStartError,
    dismissNoAiProviderAlert,
  };
}

// Fetch the DJ state as soon as the provider is there, for the roles that may
// play shows, so the on-air state is right from anywhere in the app.
// Registered last: the immediate callback reaches everything above.
watch(
  () => store.enabledPlugins.has("ai_radio") && canPlayShows(),
  (ready) => {
    // Session-scoped sessions never play shows.
    if (ready && authManager.guestSessionKind() === null)
      refreshDjStatus(true).catch(() => undefined);
  },
  { immediate: true },
);
