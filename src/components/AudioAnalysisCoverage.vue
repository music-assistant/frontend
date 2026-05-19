<template>
  <Card v-if="rows.length > 0" data-test="aa-coverage">
    <CardHeader>
      <CardTitle>{{ $t("settings.audio_analysis_coverage.title") }}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      <Item
        v-for="row in rows"
        :key="row.instanceId"
        data-test="aa-row"
        variant="outline"
        size="sm"
        class="justify-between"
      >
        <ItemContent>
          <ItemTitle class="flex items-center gap-2">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="
                row.available ? 'bg-emerald-500' : 'bg-muted-foreground/40'
              "
            ></span>
            {{ row.name }}
          </ItemTitle>
          <ItemDescription class="font-mono text-xs">
            {{ row.domain }}
          </ItemDescription>
        </ItemContent>

        <ItemContent class="flex-none items-end gap-1.5 text-right">
          <template v-if="row.hasData">
            <div class="flex items-center gap-2">
              <Progress :model-value="row.coveragePct" class="w-28" />
              <span class="text-xs font-medium tabular-nums">
                {{ row.coveragePct }}%
              </span>
            </div>
            <span class="text-muted-foreground text-xs tabular-nums">
              {{ row.analyzed }} / {{ row.analyzed + row.pending }}
            </span>
            <div class="flex flex-wrap justify-end gap-1.5">
              <Badge variant="secondary" class="tabular-nums">
                {{ $t("settings.audio_analysis_coverage.col_pending") }}
                {{ row.pending }}
              </Badge>
              <Badge
                :variant="row.staleVersion > 0 ? 'warning' : 'secondary'"
                class="tabular-nums"
              >
                {{ $t("settings.audio_analysis_coverage.col_stale") }}
                {{ row.staleVersion }}
              </Badge>
              <Badge variant="outline" class="tabular-nums">
                v{{ row.analysisVersion }}
              </Badge>
            </div>
          </template>
          <Badge v-else variant="secondary">
            {{
              row.available
                ? none
                : $t("settings.audio_analysis_coverage.unavailable")
            }}
          </Badge>
        </ItemContent>
      </Item>
    </CardContent>
    <CardFooter class="text-muted-foreground text-xs">
      {{ $t("settings.audio_analysis_coverage.scan_label") }}:&nbsp;
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
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { useAudioAnalysisCoverage } from "@/composables/useAudioAnalysisCoverage";
import { $t } from "@/plugins/i18n";
import { api } from "@/plugins/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { onMounted, watch } from "vue";

const { rows, scan, refresh } = useAudioAnalysisCoverage();

const none = $t("settings.audio_analysis_coverage.none");

onMounted(() => {
  refresh();
});

watch(
  () => api.providers,
  () => {
    refresh();
  },
);
</script>
