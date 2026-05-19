<template>
  <div v-if="rows.length > 0" data-test="aa-coverage" class="aa-coverage">
    <div class="aa-coverage__header">
      <span class="aa-coverage__title">{{
        $t("settings.audio_analysis_coverage.title")
      }}</span>
      <button
        type="button"
        class="aa-coverage__refresh"
        :title="$t('settings.audio_analysis_coverage.refresh')"
        @click="refresh()"
      >
        <RefreshCw class="size-4" />
      </button>
    </div>
    <table class="aa-coverage__table">
      <thead>
        <tr>
          <th>{{ $t("settings.audio_analysis_coverage.col_provider") }}</th>
          <th>{{ $t("settings.audio_analysis_coverage.col_coverage") }}</th>
          <th class="right">
            {{ $t("settings.audio_analysis_coverage.col_pending") }}
          </th>
          <th class="right">
            {{ $t("settings.audio_analysis_coverage.col_stale") }}
          </th>
          <th class="right">
            {{ $t("settings.audio_analysis_coverage.col_version") }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.instanceId" data-test="aa-row">
          <td>
            <span
              class="aa-dot"
              :class="row.available ? 'aa-dot--ok' : 'aa-dot--muted'"
            ></span>
            <span>{{ row.name }}</span>
            <span class="aa-coverage__domain">{{ row.domain }}</span>
          </td>
          <td>
            <template v-if="row.hasData">
              <div class="aa-bar">
                <div
                  class="aa-bar__fill"
                  :style="{ width: row.coveragePct + '%' }"
                ></div>
              </div>
              <span class="aa-coverage__sub">
                {{ row.analyzed }} / {{ row.analyzed + row.pending }} ({{
                  row.coveragePct
                }}%)
              </span>
            </template>
            <span v-else class="aa-coverage__muted">
              {{
                row.available
                  ? none
                  : $t("settings.audio_analysis_coverage.unavailable")
              }}
            </span>
          </td>
          <td class="right">{{ row.hasData ? row.pending : none }}</td>
          <td class="right">{{ row.hasData ? row.staleVersion : none }}</td>
          <td class="right">
            {{ row.hasData ? "v" + row.analysisVersion : none }}
          </td>
        </tr>
      </tbody>
    </table>
    <div class="aa-coverage__scan">
      {{ $t("settings.audio_analysis_coverage.scan_label") }}:
      <template v-if="scan.unavailable">
        {{ $t("settings.audio_analysis_coverage.scan_unavailable") }}
      </template>
      <template v-else>
        {{ scan.status }} · last {{ scan.lastRun || none }} · next
        {{ scan.nextRun || none }}
        <template v-if="scan.failureCount > 0">
          ·
          {{
            $t("settings.audio_analysis_coverage.scan_failures", [
              scan.failureCount,
            ])
          }}
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAudioAnalysisCoverage } from "@/composables/useAudioAnalysisCoverage";
import { $t } from "@/plugins/i18n";
import { api } from "@/plugins/api";
import { TaskStatus } from "@/plugins/api/interfaces";
import { RefreshCw } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, watch } from "vue";

const { rows, scan, refresh, startAutoRefresh, stopAutoRefresh } =
  useAudioAnalysisCoverage();

const none = $t("settings.audio_analysis_coverage.none");

onMounted(async () => {
  await refresh();
  if (scan.value.status === TaskStatus.RUNNING) startAutoRefresh(5000);
});

watch(
  () => api.providers,
  () => {
    refresh();
  },
);

watch(
  () => scan.value.status,
  (s) => {
    if (s === TaskStatus.RUNNING) startAutoRefresh(5000);
  },
);

onBeforeUnmount(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.aa-coverage {
  margin-bottom: 16px;
}
.aa-coverage__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.aa-coverage__title {
  font-weight: 600;
}
.aa-coverage__refresh {
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
}
.aa-coverage__table {
  width: 100%;
  border-collapse: collapse;
}
.aa-coverage__table th,
.aa-coverage__table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  text-align: left;
}
.aa-coverage__table th.right,
.aa-coverage__table td.right {
  text-align: right;
}
.aa-coverage__domain {
  opacity: 0.6;
  font-size: 0.8em;
  margin-left: 6px;
}
.aa-coverage__sub {
  opacity: 0.7;
  font-size: 0.8em;
  margin-left: 6px;
}
.aa-coverage__muted,
.aa-coverage__scan {
  opacity: 0.6;
  font-size: 0.85em;
}
.aa-coverage__scan {
  margin-top: 6px;
}
.aa-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}
.aa-dot--ok {
  background: #2ecc71;
}
.aa-dot--muted {
  background: #888;
}
.aa-bar {
  display: inline-block;
  width: 120px;
  height: 8px;
  background: rgba(127, 127, 127, 0.25);
  border-radius: 4px;
  overflow: hidden;
  vertical-align: middle;
}
.aa-bar__fill {
  height: 100%;
  background: #7b68ee;
}
</style>
