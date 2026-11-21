import { sourceProviderId } from "@/composables/nowPlayingSource";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { sortLiveSources } from "@/helpers/live_sources";
import { api } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import { EventType, Scope, type PlayerSource } from "@/plugins/api/interfaces";
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

/**
 * Keep `store.hasLiveSources` current from now on, for the menu item of the
 * Live sources page. Call it again after a reconnect to refresh it.
 */
export function trackLiveSources(): void {
  if (!tracking) {
    api.subscribe_multi(REFRESH_EVENTS, refreshHasLiveSources);
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

  // another player has other sources: the old ones go before they are clicked
  watch(
    () => toValue(playerId),
    () => {
      entries.value = [];
      void load();
    },
    { immediate: true },
  );
  const unsubscribe = api.subscribe_multi(REFRESH_EVENTS, load);
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
    // a server error with a reason already got its own toast from the api
    if (!(err instanceof ApiCommandError && err.details)) {
      toast.error($t("play_failed"));
    }
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
  try {
    const sources = await api.getLiveSources(undefined, {
      suppressGlobalError: true,
    });
    store.hasLiveSources = sources.length > 0;
  } catch {
    // a server without the list has no live sources to start
    store.hasLiveSources = false;
  }
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
