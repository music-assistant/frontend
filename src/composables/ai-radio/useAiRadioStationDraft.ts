import {
  buildStationPayload,
  errorMessage,
  exportJson,
  normalizeStationDraft,
  slugify,
  validateStationDraftLocal,
  type AIRadioStationDraft,
} from "@/helpers/ai_radio";
import type { AIRadioStation } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";
import { useAiRadioEditor } from "./useAiRadioEditor";
import { useAiRadioRun } from "./useAiRadioRun";

const selectedEditorStationId = ref("");
const stationDraft = ref<AIRadioStationDraft | null>(null);

export function useAiRadioStationDraft() {
  const {
    stations,
    saveStation,
    deleteStation,
    getStation,
    validateStation,
    createStationDraftFromTemplate,
  } = useAiRadioEditor();
  const { selectedRunStationId, applyRunStationDefaults } = useAiRadioRun();

  const createNewStationDraft = () => {
    const draft = normalizeStationDraft(createStationDraftFromTemplate());
    draft.id = "";
    draft.name = "";
    draft.source_playlist_id = "";
    draft.source_playlist_provider = "library";
    selectedEditorStationId.value = "";
    stationDraft.value = draft;
  };

  const selectStationForEdit = async (stationId: string) => {
    try {
      const station = await getStation(stationId);
      adoptStation(station);
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.station_load_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  // Show a (newly saved) station in the editor without re-fetching it.
  const adoptStation = (station: AIRadioStation) => {
    selectedEditorStationId.value = station.id;
    stationDraft.value = normalizeStationDraft(station);
  };

  const clearStationDraft = () => {
    selectedEditorStationId.value = "";
    stationDraft.value = null;
  };

  const saveStationDraft = async () => {
    if (!stationDraft.value) {
      return;
    }
    const payload = buildStationPayload(stationDraft.value);
    const localError = validateStationDraftLocal(payload);
    if (localError) {
      toast.error(localError);
      return;
    }
    try {
      const saved = await saveStation(payload);
      adoptStation(saved);
      if (!selectedRunStationId.value) {
        selectedRunStationId.value = saved.id;
        applyRunStationDefaults(saved.id);
      }
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.station_save_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const validateStationDraftOnServer = async () => {
    if (!stationDraft.value) {
      return;
    }
    const payload = buildStationPayload(stationDraft.value);
    const localError = validateStationDraftLocal(payload);
    if (localError) {
      toast.error(localError);
      return;
    }
    try {
      const normalized = await validateStation(payload);
      stationDraft.value = normalizeStationDraft(normalized);
      toast.success($t("providers.ai_radio.toast.station_validation_passed"));
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.station_validation_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const removeSelectedStation = async () => {
    if (!selectedEditorStationId.value) {
      return;
    }
    if (!window.confirm($t("providers.ai_radio.confirm.delete_station"))) {
      return;
    }
    try {
      await deleteStation(selectedEditorStationId.value);
      const nextStation = stations.value[0];
      if (nextStation) {
        await selectStationForEdit(nextStation.id);
      } else {
        clearStationDraft();
      }
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.station_delete_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const importStationFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>;
      let imported: AIRadioStation | null = null;
      if (Array.isArray(data.stations) && data.stations.length > 0) {
        imported = data.stations[0] as unknown as AIRadioStation;
      } else {
        imported = data as unknown as AIRadioStation;
      }
      stationDraft.value = normalizeStationDraft(imported);
      selectedEditorStationId.value = stationDraft.value.id || "";
      toast.success($t("providers.ai_radio.toast.station_imported"));
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.station_import_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const exportStationDraft = () => {
    if (!stationDraft.value) {
      toast.error($t("providers.ai_radio.validation.no_station_loaded"));
      return;
    }
    const payload = buildStationPayload(stationDraft.value);
    const fileName = `${payload.id || slugify(payload.name)}.json`;
    exportJson(fileName, payload);
    toast.success($t("providers.ai_radio.toast.station_exported"));
  };

  return {
    selectedEditorStationId,
    stationDraft,
    createNewStationDraft,
    selectStationForEdit,
    adoptStation,
    clearStationDraft,
    saveStationDraft,
    validateStationDraftOnServer,
    removeSelectedStation,
    importStationFile,
    exportStationDraft,
  };
}
