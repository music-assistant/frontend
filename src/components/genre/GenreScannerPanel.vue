<template>
  <div class="config-panel-content">
    <p class="text-body-2 text-medium-emphasis mb-4">
      {{ $t("settings.background_scanner_description") }}
    </p>
    <div class="stats-row">
      <span class="text-medium-emphasis">{{
        $t("settings.scanner_status")
      }}</span>
      <span class="font-weight-bold">
        <v-icon
          :icon="status?.running ? 'mdi-loading mdi-spin' : 'mdi-circle'"
          :color="status?.running ? 'primary' : 'success'"
          size="12"
          class="mr-1"
        />
        {{
          status?.running
            ? $t("settings.scanner_running")
            : $t("settings.scanner_idle")
        }}
      </span>
    </div>
    <div class="stats-row">
      <span class="text-medium-emphasis">{{ $t("settings.last_scan") }}</span>
      <span class="font-weight-bold">{{ lastScanDisplay }}</span>
    </div>
    <div class="stats-row">
      <span class="text-medium-emphasis">{{
        $t("settings.last_scan_mapped")
      }}</span>
      <span class="font-weight-bold">{{
        status?.last_scan_mapped != null ? status.last_scan_mapped : "..."
      }}</span>
    </div>
    <v-btn
      class="mt-4"
      variant="outlined"
      color="primary"
      prepend-icon="mdi-refresh"
      :loading="triggering"
      :disabled="triggering || status?.running"
      @click="$emit('trigger')"
    >
      {{ $t("settings.scan_now") }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { formatRelativeTime } from "@/helpers/utils";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface ScannerStatus {
  running: boolean;
  last_scan_time: number;
  last_scan_ago_seconds: number | null;
  last_scan_mapped: number | null;
}

interface Props {
  status: ScannerStatus | null;
  triggering: boolean;
}

const props = defineProps<Props>();
defineEmits<{ trigger: [] }>();

const { t } = useI18n();

const lastScanDisplay = computed(() => {
  if (!props.status) return "...";
  if (
    props.status.last_scan_ago_seconds === null ||
    !props.status.last_scan_time
  ) {
    return t("settings.scan_never");
  }
  return formatRelativeTime(props.status.last_scan_ago_seconds) + " ago";
});
</script>

<style scoped>
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
</style>
