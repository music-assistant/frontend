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
        <Card v-if="showEmptyState">
          <CardContent
            class="flex flex-col items-center gap-3 py-12 text-center"
          >
            <Sparkles class="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 class="text-lg font-semibold">
                {{ $t("providers.ai_radio.empty.title") }}
              </h2>
              <p class="mt-1 max-w-md text-sm text-muted-foreground">
                {{ $t("providers.ai_radio.empty.description") }}
              </p>
            </div>
            <div class="flex flex-wrap justify-center gap-2">
              <Button @click="openGuidedStationCreator">
                <Sparkles class="mr-1 h-4 w-4" />
                {{ $t("providers.ai_radio.empty.cta") }}
              </Button>
              <Button variant="outline" @click="tutorialOpen = true">
                {{ $t("providers.ai_radio.actions.show_tutorial") }}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div v-else class="grid gap-4 lg:grid-cols-2">
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiRadio } from "@/composables/ai-radio/useAiRadio";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import { useAiRadioRun } from "@/composables/ai-radio/useAiRadioRun";
import { useAiRadioSectionDraft } from "@/composables/ai-radio/useAiRadioSectionDraft";
import { useAiRadioStationDraft } from "@/composables/ai-radio/useAiRadioStationDraft";
import { useAiRadioWizard } from "@/composables/ai-radio/useAiRadioWizard";
import { errorMessage, getQueryValue } from "@/helpers/ai_radio";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { Sparkles } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

const AUTO_REFRESH_MS = 5000;
// Without a running session, only refresh on every Nth tick.
const IDLE_REFRESH_TICKS = 6;

const activeTab = ref<"run" | "stations" | "sections">("run");
const tutorialOpen = ref(false);
const initialLoadDone = ref(false);

const route = useRoute();
const router = useRouter();

const { sessions, loadingStatus, loadStatus } = useAiRadio();
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
const {
  selectedEditorStationId,
  stationDraftDirty,
  selectStationForEdit,
  clearStationDraft,
} = useAiRadioStationDraft();
const {
  selectedEditorSectionId,
  sectionDraftDirty,
  selectSectionForEdit,
  clearSectionDraft,
} = useAiRadioSectionDraft();
const { openGuidedStationCreator } = useAiRadioWizard();

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshTick = 0;

const isRefreshing = computed(() => {
  return (
    loadingStatus.value ||
    loadingStations.value ||
    loadingSections.value ||
    loadingPlayers.value ||
    loadingPlaylists.value
  );
});

const showEmptyState = computed(() => {
  return initialLoadDone.value && stations.value.length === 0;
});

const hasRunningSession = computed(() => {
  return sessions.value.some((session) => session.status === "running");
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
    await Promise.all([refreshEditor(), loadStatus()]);
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
    await Promise.all([refreshEditor(), loadStatus()]);

    if (stations.value.length > 0) {
      if (!selectedEditorStationId.value) {
        await selectStationForEdit(stations.value[0].id, {
          skipDirtyCheck: true,
        });
      }
      if (!selectedRunStationId.value) {
        selectedRunStationId.value = stations.value[0].id;
        applyRunStationDefaults(stations.value[0].id);
      }
    }

    if (sections.value.length > 0 && !selectedEditorSectionId.value) {
      await selectSectionForEdit(sections.value[0].id, {
        skipDirtyCheck: true,
      });
    }

    applyRouteOverrides();

    refreshTimer = setInterval(() => {
      refreshTick += 1;
      if (hasRunningSession.value || refreshTick % IDLE_REFRESH_TICKS === 0) {
        void loadStatus().catch(() => undefined);
      }
    }, AUTO_REFRESH_MS);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.init_failed", [errorMessage(error)]),
    );
  } finally {
    initialLoadDone.value = true;
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
    await selectStationForEdit(nextStations[0].id, { skipDirtyCheck: true });
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
    await selectSectionForEdit(nextSections[0].id, { skipDirtyCheck: true });
  }
});

onBeforeRouteLeave((to) => {
  if (!stationDraftDirty.value && !sectionDraftDirty.value) {
    return true;
  }
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.confirm.discard_changes_title"),
    message: $t("providers.ai_radio.confirm.discard_changes"),
    confirmLabel: $t("providers.ai_radio.actions.discard"),
    onConfirm: () => {
      clearStationDraft();
      clearSectionDraft();
      void router.push(to.fullPath);
    },
  });
  return false;
});

onBeforeUnmount(() => {
  if (!refreshTimer) {
    return;
  }
  clearInterval(refreshTimer);
  refreshTimer = null;
});
</script>
