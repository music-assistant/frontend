<template>
  <section class="genre-management">
    <GenreManagementHeader />

    <!-- Sections as expansion panels (matching EditConfig style) -->
    <v-expansion-panels v-model="activePanels" multiple class="config-panels">
      <!-- Background Scanner -->
      <v-expansion-panel value="scanner" class="config-panel">
        <v-expansion-panel-title class="config-panel-title">
          <v-icon icon="mdi-radar" class="mr-3" size="20" />
          <span class="panel-title-text">
            {{ $t("settings.background_scanner") }}
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <GenreScannerPanel
            :status="scannerStatus"
            :triggering="scanTriggering"
            @trigger="triggerScan"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Genre Statistics -->
      <v-expansion-panel value="statistics" class="config-panel">
        <v-expansion-panel-title class="config-panel-title">
          <v-icon icon="mdi-chart-bar" class="mr-3" size="20" />
          <span class="panel-title-text">
            {{ $t("settings.genre_statistics") }}
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <GenreStatsPanel
            :count="genreCount"
            @view-genres="router.push({ name: 'genres' })"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Restore Missing Defaults -->
      <v-expansion-panel value="restore" class="config-panel">
        <v-expansion-panel-title class="config-panel-title">
          <v-icon icon="mdi-refresh" class="mr-3" size="20" />
          <span class="panel-title-text">
            {{ $t("settings.restore_missing_defaults") }}
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <GenreRestorePanel
            :description="$t('settings.restore_missing_defaults_description')"
            :button-text="$t('settings.restore_missing_defaults')"
            :loading="restoreInProgress || fullRestoreInProgress"
            icon="mdi-refresh"
            @restore="showRestoreDialog = true"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Full Restore -->
      <v-expansion-panel value="fullrestore" class="config-panel">
        <v-expansion-panel-title class="config-panel-title">
          <v-icon icon="mdi-alert" class="mr-3" size="20" />
          <span class="panel-title-text">
            {{ $t("settings.full_restore_genres") }}
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <GenreRestorePanel
            :description="$t('settings.full_restore_genres_description')"
            :button-text="$t('settings.full_restore_genres')"
            :loading="restoreInProgress || fullRestoreInProgress"
            icon="mdi-alert"
            destructive
            @restore="showFullRestoreDialog = true"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <GenreRestoreDialogs
      v-model:show-restore-dialog="showRestoreDialog"
      v-model:show-full-restore-dialog="showFullRestoreDialog"
      v-model:show-full-restore-dialog2="showFullRestoreDialog2"
      :restore-in-progress="restoreInProgress"
      :full-restore-in-progress="fullRestoreInProgress"
      @restore="restoreDefaults"
      @full-restore-step2="showFullRestoreStep2"
      @full-restore="fullRestore"
    />
  </section>
</template>

<script setup lang="ts">
import GenreManagementHeader from "@/components/genre/GenreManagementHeader.vue";
import GenreRestoreDialogs from "@/components/genre/GenreRestoreDialogs.vue";
import GenreRestorePanel from "@/components/genre/GenreRestorePanel.vue";
import GenreScannerPanel from "@/components/genre/GenreScannerPanel.vue";
import GenreStatsPanel from "@/components/genre/GenreStatsPanel.vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

const SCANNER_POLL_INTERVAL_MS = 30000;

const { t } = useI18n();
const router = useRouter();

const activePanels = ref(["scanner", "statistics", "restore", "fullrestore"]);
const genreCount = ref<number | undefined>(undefined);
const restoreInProgress = ref(false);
const fullRestoreInProgress = ref(false);
const showRestoreDialog = ref(false);
const showFullRestoreDialog = ref(false);
const showFullRestoreDialog2 = ref(false);

// Scanner state
const scannerStatus = ref<{
  running: boolean;
  last_scan_time: number;
  last_scan_ago_seconds: number | null;
  last_scan_mapped: number | null;
} | null>(null);
const scanTriggering = ref(false);
let scannerPollInterval: ReturnType<typeof setInterval> | null = null;

const loadScannerStatus = async () => {
  try {
    scannerStatus.value = await api.getGenreScannerStatus();
  } catch (error) {
    toast.error(t("settings.scanner_status_failed"));
  }
};

const triggerScan = async () => {
  scanTriggering.value = true;
  try {
    const result = await api.triggerGenreScan();
    if (result.status === "already_running") {
      toast.info(t("settings.scan_already_running"));
    } else {
      toast.success(t("settings.scan_triggered"));
    }
    await loadScannerStatus();
  } catch (error) {
    toast.error(t("settings.scan_trigger_failed"));
  } finally {
    scanTriggering.value = false;
  }
};

const loadStats = async () => {
  genreCount.value = await api.getLibraryGenresCount();
};

const restoreDefaults = async () => {
  restoreInProgress.value = true;
  try {
    const restored = await api.restoreGenreDefaults(false);
    showRestoreDialog.value = false;
    if (restored.length === 0) {
      toast.info(t("settings.restore_all_present"));
    } else {
      toast.success(t("settings.restore_success", [restored.length]));
    }
    // Clear cached genre listing so it loads fresh data on next visit
    if (store.prevState?.path === "librarygenres") {
      store.prevState = undefined;
    }
    await loadStats();
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
    // Clear cached genre listing so it loads fresh data on next visit
    if (store.prevState?.path === "librarygenres") {
      store.prevState = undefined;
    }
    await loadStats();
  } catch (error) {
    toast.error(t("settings.full_restore_failed"));
  } finally {
    fullRestoreInProgress.value = false;
  }
};

onMounted(() => {
  loadStats();
  loadScannerStatus();
  scannerPollInterval = setInterval(
    loadScannerStatus,
    SCANNER_POLL_INTERVAL_MS,
  );
});

onBeforeUnmount(() => {
  if (scannerPollInterval) {
    clearInterval(scannerPollInterval);
    scannerPollInterval = null;
  }
});
</script>

<style scoped>
.genre-management {
  padding: 16px;
}

.config-panels {
  margin-top: 16px;
}

.config-panel {
  margin-bottom: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px !important;
  overflow: hidden;
}

.config-panel::before {
  display: none;
}

.config-panel-title {
  min-height: 52px;
  padding: 14px 20px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.config-panel-title .v-icon {
  color: rgb(var(--v-theme-primary));
}

.panel-title-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.config-panel :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
</style>
