<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1
          class="inline-flex items-center text-2xl font-semibold tracking-tight"
        >
          <Sparkles class="mr-2 h-5 w-5" />
          {{ $t("providers.ai_radio.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ $t("providers.ai_radio.header.subtitle") }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" @click="tutorialOpen = true">
          {{ $t("providers.ai_radio.actions.show_tutorial") }}
        </Button>
        <Button
          variant="outline"
          :disabled="isRefreshing"
          @click="handleRefresh"
        >
          {{
            isRefreshing
              ? $t("providers.ai_radio.actions.refreshing")
              : $t("providers.ai_radio.actions.refresh")
          }}
        </Button>
      </div>
    </header>

    <Tabs v-model:model-value="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-3 md:w-[480px]">
        <TabsTrigger value="run">{{
          $t("providers.ai_radio.tabs.run")
        }}</TabsTrigger>
        <TabsTrigger value="stations">{{
          $t("providers.ai_radio.tabs.stations")
        }}</TabsTrigger>
        <TabsTrigger value="sections">{{
          $t("providers.ai_radio.tabs.sections")
        }}</TabsTrigger>
      </TabsList>

      <TabsContent value="run" class="mt-4 space-y-4">
        <div class="grid gap-4 lg:grid-cols-2">
          <AiRadioRunCard />
          <AiRadioSessionsCard />
        </div>
      </TabsContent>

      <TabsContent value="stations" class="mt-4">
        <AiRadioStationsTab />
      </TabsContent>

      <TabsContent value="sections" class="mt-4">
        <AiRadioSectionsTab />
      </TabsContent>
    </Tabs>

    <AiRadioGuidedWizard @created="activeTab = 'run'" />
    <AiRadioTutorialDialog v-model:open="tutorialOpen" />
  </section>
</template>

<script setup lang="ts">
import AiRadioGuidedWizard from "@/components/ai-radio/AiRadioGuidedWizard.vue";
import AiRadioRunCard from "@/components/ai-radio/AiRadioRunCard.vue";
import AiRadioSectionsTab from "@/components/ai-radio/AiRadioSectionsTab.vue";
import AiRadioSessionsCard from "@/components/ai-radio/AiRadioSessionsCard.vue";
import AiRadioStationsTab from "@/components/ai-radio/AiRadioStationsTab.vue";
import AiRadioTutorialDialog from "@/components/ai-radio/AiRadioTutorialDialog.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiRadio } from "@/composables/ai-radio/useAiRadio";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import { useAiRadioRun } from "@/composables/ai-radio/useAiRadioRun";
import { useAiRadioSectionDraft } from "@/composables/ai-radio/useAiRadioSectionDraft";
import { useAiRadioStationDraft } from "@/composables/ai-radio/useAiRadioStationDraft";
import {
  errorMessage,
  getQueryValue,
  TUTORIAL_SEEN_STORAGE_KEY,
} from "@/helpers/ai_radio";
import { $t } from "@/plugins/i18n";
import { Sparkles } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";

const AUTO_REFRESH_MS = 5000;

const activeTab = ref<"run" | "stations" | "sections">("run");
const tutorialOpen = ref(false);

const route = useRoute();

const { loadingStatus, loadStatus } = useAiRadio();
const {
  stations,
  sections,
  loadingStations,
  loadingSections,
  loadingPlayers,
  loadingPlaylists,
  refreshEditor,
} = useAiRadioEditor();
const {
  selectedRunStationId,
  setSourcePlaylistOverride,
  resetSourcePlaylistOverride,
  applyRunStationDefaults,
} = useAiRadioRun();
const { selectedEditorStationId, selectStationForEdit, clearStationDraft } =
  useAiRadioStationDraft();
const { selectedEditorSectionId, selectSectionForEdit, clearSectionDraft } =
  useAiRadioSectionDraft();

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const isRefreshing = computed(() => {
  return (
    loadingStatus.value ||
    loadingStations.value ||
    loadingSections.value ||
    loadingPlayers.value ||
    loadingPlaylists.value
  );
});

const applyRouteOverrides = () => {
  const querySourcePlaylistId = getQueryValue(route.query.source_playlist_id);
  const querySourcePlaylistProvider = getQueryValue(
    route.query.source_playlist_provider,
  );
  const querySourcePlaylistName = getQueryValue(
    route.query.source_playlist_name,
  );

  if (querySourcePlaylistId && querySourcePlaylistProvider) {
    setSourcePlaylistOverride(
      querySourcePlaylistId,
      querySourcePlaylistProvider,
      querySourcePlaylistName,
    );
    activeTab.value = "run";
  } else {
    resetSourcePlaylistOverride();
  }

  const queryStationId = getQueryValue(route.query.station_id);
  if (
    queryStationId &&
    stations.value.some((station) => station.id === queryStationId)
  ) {
    selectedRunStationId.value = queryStationId;
    applyRunStationDefaults(queryStationId);
  } else if (!selectedRunStationId.value && stations.value.length > 0) {
    selectedRunStationId.value = stations.value[0].id;
    applyRunStationDefaults(stations.value[0].id);
  }
};

const handleRefresh = async () => {
  try {
    await Promise.all([refreshEditor(true), loadStatus(true)]);
    applyRouteOverrides();
    toast.success($t("providers.ai_radio.toast.data_refreshed"));
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.refresh_failed", [errorMessage(error)]),
    );
  }
};

onMounted(async () => {
  try {
    await Promise.all([refreshEditor(true), loadStatus(true)]);

    if (!localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY)) {
      tutorialOpen.value = true;
    }

    if (stations.value.length > 0) {
      if (!selectedEditorStationId.value) {
        await selectStationForEdit(stations.value[0].id);
      }
      if (!selectedRunStationId.value) {
        selectedRunStationId.value = stations.value[0].id;
        applyRunStationDefaults(stations.value[0].id);
      }
    }

    if (sections.value.length > 0 && !selectedEditorSectionId.value) {
      await selectSectionForEdit(sections.value[0].id);
    }

    applyRouteOverrides();

    refreshTimer = setInterval(() => {
      void loadStatus(true).catch(() => undefined);
    }, AUTO_REFRESH_MS);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.init_failed", [errorMessage(error)]),
    );
  }
});

watch(
  () => route.query,
  () => {
    applyRouteOverrides();
  },
);

watch(stations, async (nextStations) => {
  if (nextStations.length === 0) {
    clearStationDraft();
    selectedRunStationId.value = "";
    return;
  }

  if (
    selectedEditorStationId.value &&
    !nextStations.some(
      (station) => station.id === selectedEditorStationId.value,
    )
  ) {
    await selectStationForEdit(nextStations[0].id);
  }

  if (
    selectedRunStationId.value &&
    !nextStations.some((station) => station.id === selectedRunStationId.value)
  ) {
    selectedRunStationId.value = nextStations[0].id;
    applyRunStationDefaults(nextStations[0].id);
  }

  applyRouteOverrides();
});

watch(sections, async (nextSections) => {
  if (nextSections.length === 0) {
    clearSectionDraft();
    return;
  }

  if (
    selectedEditorSectionId.value &&
    !nextSections.some(
      (section) => section.id === selectedEditorSectionId.value,
    )
  ) {
    await selectSectionForEdit(nextSections[0].id);
  }
});

onBeforeUnmount(() => {
  if (!refreshTimer) {
    return;
  }
  clearInterval(refreshTimer);
  refreshTimer = null;
});
</script>
