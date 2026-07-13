import {
  deepClone,
  errorMessage,
  exportJson,
  normalizeSectionDraft,
  slugify,
} from "@/helpers/ai_radio";
import type { AIRadioSection } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";
import { useAiRadioEditor } from "./useAiRadioEditor";

const selectedEditorSectionId = ref("");
const sectionDraft = ref<AIRadioSection | null>(null);

export function useAiRadioSectionDraft() {
  const {
    sections,
    saveSection,
    deleteSection,
    getSection,
    createSectionDraftFromTemplate,
  } = useAiRadioEditor();

  const createNewSectionDraft = () => {
    const draft = normalizeSectionDraft(createSectionDraftFromTemplate());
    draft.id = "";
    draft.name = "";
    draft.prompt = "";
    selectedEditorSectionId.value = "";
    sectionDraft.value = draft;
  };

  const selectSectionForEdit = async (sectionId: string) => {
    try {
      const section = await getSection(sectionId);
      selectedEditorSectionId.value = section.id;
      sectionDraft.value = normalizeSectionDraft(section);
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.section_load_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const clearSectionDraft = () => {
    selectedEditorSectionId.value = "";
    sectionDraft.value = null;
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
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.section_save_failed", [
          errorMessage(error),
        ]),
      );
    }
  };

  const removeSelectedSection = async () => {
    if (!selectedEditorSectionId.value) {
      return;
    }
    if (!window.confirm($t("providers.ai_radio.confirm.delete_section"))) {
      return;
    }
    try {
      await deleteSection(selectedEditorSectionId.value);
      const nextSection = sections.value[0];
      if (nextSection) {
        await selectSectionForEdit(nextSection.id);
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
  };

  const importSectionFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>;
      let imported: AIRadioSection | null = null;
      if (Array.isArray(data.sections) && data.sections.length > 0) {
        imported = data.sections[0] as unknown as AIRadioSection;
      } else {
        imported = data as unknown as AIRadioSection;
      }
      sectionDraft.value = normalizeSectionDraft(imported);
      selectedEditorSectionId.value = sectionDraft.value.id || "";
      toast.success($t("providers.ai_radio.toast.section_imported"));
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.section_import_failed", [
          errorMessage(error),
        ]),
      );
    }
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
    createNewSectionDraft,
    selectSectionForEdit,
    clearSectionDraft,
    saveSectionDraft,
    removeSelectedSection,
    importSectionFile,
    exportSectionDraft,
  };
}
