<template>
  <div class="space-y-6 p-6">
    <GenreManagementHeader />

    <!-- Genre Library Administration -->
    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <ChartGantt class="size-4 text-primary" />
          <CardTitle>{{ $t("settings.genre_statistics") }}</CardTitle>
        </div>
        <CardDescription>{{
          $t("settings.genre_statistics_description")
        }}</CardDescription>
      </CardHeader>
      <CardContent class="p-0">
        <GenreTable
          :version="tableVersion"
          @data-changed="onTableDataChanged"
        />
      </CardContent>
    </Card>

    <!-- Restore Options -->
    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <RefreshCw class="size-4 text-primary" />
          <CardTitle>{{ $t("settings.restore_genres") }}</CardTitle>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <p class="text-sm font-semibold">
            {{ $t("settings.restore_missing_defaults") }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t("settings.restore_missing_defaults_description") }}
          </p>
          <GenreRestorePanel
            :button-text="$t('settings.restore_missing_defaults')"
            :loading="restoreInProgress || fullRestoreInProgress"
            @restore="showRestoreDialog = true"
          />
        </div>

        <Separator />

        <div class="space-y-2">
          <p class="text-sm font-semibold">
            {{ $t("settings.full_restore_genres") }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t("settings.full_restore_genres_description") }}
          </p>
          <GenreRestorePanel
            :button-text="$t('settings.full_restore_genres')"
            :loading="restoreInProgress || fullRestoreInProgress"
            destructive
            @restore="showFullRestoreDialog = true"
          />
        </div>
      </CardContent>
    </Card>

    <GenreRestoreDialogs
      v-model:show-restore-dialog="showRestoreDialog"
      v-model:show-full-restore-dialog="showFullRestoreDialog"
      v-model:show-full-restore-dialog2="showFullRestoreDialog2"
      v-model:restore-content-type="restoreContentType"
      :content-type-options="restoreContentTypeOptions"
      :restore-in-progress="restoreInProgress"
      :full-restore-in-progress="fullRestoreInProgress"
      @restore="restoreDefaults"
      @full-restore-step2="showFullRestoreStep2"
      @full-restore="fullRestore"
    />
  </div>
</template>

<script setup lang="ts">
import { ChartGantt, RefreshCw } from "@lucide/vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

import GenreManagementHeader from "@/components/genre/GenreManagementHeader.vue";
import GenreRestoreDialogs from "@/components/genre/GenreRestoreDialogs.vue";
import GenreRestorePanel from "@/components/genre/GenreRestorePanel.vue";
import GenreTable from "@/components/genre/GenreTable.vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

const { t } = useI18n();

const tableVersion = ref(0);
const restoreInProgress = ref(false);
const fullRestoreInProgress = ref(false);
const showRestoreDialog = ref(false);
const showFullRestoreDialog = ref(false);
const showFullRestoreDialog2 = ref(false);

// Targeted, non-destructive restore: restore only the chosen taxonomy's defaults.
const restoreContentType = ref<"all" | "music" | "podcast" | "audiobook">(
  "all",
);
const restoreContentTypeOptions = [
  { value: "all", label: t("genre_content_type.all") },
  { value: "music", label: t("genre_content_type.music") },
  { value: "podcast", label: t("genre_content_type.podcasts") },
  { value: "audiobook", label: t("genre_content_type.audiobooks") },
];

const restoreDefaults = async () => {
  restoreInProgress.value = true;
  try {
    const restored = await api.restoreGenreDefaults(
      false,
      restoreContentType.value,
    );
    showRestoreDialog.value = false;
    if (restored.length === 0) {
      toast.info(t("settings.restore_all_present"));
    } else {
      toast.success(t("settings.restore_success", [restored.length]));
    }
    if (store.prevState?.path === "librarygenres") {
      store.prevState = undefined;
    }
    tableVersion.value++;
  } catch (error) {
    toast.error(t("settings.restore_defaults_failed"));
  } finally {
    restoreInProgress.value = false;
  }
};

const showFullRestoreStep2 = () => {
  showFullRestoreDialog.value = false;
  showFullRestoreDialog2.value = true;
};

const fullRestore = async () => {
  fullRestoreInProgress.value = true;
  try {
    const restored = await api.restoreGenreDefaults(true);
    showFullRestoreDialog2.value = false;
    toast.success(t("settings.full_restore_success", [restored.length]));
    if (store.prevState?.path === "librarygenres") {
      store.prevState = undefined;
    }
    tableVersion.value++;
  } catch (error) {
    toast.error(t("settings.full_restore_failed"));
  } finally {
    fullRestoreInProgress.value = false;
  }
};

const onTableDataChanged = async () => {
  store.libraryGenresCount = await api.getLibraryGenresCount();
  if (store.prevState?.path === "librarygenres") {
    store.prevState = undefined;
  }
};
</script>
