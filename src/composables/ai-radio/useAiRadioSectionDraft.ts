import {
  deepClone,
  errorMessage,
  exportJson,
  normalizeSectionDraft,
  slugify,
} from "@/helpers/ai_radio";
import type { AIRadioSection } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useAiRadioEditor } from "./useAiRadioEditor";

const selectedEditorSectionId = ref("");
const sectionDraft = ref<AIRadioSection | null>(null);
const sectionDraftSnapshot = ref<string | null>(null);

const sectionDraftDirty = computed(() => {
  if (!sectionDraft.value) {
    return false;
  }
  return JSON.stringify(sectionDraft.value) !== sectionDraftSnapshot.value;
});

const snapshotSectionDraft = () => {
  sectionDraftSnapshot.value = sectionDraft.value
    ? JSON.stringify(sectionDraft.value)
    : null;
};

// Run `next` immediately, or after user confirmation when it would discard
// unsaved draft edits.
const confirmDiscardSectionDraft = (next: () => void | Promise<void>) => {
  if (!sectionDraftDirty.value) {
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

const isValidSectionImport = (value: unknown): value is AIRadioSection => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return typeof data.name === "string" || typeof data.id === "string";
};

export function useAiRadioSectionDraft() {
  const {
    sections,
    saveSection,
    deleteSection,
    getSection,
    createSectionDraftFromTemplate,
  } = useAiRadioEditor();

  const createNewSectionDraft = () => {
    confirmDiscardSectionDraft(() => {
      const draft = normalizeSectionDraft(createSectionDraftFromTemplate());
      draft.id = "";
      draft.name = "";
      draft.prompt = "";
      selectedEditorSectionId.value = "";
      sectionDraft.value = draft;
      snapshotSectionDraft();
    });
  };

  const applySectionSelection = async (sectionId: string) => {
    try {
      const section = await getSection(sectionId);
      selectedEditorSectionId.value = section.id;
      sectionDraft.value = normalizeSectionDraft(section);
      snapshotSectionDraft();
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.section_load_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const selectSectionForEdit = async (
    sectionId: string,
    options?: { skipDirtyCheck?: boolean },
  ) => {
    if (options?.skipDirtyCheck) {
      await applySectionSelection(sectionId);
      return;
    }
    confirmDiscardSectionDraft(() => applySectionSelection(sectionId));
  };

  const clearSectionDraft = () => {
    selectedEditorSectionId.value = "";
    sectionDraft.value = null;
    snapshotSectionDraft();
  };

  const saveSectionDraft = async () => {
    if (!sectionDraft.value) {
      return;
    }
    const payload = normalizeSectionDraft(deepClone(sectionDraft.value));
    if (!payload.name.trim()) {
      toast.error($t("providers.ai_radio.validation.section_name_required"));
      return;
    }
    if (!payload.id.trim()) {
      payload.id = slugify(payload.name);
    }
    if (!payload.prompt.trim()) {
      toast.error($t("providers.ai_radio.validation.section_prompt_required"));
      return;
    }
    if (payload.type !== "ai_text") {
      delete (payload as { web_search?: string }).web_search;
      delete (payload as { constraints?: { max_chars?: number } }).constraints;
    }
    try {
      const saved = await saveSection(payload);
      selectedEditorSectionId.value = saved.id;
      sectionDraft.value = normalizeSectionDraft(saved);
      snapshotSectionDraft();
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.section_save_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const removeSelectedSection = () => {
    if (!selectedEditorSectionId.value) {
      return;
    }
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("providers.ai_radio.confirm.delete_section_title"),
      message: $t("providers.ai_radio.confirm.delete_section"),
      confirmLabel: $t("providers.ai_radio.actions.delete"),
      onConfirm: async () => {
        try {
          await deleteSection(selectedEditorSectionId.value);
          const nextSection = sections.value[0];
          if (nextSection) {
            await selectSectionForEdit(nextSection.id, {
              skipDirtyCheck: true,
            });
          } else {
            clearSectionDraft();
          }
        } catch (error) {
          toast.error(
            $t("providers.ai_radio.toast.section_delete_failed", [
              errorMessage(error),
            ]),
          );
        }
      },
    });
  };

  const importSectionFile = async (file: File) => {
    let imported: AIRadioSection;
    let totalInFile = 1;
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>;
      let candidate: unknown = data;
      if (Array.isArray(data.sections) && data.sections.length > 0) {
        totalInFile = data.sections.length;
        candidate = data.sections[0];
      }
      if (!isValidSectionImport(candidate)) {
        throw new Error(
          $t("providers.ai_radio.validation.invalid_import_file"),
        );
      }
      imported = candidate;
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.section_import_failed", [
          errorMessage(error),
        ]),
      );
      return;
    }
    confirmDiscardSectionDraft(() => {
      sectionDraft.value = normalizeSectionDraft(imported);
      selectedEditorSectionId.value = sectionDraft.value.id || "";
      snapshotSectionDraft();
      if (totalInFile > 1) {
        toast.info(
          $t("providers.ai_radio.toast.import_used_first", [totalInFile]),
        );
      }
      toast.success($t("providers.ai_radio.toast.section_imported"));
    });
  };

  const exportSectionDraft = () => {
    if (!sectionDraft.value) {
      toast.error($t("providers.ai_radio.validation.no_section_loaded"));
      return;
    }
    const payload = normalizeSectionDraft(sectionDraft.value);
    const fileName = `${payload.id || slugify(payload.name)}.json`;
    exportJson(fileName, payload);
    toast.success($t("providers.ai_radio.toast.section_exported"));
  };

  return {
    selectedEditorSectionId,
    sectionDraft,
    sectionDraftDirty,
    createNewSectionDraft,
    selectSectionForEdit,
    clearSectionDraft,
    saveSectionDraft,
    removeSelectedSection,
    importSectionFile,
    exportSectionDraft,
  };
}
