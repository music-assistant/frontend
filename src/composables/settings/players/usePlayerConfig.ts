import { useConfigAction } from "@/composables/useConfigAction";
import { getPlayerActionProvider } from "@/helpers/action_result";
import { mergeConfigEntries } from "@/helpers/config_entry_ui";
import { isPlayerBeingRemoved } from "@/helpers/player_settings_actions";
import { api } from "@/plugins/api";
import {
  type ConfigValueType,
  type EventMessage,
  EventType,
  type PlayerConfig,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { toast } from "vue-sonner";

/** What the settings pages of a player ask of the form that shows its config. */
export interface PlayerConfigForm {
  discardChanges: () => void;
  saveFailed: () => void;
}

export interface UsePlayerConfigOptions {
  // called once the server removed the player, unless a command of this app is
  // removing it and goes on from there itself
  onRemoved?: () => void;
}

/**
 * The config of the player a settings page shows: loaded for that player, kept up
 * to date with the server while the edits that wait for a save stay, and saved.
 *
 * @param playerId The id of the player the page shows.
 * @param form The form that shows the config.
 * @param options What to do once the player is gone.
 */
export function usePlayerConfig(
  playerId: () => string | undefined,
  form: Ref<PlayerConfigForm | undefined>,
  options: UsePlayerConfigOptions = {},
) {
  const config = ref<PlayerConfig>();
  const loading = ref(false);
  const enabling = ref(false);
  let configLoadRequestId = 0;
  let configRefreshRequestId = 0;
  let enableRequestId = 0;

  const unsubProvidersUpdated = api.subscribe(
    EventType.PROVIDERS_UPDATED,
    () => {
      const id = playerId();
      if (id) void refreshPlayerConfig(id);
    },
  );
  onBeforeUnmount(unsubProvidersUpdated);

  // renaming, enabling and deleting all happen through the shared menu, so pick the
  // change up from the server rather than from whoever made it
  const unsubConfigUpdated = api.subscribe(
    EventType.PLAYER_CONFIG_UPDATED,
    (evt: EventMessage) => {
      if (evt.object_id && evt.object_id === playerId()) {
        void refreshPlayerConfig(evt.object_id);
      }
    },
  );
  onBeforeUnmount(unsubConfigUpdated);

  // the players the server removed while this page was open, which have no config to fetch
  const removedPlayerIds = new Set<string>();
  const unsubPlayerRemoved = api.subscribe(
    EventType.PLAYER_REMOVED,
    (evt: EventMessage) => {
      if (!evt.object_id) return;
      removedPlayerIds.add(evt.object_id);
      if (
        evt.object_id === playerId() &&
        !isPlayerBeingRemoved(evt.object_id)
      ) {
        options.onRemoved?.();
      }
    },
  );
  onBeforeUnmount(unsubPlayerRemoved);

  const player = computed(() =>
    config.value ? api.players[config.value.player_id] : undefined,
  );

  watch(
    playerId,
    (val) => {
      resetPlayerState(val);
      if (val) void loadConfig(val);
    },
    { immediate: true },
  );

  const { onAction } = useConfigAction({
    config,
    loading,
    invokeAction: (action) =>
      api.invokePlayerConfigAction(config.value!.player_id, action),
    saveValues: (values) => api.savePlayerConfig(playerId()!, values),
    answeredBy: (action) =>
      getPlayerActionProvider(api.players[config.value!.player_id], action),
  });

  /**
   * Save values of the config, and say whether the save landed. A refused save
   * leaves them in the form, guarded as before.
   */
  async function save(
    values: Record<string, ConfigValueType>,
  ): Promise<boolean> {
    loading.value = true;
    try {
      await api.savePlayerConfig(playerId()!, values);
      return true;
    } catch {
      // Error toast is already shown by the API layer (handleResultMessage).
      // We just prevent navigation so the user can correct values.
      form.value?.saveFailed();
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function onImmediateApply(values: Record<string, ConfigValueType>) {
    // Immediately apply a config value change to the backend
    // and refresh the local config with the server response
    loading.value = true;
    api
      .savePlayerConfig(playerId()!, values)
      .then((updatedConfig) => {
        // the other values the user changed are still waiting for a save
        applyPlayerConfig(updatedConfig, Object.keys(values));
      })
      .finally(() => {
        loading.value = false;
      });
  }

  async function enablePlayer() {
    if (!config.value || enabling.value) return;

    const id = config.value.player_id;
    const requestId = ++enableRequestId;
    enabling.value = true;
    try {
      const updatedConfig = await api.savePlayerConfig(id, { enabled: true });
      if (!isCurrentPlayer(id)) return;

      applyPlayerConfig(updatedConfig);
      toast.success($t("settings.player_saved"));
    } catch {
      // the api reports the failure itself; the page shows what the server kept
      if (!isCurrentPlayer(id)) return;

      await refreshPlayerConfig(id);
    } finally {
      if (requestId === enableRequestId) enabling.value = false;
    }
  }

  // drop what the form holds and show the config as the server stores it now
  function reloadConfig() {
    if (!config.value) return;
    const id = config.value.player_id;
    form.value?.discardChanges();
    config.value = undefined;
    void loadConfig(id);
  }

  async function loadConfig(id: string) {
    const requestId = ++configLoadRequestId;
    try {
      const updatedConfig = await api.getPlayerConfig(id);
      if (requestId === configLoadRequestId && playerId() === id) {
        config.value = updatedConfig;
      }
    } catch (err) {
      if (requestId === configLoadRequestId && playerId() === id) {
        toast.error(String(err));
      }
    }
  }

  async function refreshPlayerConfig(id: string) {
    if (config.value?.player_id !== id || isPlayerGoing(id)) return;
    const requestId = ++configRefreshRequestId;
    // a player can go with its config while the refresh is on its way, such as a speaker
    // that went up in a multi-channel player; the page leaves it then, so that is no error
    const wasLive = id in api.players;
    const isGone = () => wasLive && !(id in api.players);
    try {
      const updatedConfig = await api.getPlayerConfig(id, {
        suppressGlobalError: isGone,
      });
      if (
        requestId === configRefreshRequestId &&
        playerId() === id &&
        config.value?.player_id === id
      ) {
        applyPlayerConfig(updatedConfig);
      }
    } catch (err) {
      if (
        requestId === configRefreshRequestId &&
        playerId() === id &&
        config.value?.player_id === id &&
        !isGone()
      ) {
        toast.error(String(err));
      }
    }
  }

  function applyPlayerConfig(
    updatedConfig: PlayerConfig,
    saved: string[] = [],
  ) {
    if (!config.value) return;
    config.value = {
      ...updatedConfig,
      values: mergeConfigEntries(
        config.value.values,
        updatedConfig.values,
        saved,
      ),
    };
  }

  function isCurrentPlayer(id: string) {
    return playerId() === id && config.value?.player_id === id;
  }

  // a player that is being removed, or that is gone, has no config left to fetch
  function isPlayerGoing(id: string): boolean {
    return (
      isPlayerBeingRemoved(id) ||
      (removedPlayerIds.has(id) && !(id in api.players))
    );
  }

  function resetPlayerState(id?: string) {
    if (config.value?.player_id === id) return;
    config.value = undefined;
    enabling.value = false;
    enableRequestId++;
  }

  return {
    config,
    player,
    loading,
    enabling,
    enablePlayer,
    reloadConfig,
    save,
    onImmediateApply,
    onAction,
  };
}
