<template>
  <section class="genre-management">
    <!-- Header card -->
    <v-card class="header-card mb-4" elevation="0">
      <div class="header-content">
        <div class="header-icon">
          <v-icon size="32" color="primary">mdi-tag-multiple</v-icon>
        </div>
        <div class="header-info">
          <h2 class="header-title">
            {{ $t("settings.genre_management") }}
          </h2>
          <p class="header-description">
            {{ $t("settings.genre_management_description") }}
          </p>
        </div>
      </div>
    </v-card>

    <!-- Sections as expansion panels (matching EditConfig style) -->
    <v-expansion-panels v-model="activePanels" multiple class="config-panels">
      <!-- Genre Statistics -->
      <v-expansion-panel value="statistics" class="config-panel">
        <v-expansion-panel-title class="config-panel-title">
          <v-icon icon="mdi-chart-bar" class="mr-3" size="20" />
          <span class="panel-title-text">
            {{ $t("settings.genre_statistics") }}
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="config-panel-content">
            <div class="stats-row">
              <span class="text-medium-emphasis">{{
                $t("settings.total_genres")
              }}</span>
              <span class="font-weight-bold">{{ genreCount ?? "..." }}</span>
            </div>
            <v-btn
              class="mt-4"
              variant="outlined"
              color="primary"
              prepend-icon="mdi-tag-multiple"
              @click="router.push({ name: 'genres' })"
            >
              {{ $t("settings.view_all_genres") }}
            </v-btn>
          </div>
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
          <div class="config-panel-content">
            <p class="text-body-2 text-medium-emphasis mb-4">
              {{ $t("settings.restore_missing_defaults_description") }}
            </p>
            <v-btn
              variant="outlined"
              color="primary"
              prepend-icon="mdi-refresh"
              :loading="restoreInProgress"
              :disabled="restoreInProgress || fullRestoreInProgress"
              @click="showRestoreDialog = true"
            >
              {{ $t("settings.restore_missing_defaults") }}
            </v-btn>
          </div>
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
          <div class="config-panel-content">
            <p class="text-body-2 text-medium-emphasis mb-4">
              {{ $t("settings.full_restore_genres_description") }}
            </p>
            <v-btn
              variant="outlined"
              color="error"
              prepend-icon="mdi-alert"
              :loading="fullRestoreInProgress"
              :disabled="restoreInProgress || fullRestoreInProgress"
              @click="showFullRestoreDialog = true"
            >
              {{ $t("settings.full_restore_genres") }}
            </v-btn>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Restore Missing Defaults confirmation -->
    <v-dialog v-model="showRestoreDialog" max-width="520">
      <v-card>
        <Toolbar :title="$t('settings.restore_missing_defaults')" />
        <v-divider />
        <v-card-text>
          <p>{{ $t("settings.confirm_restore_defaults") }}</p>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showRestoreDialog = false">
              {{ $t("cancel") }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :loading="restoreInProgress"
              @click="restoreDefaults"
            >
              {{ $t("settings.restore_missing_defaults") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Full Restore confirmation (step 1) -->
    <v-dialog v-model="showFullRestoreDialog" max-width="520">
      <v-card>
        <Toolbar :title="$t('settings.full_restore_genres')" />
        <v-divider />
        <v-card-text>
          <p>{{ $t("settings.confirm_full_restore") }}</p>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showFullRestoreDialog = false">
              {{ $t("cancel") }}
            </v-btn>
            <v-btn color="error" variant="flat" @click="showFullRestoreStep2">
              {{ $t("delete") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Full Restore confirmation (step 2) -->
    <v-dialog v-model="showFullRestoreDialog2" max-width="520">
      <v-card>
        <Toolbar :title="$t('settings.full_restore_genres')" />
        <v-divider />
        <v-card-text>
          <p>{{ $t("settings.confirm_full_restore_2") }}</p>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showFullRestoreDialog2 = false">
              {{ $t("cancel") }}
            </v-btn>
            <v-btn
              color="error"
              variant="flat"
              :loading="fullRestoreInProgress"
              @click="fullRestore"
            >
              {{ $t("delete") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Result snackbar -->
    <v-snackbar v-model="showResult" :timeout="5000" color="success">
      {{ resultMessage }}
    </v-snackbar>
  </section>
</template>

<script setup lang="ts">
import Toolbar from "@/components/Toolbar.vue";
import { api } from "@/plugins/api";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();

const activePanels = ref(["statistics", "restore", "fullrestore"]);
const genreCount = ref<number | undefined>(undefined);
const restoreInProgress = ref(false);
const fullRestoreInProgress = ref(false);
const showRestoreDialog = ref(false);
const showFullRestoreDialog = ref(false);
const showFullRestoreDialog2 = ref(false);
const showResult = ref(false);
const resultMessage = ref("");

const loadStats = async () => {
  genreCount.value = await api.getLibraryGenresCount();
};

const restoreDefaults = async () => {
  restoreInProgress.value = true;
  try {
    const restored = await api.restoreGenreDefaults(false);
    showRestoreDialog.value = false;
    if (restored.length === 0) {
      resultMessage.value = t("settings.restore_all_present");
    } else {
      resultMessage.value = t("settings.restore_success", [restored.length]);
    }
    showResult.value = true;
    await loadStats();
  } catch (error) {
    console.error("Failed to restore genre defaults:", error);
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
    resultMessage.value = t("settings.full_restore_success", [restored.length]);
    showResult.value = true;
    await loadStats();
  } catch (error) {
    console.error("Failed to perform full genre restore:", error);
  } finally {
    fullRestoreInProgress.value = false;
  }
};

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.genre-management {
  padding: 16px;
}

.header-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
}

.header-content {
  display: flex;
  gap: 20px;
  padding: 24px;
}

.header-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--v-theme-on-surface));
}

.header-description {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
  line-height: 1.5;
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

.config-panel-content {
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
