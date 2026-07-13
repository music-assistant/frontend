import {
  buildStationPayload,
  defaultGuidedPlacement,
  errorMessage,
  normalizeSectionDraft,
  normalizeStationDraft,
  playlistSelectValue,
  slugify,
  splitPlaylistSelectValue,
  validateStationDraftLocal,
} from "@/helpers/ai_radio";
import type {
  AIRadioPlacement,
  AIRadioSection,
  AIRadioSectionOrderRule,
  AIRadioStation,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useAiRadioEditor } from "./useAiRadioEditor";
import { useAiRadioRun } from "./useAiRadioRun";
import { useAiRadioStationDraft } from "./useAiRadioStationDraft";

const guidedWizardOpen = ref(false);
const guidedWizardStep = ref(1);
const creatingGuidedStation = ref(false);
const guidedWizardStationName = ref("");
const guidedWizardSourcePlaylistSelectValue = ref("");
const guidedWizardDefaultPlayerId = ref("");
const guidedWizardSectionIds = ref<string[]>([]);
const guidedWizardMergeSectionId = ref("");
const guidedWizardSectionPlacements = ref<Record<string, AIRadioPlacement>>({});
const creatingGuidedSection = ref(false);
const guidedNewSectionName = ref("");
const guidedNewSectionPrompt = ref("");
const guidedNewSectionPlacement = ref<AIRadioPlacement>("between_songs");

