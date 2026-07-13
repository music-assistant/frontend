import {
  errorMessage,
  parseOptionalCapInput,
  parseOptionalPositiveInt,
} from "@/helpers/ai_radio";
import type { AIRadioMode, Player } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useAiRadio } from "./useAiRadio";
import { useAiRadioEditor } from "./useAiRadioEditor";

export const DEFAULT_PLAYER_SELECT_VALUE = "__station_default__";

const selectedRunStationId = ref("");
const selectedRunPlayerId = ref("");
const runSourcePlaytimeCapOverrideInput = ref("");
const runDynamicBatchSizeOverrideInput = ref("");

const sourcePlaylistOverrideId = ref("");
const sourcePlaylistOverrideProvider = ref("");
const sourcePlaylistOverrideName = ref("");

const hasSourcePlaylistOverride = computed(() => {
  return Boolean(
    sourcePlaylistOverrideId.value && sourcePlaylistOverrideProvider.value,
  );
});

const selectedRunPlayerSelectValue = computed(() => {
  return selectedRunPlayerId.value || DEFAULT_PLAYER_SELECT_VALUE;
});

function setSourcePlaylistOverride(
  itemId: string,
  provider: string,
  name: string,
) {
  sourcePlaylistOverrideId.value = itemId;
  sourcePlaylistOverrideProvider.value = provider;
  sourcePlaylistOverrideName.value = name;
}

function resetSourcePlaylistOverride() {
  sourcePlaylistOverrideId.value = "";
  sourcePlaylistOverrideProvider.value = "";
  sourcePlaylistOverrideName.value = "";
}

export function useAiRadioRun() {
  const { startRun, loadStatus } = useAiRadio();
  const { stations, players } = useAiRadioEditor();

  const availableRunPlayers = computed<Player[]>(() => {
    return players.value
      .filter((player) => player.available !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const applyRunStationDefaults = (stationId: string) => {
    const station = stations.value.find((item) => item.id === stationId);
    selectedRunPlayerId.value = station?.default_player_id || "";
  };

  const onSelectRunStation = (stationId: string) => {
    selectedRunStationId.value = stationId;
    applyRunStationDefaults(stationId);
  };

  const onSelectRunPlayer = (value: string) => {
    selectedRunPlayerId.value =
      value === DEFAULT_PLAYER_SELECT_VALUE ? "" : value;
  };

  const runStart = async (mode: AIRadioMode) => {
    if (!selectedRunStationId.value) {
      toast.error($t("providers.ai_radio.validation.select_station_first"));
      return;
    }
    try {
      await startRun(selectedRunStationId.value, mode, {
        playerIdOverride: selectedRunPlayerId.value || undefined,
        sourcePlaylistIdOverride: sourcePlaylistOverrideId.value || undefined,
        sourcePlaylistProviderOverride:
          sourcePlaylistOverrideProvider.value || undefined,
        dynamicSourcePlaytimeCapOverride: parseOptionalCapInput(
          runSourcePlaytimeCapOverrideInput.value,
        ),
        dynamicBatchSizeOverride: parseOptionalPositiveInt(
          runDynamicBatchSizeOverrideInput.value,
        ),
      });
      await loadStatus();
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.run_start_failed", [errorMessage(error)]),
      );
    }
  };

  return {
    selectedRunStationId,
    selectedRunPlayerId,
    runSourcePlaytimeCapOverrideInput,
    runDynamicBatchSizeOverrideInput,
    sourcePlaylistOverrideId,
    sourcePlaylistOverrideProvider,
    sourcePlaylistOverrideName,
    hasSourcePlaylistOverride,
    selectedRunPlayerSelectValue,
    availableRunPlayers,
    setSourcePlaylistOverride,
    resetSourcePlaylistOverride,
    applyRunStationDefaults,
    onSelectRunStation,
    onSelectRunPlayer,
    runStart,
  };
}
