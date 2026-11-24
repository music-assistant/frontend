<template>
  <div
    v-if="coverage?.available && coverage.hasData"
    class="flex max-w-sm flex-col gap-1"
    data-testid="aa-module-progress"
  >
    <div class="flex items-center gap-2">
      <Progress :model-value="coverage.coveragePct" class="h-1.5" />
      <span
        class="text-muted-foreground text-xs tabular-nums"
        data-testid="aa-module-progress-pct"
      >
        {{ coverage.coveragePct }}%
      </span>
    </div>
    <span
      class="text-muted-foreground text-xs"
      data-testid="aa-module-progress-state"
    >
      {{ state }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { Progress } from "@/components/ui/progress";
import type { ProviderCoverageRow } from "@/composables/audio-analysis/useAudioAnalysisCoverage";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * How far the analysis of a module has got, with the number of tracks still
 * waiting. Renders nothing for a module that is not available or has no
 * tracks to analyze.
 */
const props = defineProps<{
  // the coverage of the module; omitted while it is not known
  coverage?: ProviderCoverageRow;
}>();

const state = computed(() => {
  const pending = props.coverage?.pending ?? 0;
  return pending
    ? $t("settings.audio_analysis_coverage.waiting", pending, {
        named: { count: pending },
      })
    : $t("settings.audio_analysis_coverage.up_to_date");
});
</script>