export function useAiRadioWizard() {
  const {
    stations,
    sections,
    playlists,
    saveStation,
    saveSection,
    createStationDraftFromTemplate,
    createSectionDraftFromTemplate,
  } = useAiRadioEditor();
  const {
    selectedRunStationId,
    sourcePlaylistOverrideId,
    sourcePlaylistOverrideProvider,
    sourcePlaylistOverrideName,
    availableRunPlayers,
    applyRunStationDefaults,
  } = useAiRadioRun();
  const { adoptStation } = useAiRadioStationDraft();

  const guidedWizardSectionById = computed(() => {
    const output = new Map<string, AIRadioSection>();
    for (const section of sections.value) {
      output.set(section.id, section);
    }
    return output;
  });

  const wizardSelectableSections = computed(() => {
    return sections.value
      .filter((section) => section.type === "ai_text")
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const guidedWizardSelectedSections = computed<AIRadioSection[]>(() => {
    return guidedWizardSectionIds.value
      .map((sectionId) => guidedWizardSectionById.value.get(sectionId))
      .filter((section): section is AIRadioSection => Boolean(section));
  });

  const guidedWizardMergeSectionOptions = computed<AIRadioSection[]>(() => {
    const selectedMeta = guidedWizardSelectedSections.value.filter(
      (section) => section.type === "ai_meta",
    );
    if (selectedMeta.length) {
      return selectedMeta;
    }
    return sections.value.filter((section) => section.type === "ai_meta");
  });

  const guidedWizardSelectedSectionNames = computed(() => {
    return guidedWizardSelectedSections.value.map((section) => section.name);
  });

  const guidedWizardMergeSectionName = computed(() => {
    if (!guidedWizardMergeSectionId.value) {
      return "";
    }
    return (
      guidedWizardSectionById.value.get(guidedWizardMergeSectionId.value)
        ?.name || guidedWizardMergeSectionId.value
    );
  });

  const guidedWizardSectionPlacementSummary = computed(() => {
    return guidedWizardSelectedSections.value.map((section) => {
      const placement =
        guidedWizardSectionPlacements.value[section.id] || "between_songs";
      const placementLabel =
        placement === "start_of_playlist"
          ? $t("providers.ai_radio.placement.start")
          : placement === "end_of_playlist"
            ? $t("providers.ai_radio.placement.end")
            : $t("providers.ai_radio.placement.between");
      return `${section.name} → ${placementLabel}`;
    });
  });

  const guidedWizardSourcePlaylistLabel = computed(() => {
    if (!guidedWizardSourcePlaylistSelectValue.value) {
      return "-";
    }
    const { provider, itemId } = splitPlaylistSelectValue(
      guidedWizardSourcePlaylistSelectValue.value,
    );
    const playlist = playlists.value.find(
      (item) => item.provider === provider && item.item_id === itemId,
    );
    if (!playlist) {
      return `${provider}:${itemId}`;
    }
    return `${playlist.name} (${playlist.provider}:${playlist.item_id})`;
  });

  const recommendedGuidedSectionIds = computed<string[]>(() => {
    const textSections = sections.value.filter(
      (section) => section.type === "ai_text",
    );
    if (textSections.length <= 6) {
      return textSections.map((section) => section.id);
    }
    const ranked = [...textSections].sort((a, b) => {
      const aName = `${a.id} ${a.name}`.toLowerCase();
      const bName = `${b.id} ${b.name}`.toLowerCase();
      const score = (value: string) => {
        if (value.includes("intro") || value.includes("start")) return 0;
        if (value.includes("transition") || value.includes("between")) return 1;
        if (value.includes("news") || value.includes("weather")) return 2;
        if (
          value.includes("outro") ||
          value.includes("end") ||
          value.includes("close")
        ) {
          return 3;
        }
        return 4;
      };
      const scoreDiff = score(aName) - score(bName);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.name.localeCompare(b.name);
    });
    return ranked.slice(0, 6).map((section) => section.id);
  });

  const canProceedGuidedWizardStep = computed(() => {
    if (guidedWizardStep.value === 1) {
      return (
        Boolean(guidedWizardStationName.value.trim()) &&
        Boolean(guidedWizardSourcePlaylistSelectValue.value)
      );
    }
    if (guidedWizardStep.value === 2) {
      return (
        guidedWizardSectionIds.value.length > 0 &&
        guidedWizardSectionIds.value.every((sectionId) =>
          Boolean(guidedWizardSectionPlacements.value[sectionId]),
        )
      );
    }
    return true;
  });

  const openGuidedStationCreator = () => {
    guidedWizardOpen.value = true;
    guidedWizardStep.value = 1;
    guidedWizardStationName.value = "";
    if (sourcePlaylistOverrideName.value) {
      guidedWizardStationName.value = `AI Radio - ${sourcePlaylistOverrideName.value}`;
    }

    if (
      sourcePlaylistOverrideId.value &&
      sourcePlaylistOverrideProvider.value
    ) {
      guidedWizardSourcePlaylistSelectValue.value = playlistSelectValue(
        sourcePlaylistOverrideProvider.value,
        sourcePlaylistOverrideId.value,
      );
    } else {
      guidedWizardSourcePlaylistSelectValue.value = playlists.value[0]
        ? playlistSelectValue(
            playlists.value[0].provider,
            playlists.value[0].item_id,
          )
        : "";
    }

    guidedWizardDefaultPlayerId.value = "";
    const runStation = stations.value.find(
      (item) => item.id === selectedRunStationId.value,
    );
    if (runStation?.default_player_id) {
      guidedWizardDefaultPlayerId.value = runStation.default_player_id;
    } else if (availableRunPlayers.value[0]) {
      guidedWizardDefaultPlayerId.value =
        availableRunPlayers.value[0].player_id;
    }

    guidedWizardSectionIds.value = [...recommendedGuidedSectionIds.value];
    guidedWizardSectionPlacements.value = {};
    for (const sectionId of guidedWizardSectionIds.value) {
      const section = guidedWizardSectionById.value.get(sectionId);
      if (!section) {
        continue;
      }
      guidedWizardSectionPlacements.value[sectionId] =
        defaultGuidedPlacement(section);
    }
    guidedWizardMergeSectionId.value = "";
    if (guidedWizardMergeSectionOptions.value[0]) {
      guidedWizardMergeSectionId.value =
        guidedWizardMergeSectionOptions.value[0].id;
    }
    guidedNewSectionName.value = "";
    guidedNewSectionPrompt.value = "";
    guidedNewSectionPlacement.value = "between_songs";
  };

  const onGuidedSectionToggle = (sectionId: string, checked: boolean) => {
    if (checked) {
      if (!guidedWizardSectionIds.value.includes(sectionId)) {
        guidedWizardSectionIds.value = [
          ...guidedWizardSectionIds.value,
          sectionId,
        ];
      }
      if (!guidedWizardSectionPlacements.value[sectionId]) {
        const section = guidedWizardSectionById.value.get(sectionId);
        if (section) {
          guidedWizardSectionPlacements.value[sectionId] =
            defaultGuidedPlacement(section);
        }
      }
      return;
    }
    guidedWizardSectionIds.value = guidedWizardSectionIds.value.filter(
      (item) => item !== sectionId,
    );
    delete guidedWizardSectionPlacements.value[sectionId];
    if (
      guidedWizardMergeSectionId.value &&
      !guidedWizardSectionIds.value.includes(guidedWizardMergeSectionId.value)
    ) {
      guidedWizardMergeSectionId.value = "";
    }
  };

  const setGuidedSectionPlacement = (
    sectionId: string,
    placement: AIRadioPlacement,
  ) => {
    guidedWizardSectionPlacements.value = {
      ...guidedWizardSectionPlacements.value,
      [sectionId]: placement,
    };
  };

  const createGuidedSection = async () => {
    if (!guidedNewSectionName.value.trim()) {
      toast.error($t("providers.ai_radio.validation.section_name_required"));
      return;
    }
    if (!guidedNewSectionPrompt.value.trim()) {
      toast.error($t("providers.ai_radio.validation.section_prompt_required"));
      return;
    }

    creatingGuidedSection.value = true;
    try {
      const sectionDraft = normalizeSectionDraft(
        createSectionDraftFromTemplate(),
      );
      sectionDraft.name = guidedNewSectionName.value.trim();
      sectionDraft.id = slugify(sectionDraft.name);
      sectionDraft.type = "ai_text";
      sectionDraft.prompt = guidedNewSectionPrompt.value.trim();
      sectionDraft.web_search = "disabled";
      sectionDraft.constraints = { max_chars: 650 };

      const saved = await saveSection(sectionDraft);
      if (!guidedWizardSectionIds.value.includes(saved.id)) {
        guidedWizardSectionIds.value = [
          ...guidedWizardSectionIds.value,
          saved.id,
        ];
      }
      guidedWizardSectionPlacements.value = {
        ...guidedWizardSectionPlacements.value,
        [saved.id]: guidedNewSectionPlacement.value,
      };

      guidedNewSectionName.value = "";
      guidedNewSectionPrompt.value = "";
      guidedNewSectionPlacement.value = "between_songs";
      toast.success($t("providers.ai_radio.toast.section_added_to_setup"));
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.section_create_failed", [
          errorMessage(error),
        ]),
      );
    } finally {
      creatingGuidedSection.value = false;
    }
  };

  const buildGuidedSectionOrder = (
    sectionIds: string[],
  ): AIRadioSectionOrderRule[] => {
    const selectedSections = sectionIds
      .map((sectionId) =>
        sections.value.find((section) => section.id === sectionId),
      )
      .filter((section): section is AIRadioSection => Boolean(section));
    const textSections = selectedSections.filter(
      (section) => section.type === "ai_text",
    );
    if (!textSections.length) {
      return [];
    }

    const rules: AIRadioSectionOrderRule[] = [];
    const placements: AIRadioPlacement[] = [
      "start_of_playlist",
      "between_songs",
      "end_of_playlist",
    ];

    for (const placement of placements) {
      const placementSections = textSections.filter((section) => {
        const selectedPlacement =
          guidedWizardSectionPlacements.value[section.id] || "between_songs";
        return selectedPlacement === placement;
      });

      if (!placementSections.length) {
        continue;
      }

      rules.push({
        when: placement,
        flow: placementSections.map((section) => ({ MUST: section.id })),
      });
    }

    if (!rules.length) {
      rules.push({
        when: "between_songs",
        flow: [{ MUST: textSections[0].id }],
      });
    }
    return rules;
  };

  // Returns the saved station on success so the caller can e.g. switch tabs.
  const createGuidedStation = async (): Promise<AIRadioStation | null> => {
    if (!canProceedGuidedWizardStep.value && guidedWizardStep.value < 3) {
      toast.error($t("providers.ai_radio.validation.complete_current_step"));
      return null;
    }
    if (!guidedWizardStationName.value.trim()) {
      toast.error($t("providers.ai_radio.validation.station_name_required"));
      guidedWizardStep.value = 1;
      return null;
    }
    if (!guidedWizardSourcePlaylistSelectValue.value) {
      toast.error($t("providers.ai_radio.validation.source_playlist_required"));
      guidedWizardStep.value = 1;
      return null;
    }
    if (!guidedWizardSectionIds.value.length) {
      toast.error($t("providers.ai_radio.validation.select_section"));
      guidedWizardStep.value = 2;
      return null;
    }

    creatingGuidedStation.value = true;
    try {
      const draft = normalizeStationDraft(createStationDraftFromTemplate());
      const { provider, itemId } = splitPlaylistSelectValue(
        guidedWizardSourcePlaylistSelectValue.value,
      );
      draft.name = guidedWizardStationName.value.trim();
      draft.id = slugify(draft.name);
      draft.source_playlist_provider = provider;
      draft.source_playlist_id = itemId;
      draft.default_player_id = guidedWizardDefaultPlayerId.value;

      const sectionIds = [...guidedWizardSectionIds.value];
      if (
        guidedWizardMergeSectionId.value &&
        !sectionIds.includes(guidedWizardMergeSectionId.value)
      ) {
        sectionIds.push(guidedWizardMergeSectionId.value);
      }
      draft.section_ids = sectionIds;
      draft.merge_section_id = guidedWizardMergeSectionId.value;
      draft.section_order = buildGuidedSectionOrder(sectionIds);

      const payload = buildStationPayload(draft);
      const localError = validateStationDraftLocal(payload);
      if (localError) {
        toast.error(localError);
        return null;
      }

      const saved = await saveStation(payload);
      adoptStation(saved);
      selectedRunStationId.value = saved.id;
      applyRunStationDefaults(saved.id);
      guidedWizardOpen.value = false;
      toast.success($t("providers.ai_radio.toast.station_created"));
      return saved;
    } catch (error) {
      toast.error(
        $t("providers.ai_radio.toast.guided_station_create_failed", [
          errorMessage(error),
        ]),
      );
      return null;
    } finally {
      creatingGuidedStation.value = false;
    }
  };

  return {
    guidedWizardOpen,
    guidedWizardStep,
    creatingGuidedStation,
    guidedWizardStationName,
    guidedWizardSourcePlaylistSelectValue,
    guidedWizardDefaultPlayerId,
    guidedWizardSectionIds,
    guidedWizardMergeSectionId,
    guidedWizardSectionPlacements,
    creatingGuidedSection,
    guidedNewSectionName,
    guidedNewSectionPrompt,
    guidedNewSectionPlacement,
    wizardSelectableSections,
    guidedWizardSelectedSections,
    guidedWizardMergeSectionOptions,
    guidedWizardSelectedSectionNames,
    guidedWizardMergeSectionName,
    guidedWizardSectionPlacementSummary,
    guidedWizardSourcePlaylistLabel,
    canProceedGuidedWizardStep,
    openGuidedStationCreator,
    onGuidedSectionToggle,
    setGuidedSectionPlacement,
    createGuidedSection,
    createGuidedStation,
  };
}
