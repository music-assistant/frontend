import { sourceProviderId } from "@/composables/nowPlayingSource";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { getSelectableInputs, sortLiveSources } from "@/helpers/live_sources";
import { api, ConnectionState } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  EventType,
  Scope,
  type EventMessage,
  type Player,
  type PlayerSource,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import { PlayCircle, Settings } from "@lucide/vue";
import { toast } from "vue-sonner";
import {
  computed,
  markRaw,
  onBeforeUnmount,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

// a player or a provider that comes or goes brings or takes its live sources
const REFRESH_EVENTS = [
  EventType.PLAYER_ADDED,
  EventType.PLAYER_REMOVED,
  EventType.PROVIDERS_UPDATED,
];

let tracking = false;
let latestAvailabilityRequest = 0;

/**
 * Keep `store.hasLiveSources` current from now on, for the menu item of the
 * Live sources page. Call it again after a reconnect to refresh it.
 */
export function trackLiveSources(): void {
  if (!tracking) {
    onLiveSourcesChanged(refreshHasLiveSources);
    tracking = true;
  }
  void refreshHasLiveSources();
}

/**
 * The live sources and inputs that can be started on a player, sorted by name
 * and kept current while the calling component is mounted.
 *
 * @param playerId - The player to start them on; none lists nothing.
 */
export function useLiveSources(playerId: MaybeRefOrGetter<string | undefined>) {
  const entries = ref<PlayerSource[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  let latestRequest = 0;

  const load = async () => {
    const id = toValue(playerId);
    const request = ++latestRequest;
    failed.value = false;
    if (!id) {
      entries.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const result = await api.getLiveSources(id);
      if (request === latestRequest) entries.value = result;
    } catch {
      // the api shows the error; the page offers to try again
      if (request === latestRequest) {
        entries.value = [];
        failed.value = true;
      }
    } finally {
      if (request === latestRequest) loading.value = false;
    }
  };

  // what the player can switch to changes with its inputs and their names, and
  // with its sync, which leaves it nothing to switch to while it plays what
  // another plays
  const inputsKey = computed(() => {
    const id = toValue(playerId);
    const player = id ? api.players[id] : undefined;
    if (!player) return "";
    const inputs = getSelectableInputs(player).map(
      (input) => `${input.id}=${input.name}`,
    );
    return JSON.stringify([player.synced_to, inputs.sort()]);
  });
  watch(
    [() => toValue(playerId), inputsKey],
    ([id], [previousId]) => {
      // another player has other sources: the old ones go before they are clicked
      if (id !== previousId) entries.value = [];
      void load();
    },
    { immediate: true },
  );
  // changes made while the connection was down arrive with the next sync
  watch(
    () => api.state?.value,
    (state, previous) => {
      if (state === ConnectionState.INITIALIZED && previous !== state) {
        void load();
      }
    },
  );
  const unsubscribe = onLiveSourcesChanged(load);
  onBeforeUnmount(() => unsubscribe());

  const sources = computed(() => sortLiveSources(entries.value, api.players));
  return { sources, loading, failed, reload: load };
}

/**
 * Start a live source on a player, or switch the player to an input.
 *
 * @param playerId - The player to start it on.
 * @param source - The entry in the list of live sources.
 */
export async function startLiveSource(
  playerId: string,
  source: PlayerSource,
): Promise<void> {
  try {
    await api.playerCommandGroupSelectSource(playerId, source.id);
  } catch (err) {
    // the api already told about an error of the server
    if (!(err instanceof ApiCommandError)) toast.error($t("play_failed"));
  }
}

/**
 * The menu of a live source: start it, and open the settings of the player it
 * belongs to, or of its provider for a source of no player.
 *
 * @param source - The entry in the list of live sources.
 * @param playerId - The player to start it on, if one is selected.
 */
export function getLiveSourceMenuItems(
  source: PlayerSource,
  playerId: string | undefined,
): ContextMenuItem[] {
  const menuItems: ContextMenuItem[] = [
    {
      label: "play_now",
      icon: markRaw(PlayCircle),
      disabled: !playerId,
      action: () => {
        if (playerId) void startLiveSource(playerId, source);
      },
    },
  ];
  const settingsPath = getSettingsPath(source);
  if (settingsPath) {
    menuItems.push({
      label: "open_settings",
      icon: markRaw(Settings),
      action: () => router.push(settingsPath),
    });
  }
  return menuItems;
}

/**
 * Open the menu of a live source at the given position.
 *
 * @param source - The entry in the list of live sources.
 * @param playerId - The player to start it on, if one is selected.
 * @param posX - Horizontal position of the menu.
 * @param posY - Vertical position of the menu.
 */
export function openLiveSourceMenu(
  source: PlayerSource,
  playerId: string | undefined,
  posX: number,
  posY: number,
): void {
  eventbus.emit("contextmenu", {
    items: getLiveSourceMenuItems(source, playerId),
    posX,
    posY,
  });
}

async function refreshHasLiveSources(): Promise<void> {
  const request = ++latestAvailabilityRequest;
  try {
    const sources = await api.getLiveSources(undefined, {
      suppressGlobalError: true,
    });
    if (request === latestAvailabilityRequest) {
      store.hasLiveSources = sources.length > 0;
    }
  } catch {
    // a failed check keeps the last answer, so a server without the list,
    // which is never answered, has none
  }
}

// calls back when live sources may have come or gone; returns the unsubscribe
function onLiveSourcesChanged(callback: () => void): () => void {
  const unsubscribeEvents = api.subscribe_multi(REFRESH_EVENTS, () =>
    callback(),
  );
  // a disabled player leaves with a last update, and no removal follows
  const unsubscribeDisabled = api.subscribe(
    EventType.PLAYER_UPDATED,
    (evt: EventMessage) => {
      if ((evt.data as Player | undefined)?.enabled === false) callback();
    },
  );
  return () => {
    unsubscribeEvents();
    unsubscribeDisabled();
  };
}

// the settings a role that changes them can open for a source, if any
function getSettingsPath(source: PlayerSource): string | undefined {
  if (source.owner_player_id) {
    return authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE)
      ? `/settings/editplayer/${source.owner_player_id}`
      : undefined;
  }
  const providerId = sourceProviderId(source.id);
  return providerId && authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE)
    ? `/settings/editprovider/${providerId}`
    : undefined;
}
