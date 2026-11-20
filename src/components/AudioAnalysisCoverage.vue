<template>
  <SettingsFoldRow
    v-if="hasModules"
    value="progress"
    :icon="ChartNoAxesColumn"
    :label="$t('background_tasks.progress')"
    :description="$t('settings.audio_analysis_coverage.description')"
    :state="state"
  >
    <div v-if="!rows.length" class="flex justify-center py-6">
      <Spinner class="size-5" />
    </div>
    <div v-else class="space-y-2">
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
    </div>
  </SettingsFoldRow>
</template>

<script setup lang="ts">
import { useAudioAnalysisCoverage } from "@/composables/audio-analysis/useAudioAnalysisCoverage";
import { $t } from "@/plugins/i18n";
import { api } from "@/plugins/api";
import { ProviderType } from "@/plugins/api/interfaces";
import SettingsFoldRow from "@/components/settings/SettingsFoldRow.vue";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { ChartNoAxesColumn } from "@lucide/vue";
import { computed, onMounted, watch } from "vue";

/**
 * How far each analysis module has got, as a row of a `SettingsFoldRows` card.
 * Renders nothing while no analysis module is set up.
 */
const { rows, refresh } = useAudioAnalysisCoverage();

const none = $t("settings.audio_analysis_coverage.none");

const modules = computed(() =>
  Object.values(api.providers).filter(
    (provider) => provider.type === ProviderType.AUDIO_ANALYSIS,
  ),
);
// known from the providers right away, so the row doesn't pop in once the
// coverage has loaded
const hasModules = computed(() => modules.value.length > 0);

// nothing until the coverage of an available module is known; a track that an
// older version of a module analyzed counts as pending for it
const state = computed(() => {
  const available = rows.value.filter((row) => row.available);
  if (!available.length) return undefined;
  const busy = available.filter((row) => row.pending > 0).length;
  return busy
    ? $t("settings.audio_analysis_coverage.modules_busy", busy, {
        named: { count: busy },
      })
    : $t("settings.audio_analysis_coverage.up_to_date");
});

onMounted(() => {
  refresh();
});

// api.providers changes in place, so follow the modules and whether each is up
watch(
  () =>
    modules.value
      .map((provider) => `${provider.instance_id}:${provider.available}`)
      .join(),
  () => {
    refresh();
  },
);
</script>
