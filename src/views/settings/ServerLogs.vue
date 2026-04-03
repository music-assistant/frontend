<template>
  <div class="flex h-full flex-col p-6 pb-40">
    <Card class="flex flex-1 flex-col gap-0 overflow-hidden py-0 min-h-0">
      <CardHeader class="shrink-0 border-b px-6 py-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Switch id="auto-refresh" v-model:checked="autoRefresh" />
            <Label class="cursor-pointer" for="auto-refresh">
              {{ $t("settings.auto_refresh_log") }}
            </Label>
          </div>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="refreshing"
              @click="refreshLog"
            >
              <RefreshCw class="size-4" />
              {{ $t("settings.reload") }}
            </Button>
            <Button size="sm" @click="downloadLog">
              <Download class="size-4" />
              {{ $t("settings.download_log") }}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent class="p-0">
        <div
          v-if="loading"
          class="flex flex-col items-center justify-center gap-4 p-8"
        >
          <Spinner class="size-8" />
          <p class="text-sm text-muted-foreground">{{ $t("loading") }}</p>
        </div>

        <div
          v-else-if="error"
          class="flex flex-col items-center justify-center gap-4 p-8"
        >
          <AlertCircle class="size-12 text-destructive" />
          <p class="text-sm text-destructive">{{ error }}</p>
        </div>

        <template v-else>
          <div v-if="isTruncated" class="px-4 pt-4">
            <div
              class="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
            >
              {{ $t("settings.log_truncated", [maxLines]) }}
            </div>
          </div>
          <div ref="logContainer" class="log-container">
            <pre class="log-content">{{ displayContent }}</pre>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, Download, RefreshCw } from "lucide-vue-next";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { api } from "@/plugins/api";

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

    if (!isRefresh || text !== previousContent) {
      setTimeout(() => scrollToBottom(), 100);
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "Failed to load server logs";
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

watch(autoRefresh, (enabled) => {
  if (enabled) {
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
  margin-top: 16px;
}

.log-content {
  margin: 0;
  padding: 16px;
  font-family: "Courier New", Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
