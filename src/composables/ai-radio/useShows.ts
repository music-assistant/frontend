import api from "@/plugins/api";
import type {
  AIRadioQueueDJStatus,
  AIRadioSection,
  AIRadioStation,
  Playlist,
} from "@/plugins/api/interfaces";
import { EventType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { useDebounceFn } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const PLAYLIST_PAGE_SIZE = 200;
const PLAYLIST_FETCH_LIMIT = 5000;
const NO_AI_PROVIDER_MARKER = /no ai provider/i;
// Queue events arrive in bursts (state + items), and the server arms/detaches
// the show DJ in its own handler for those same events, so give it a moment
// before reading the result back.
const DJ_STATUS_REFRESH_DEBOUNCE_MS = 1000;
// Events after which the server may have armed or detached a queue's DJ.
const DJ_STATUS_EVENTS = [
  EventType.QUEUE_ADDED,
  EventType.QUEUE_ITEMS_UPDATED,
  EventType.QUEUE_UPDATED,
  EventType.PLAYER_REMOVED,
];

const shows = ref<AIRadioStation[]>([]);
const sections = ref<AIRadioSection[]>([]);
const playlists = ref<Playlist[]>([]);
// queue_id -> DJ state; a show is on air on the queue whose station_id is its id.
const djStatus = ref<AIRadioQueueDJStatus>({});

const loadingShows = ref(false);
const loadingSections = ref(false);
const loadingPlaylists = ref(false);
const savingShow = ref(false);
// Station id currently being deleted/started/stopped, so only that card reflects it.
const deletingShowId = ref("");
const startingShowId = ref("");
const stoppingShowId = ref("");

// Set when a start attempt fails with a "No AI provider" error; drives the
// gallery's persistent prereq banner (a toast alone isn't enough there).
const noAiProviderAlert = ref(false);

// Reactive on api.providers, mirroring useHosts' check, so callers that only
// need the show/DJ caches don't have to depend on useHosts for this.
const aiRadioAvailable = computed(() =>
  Object.values(api.providers ?? {}).some(
    (provider) => provider.domain === "ai_radio" && provider.available,
  ),
);

let showStatePrefetched = false;
let unsubscribeDjStatusEvents: (() => void) | null = null;

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

async function refreshDjStatus(): Promise<AIRadioQueueDJStatus> {
  const result = await api.sendCommand<AIRadioQueueDJStatus>(
    "ai_radio/queue_dj/status",
  );
  djStatus.value = result || {};
  return djStatus.value;
}

/** The queue a show is currently on air on, if any (drives a show card's "On air" state). */
function onAirQueueId(showId: string): string | undefined {
  return Object.keys(djStatus.value).find(
    (queueId) => djStatus.value[queueId].station_id === showId,
  );
}

/** Plays a show as its radio media item on the queue the given player plays from. */
async function startShow(showId: string, playerId: string): Promise<void> {
  startingShowId.value = showId;
  dismissNoAiProviderAlert();
  try {
    await api.playMedia(showUri(showId), undefined, {
      queue_id: activeQueueId(playerId),
    });
    toast.success($t("providers.ai_radio.toast.live_starting"));
    // Best effort: the queue events reconcile the on-air state anyway.
    await refreshDjStatus().catch(() => undefined);
  } finally {
    startingShowId.value = "";
  }
}

/** Takes a show off air by clearing the queue it plays on; the server detaches the DJ itself. */
async function stopShow(showId: string): Promise<void> {
  const queueId = onAirQueueId(showId);
  if (!queueId) return;
  stoppingShowId.value = showId;
  try {
    api.queueCommandClear(queueId);
    // Optimistic: the detach lands with the queue events, which refresh the real state.
    const remaining = { ...djStatus.value };
    delete remaining[queueId];
    djStatus.value = remaining;
    toast.success($t("providers.ai_radio.toast.show_stopped"));
  } finally {
    stoppingShowId.value = "";
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

/**
 * Warms the shows + DJ status caches the queue DJ menu reads to resolve an
 * on-air show's host. Without this, opening that menu outside the AI Radio
 * page (which is what normally loads these) would see stale/empty caches.
 */
function prefetchShowState(): void {
  if (showStatePrefetched) return;
  showStatePrefetched = true;
  Promise.all([loadShows(), refreshDjStatus()]).catch(() => {
    // Best effort: allow a later availability flip to try again.
    showStatePrefetched = false;
  });
}

/** The queue a player plays from: its group leader's when synced, else its own (mirrors api.playMedia's default). */
function activeQueueId(playerId: string): string {
  const player = api.players[playerId];
  return player?.active_source && player.active_source in api.queues
    ? player.active_source
    : playerId;
}

const refreshDjStatusDebounced = useDebounceFn(() => {
  // Best effort: the next queue event retries.
  refreshDjStatus().catch(() => undefined);
}, DJ_STATUS_REFRESH_DEBOUNCE_MS);

function subscribeDjStatusEvents(): void {
  if (unsubscribeDjStatusEvents) return;
  unsubscribeDjStatusEvents = api.subscribe_multi(
    DJ_STATUS_EVENTS,
    refreshDjStatusDebounced,
  );
  // Events missed while unsubscribed (e.g. across a reconnect) are reconciled here.
  void refreshDjStatusDebounced();
}

function unsubscribeDjStatusEventsIfAny(): void {
  unsubscribeDjStatusEvents?.();
  unsubscribeDjStatusEvents = null;
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
    savingShow,
    deletingShowId,
    startingShowId,
    stoppingShowId,
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
    startShow,
    stopShow,
    reportStartError,
    dismissNoAiProviderAlert,
  };
}

// Prefetch and track DJ state as soon as the provider is there, so the queue
// DJ menu can resolve an on-air show's host from anywhere in the app, not just
// this view. Registered last: the immediate callback reaches everything above.
watch(
  aiRadioAvailable,
  (available) => {
    // Session-scoped sessions lack the config scopes this needs and never open the queue DJ menu.
    if (available && authManager.guestSessionKind() === null) {
      prefetchShowState();
      subscribeDjStatusEvents();
    } else {
      unsubscribeDjStatusEventsIfAny();
    }
  },
  { immediate: true },
);

// A hot reload re-registers the watch above; drop the old listener first.
import.meta.hot?.dispose(unsubscribeDjStatusEventsIfAny);
