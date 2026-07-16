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
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useAiRadioEditor } from "./useAiRadioEditor";

const selectedEditorStationId = ref("");
const stationDraft = ref<AIRadioStationDraft | null>(null);
const stationDraftSnapshot = ref<string | null>(null);

const stationDraftDirty = computed(() => {
  if (!stationDraft.value) {
    return false;
  }
  return JSON.stringify(stationDraft.value) !== stationDraftSnapshot.value;
});

const snapshotStationDraft = () => {
  stationDraftSnapshot.value = stationDraft.value
    ? JSON.stringify(stationDraft.value)
    : null;
};

// Run `next` immediately, or after user confirmation when it would discard
// unsaved draft edits.
const confirmDiscardStationDraft = (next: () => void | Promise<void>) => {
  if (!stationDraftDirty.value) {
    void next();
    return;
  }
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.confirm.discard_changes_title"),
    message: $t("providers.ai_radio.confirm.discard_changes"),
    confirmLabel: $t("providers.ai_radio.actions.discard"),
    onConfirm: next,
  });
};

const isValidStationImport = (value: unknown): value is AIRadioStation => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return typeof data.name === "string" || typeof data.id === "string";
};

export function useAiRadioStationDraft() {
  const {
    stations,
    saveStation,
    deleteStation,
    getStation,
    validateStation,
    createStationDraftFromTemplate,
  } = useAiRadioEditor();

  const createNewStationDraft = () => {
    confirmDiscardStationDraft(() => {
      const draft = normalizeStationDraft(createStationDraftFromTemplate());
      draft.id = "";
      draft.name = "";
      draft.source_playlist_id = "";
      draft.source_playlist_provider = "library";
      selectedEditorStationId.value = "";
      stationDraft.value = draft;
      snapshotStationDraft();
    });
  };

  const applyStationSelection = async (stationId: string) => {
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

  const selectStationForEdit = async (
    stationId: string,
    options?: { skipDirtyCheck?: boolean },
  ) => {
    if (options?.skipDirtyCheck) {
      await applyStationSelection(stationId);
      return;
    }
    confirmDiscardStationDraft(() => applyStationSelection(stationId));
  };

  // Show a (newly saved) station in the editor without re-fetching it.
  const adoptStation = (station: AIRadioStation) => {
    selectedEditorStationId.value = station.id;
    stationDraft.value = normalizeStationDraft(station);
    snapshotStationDraft();
  };

  const clearStationDraft = () => {
    selectedEditorStationId.value = "";
    stationDraft.value = null;
    snapshotStationDraft();
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

  const removeSelectedStation = () => {
    if (!selectedEditorStationId.value) {
      return;
    }
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("providers.ai_radio.confirm.delete_station_title"),
      message: $t("providers.ai_radio.confirm.delete_station"),
      confirmLabel: $t("providers.ai_radio.actions.delete"),
      onConfirm: async () => {
        try {
          await deleteStation(selectedEditorStationId.value);
          const nextStation = stations.value[0];
          if (nextStation) {
            await selectStationForEdit(nextStation.id, {
              skipDirtyCheck: true,
            });
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
      },
    });
  };

  const importStationFile = async (file: File) => {
    let imported: AIRadioStation;
    let totalInFile = 1;
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>;
      let candidate: unknown = data;
      if (Array.isArray(data.stations) && data.stations.length > 0) {
        totalInFile = data.stations.length;
        candidate = data.stations[0];
      }
      if (!isValidStationImport(candidate)) {
        throw new Error(
          $t("providers.ai_radio.validation.invalid_import_file"),
        );
      }
      imported = candidate;
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.station_import_failed", [
          errorMessage(error),
        ]),
      );
      return;
    }
    confirmDiscardStationDraft(() => {
      stationDraft.value = normalizeStationDraft(imported);
      selectedEditorStationId.value = stationDraft.value.id || "";
      snapshotStationDraft();
      if (totalInFile > 1) {
        toast.info(
          $t("providers.ai_radio.toast.import_used_first", [totalInFile]),
        );
      }
      toast.success($t("providers.ai_radio.toast.station_imported"));
    });
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
    stationDraftDirty,
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
