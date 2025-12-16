<template>
  <Container>
    <v-card class="mb-4" elevation="0" variant="flat">
      <v-card-title class="text-subtitle-1 font-weight-bold py-3">
        <div
          class="d-flex flex-column flex-sm-row align-start align-sm-center ga-2 w-100"
        >
          <v-switch
            v-model="autoRefresh"
            color="primary"
            density="compact"
            hide-details
            :label="$t('settings.auto_refresh_log')"
          />
          <v-spacer class="d-none d-sm-block" />
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              color="primary"
              variant="text"
              :loading="refreshing"
              prepend-icon="mdi-refresh"
              size="small"
              @click="refreshLog"
            >
              {{ $t("settings.reload") }}
            </v-btn>
            <v-btn
              color="primary"
              variant="elevated"
              prepend-icon="mdi-download"
              size="small"
              @click="downloadLog"
            >
              {{ $t("settings.download_log") }}
            </v-btn>
          </div>
        </div>
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0">
        <div v-if="loading" class="pa-8 text-center">
          <v-progress-circular indeterminate color="primary" />
          <div class="mt-4">{{ $t("loading") }}</div>
        </div>
        <div v-else-if="error" class="pa-8 text-center">
          <v-icon
            icon="mdi-alert-circle"
            color="error"
            size="48"
            class="mb-4"
          />
          <div class="text-error">{{ error }}</div>
        </div>
        <div v-else-if="isTruncated" class="pa-4 text-center">
          <v-alert type="info" variant="tonal">
            {{ $t("settings.log_truncated", [maxLines]) }}
          </v-alert>
        </div>
        <div v-if="!loading && !error" ref="logContainer" class="log-container">
          <pre class="log-content">{{ displayContent }}</pre>
        </div>
      </v-card-text>
    </v-card>
  </Container>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import { api } from "@/plugins/api";
import { onMounted, onUnmounted, ref, watch, computed, nextTick } from "vue";

const logContent = ref("");
const loading = ref(true);
const refreshing = ref(false);
const error = ref("");
const autoRefresh = ref(true);
const logContainer = ref<HTMLDivElement | null>(null);
const maxLines = 150;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const displayContent = computed(() => {
  const lines = logContent.value.split("\n");
  if (lines.length > maxLines) {
    // Show last 150 lines
    return lines.slice(-maxLines).join("\n");
  }
  return logContent.value;
});

const isTruncated = computed(() => {
  const lines = logContent.value.split("\n");
  return lines.length > maxLines;
});

const scrollToBottom = () => {
  if (logContainer.value) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  }
};

const fetchLogs = async (isRefresh = false) => {
  try {
    if (!isRefresh) {
      loading.value = true;
    } else {
      refreshing.value = true;
    }
    error.value = "";
    const text = await api.sendCommand<string>("logging/get");
    const previousContent = logContent.value;
    logContent.value = text;

    // Scroll to bottom after content loads or updates
    if (!isRefresh || text !== previousContent) {
      // New data or initial load - scroll to bottom
      setTimeout(() => scrollToBottom(), 100);
    }
  } catch (e: any) {
    error.value = e.message || "Failed to load server logs";
    console.error("Error loading logs:", e);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

const refreshLog = () => {
  fetchLogs(true);
};

const downloadLog = async () => {
  try {
    const text = await api.sendCommand<string>("logging/get");
    const url = window.URL.createObjectURL(
      new Blob([text], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "music-assistant.log";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Error downloading log:", e);
  }
};

// Watch for auto-refresh toggle
watch(autoRefresh, (enabled) => {
  if (enabled) {
    // Refresh every 5 seconds
    refreshInterval = setInterval(() => {
      fetchLogs(true);
    }, 5000);
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
});

onMounted(async () => {
  await fetchLogs(false);
  // Start auto-refresh
  if (autoRefresh.value) {
    refreshInterval = setInterval(() => {
      fetchLogs(true);
    }, 5000);
  }
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.log-container {
  max-height: 600px;
  overflow: auto;
  background-color: rgba(var(--v-theme-surface-variant), 0.3);
}

.log-content {
  margin: 0;
  padding: 16px;
  font-family: "Courier New", Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: rgba(var(--v-theme-on-surface), 0.87);
}

/* Style for dark mode */
@media (prefers-color-scheme: dark) {
  .log-container {
    background-color: rgba(0, 0, 0, 0.3);
  }
}
</style>
