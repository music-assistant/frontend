<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="audio_analysis" />
    <SettingsFoldRows v-if="canManageAnalysis || canEditSettings">
      <AudioAnalysisFailures v-if="canManageAnalysis" />
      <SettingsPageFoldRow
        page="audio_analysis"
        :description="$t('settings.audio_analysis_settings_description')"
      />
    </SettingsFoldRows>
    <CommunityMovedTypeNotice :type="ProviderType.AUDIO_ANALYSIS" />
    <ProviderList
      :type="ProviderType.AUDIO_ANALYSIS"
      :title="$t('settings.audio_analysis_modules')"
    >
      <template v-if="canManageAnalysis" #details="{ config }">
        <AudioAnalysisModuleProgress
          :coverage="coverageByModule.get(config.instance_id)"
        />
      </template>
    </ProviderList>
  </div>
</template>

<script setup lang="ts">
import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import AudioAnalysisModuleProgress from "@/components/AudioAnalysisModuleProgress.vue";
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { useAudioAnalysisCoverage } from "@/composables/audio-analysis/useAudioAnalysisCoverage";
import { canEditSettingsPage } from "@/helpers/settings_pages";
import { api } from "@/plugins/api";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { computed, onMounted, watch } from "vue";

/**
 * The audio analysis on one page: the tracks that failed and the settings of
 * the analysis, folded at the top, and the analysis modules with how far each
 * has got.
 */

// the analysis itself is server management, the modules are not
const canManageAnalysis = authManager.hasScope(Scope.SYSTEM_MANAGE);
const canEditSettings = canEditSettingsPage("audio_analysis", (scope) =>
  authManager.hasScope(scope),
);

const { rows: coverage, refresh: refreshCoverage } = useAudioAnalysisCoverage();

const coverageByModule = computed(
  () => new Map(coverage.value.map((row) => [row.instanceId, row])),
);

// api.providers changes in place, so follow the modules and whether each is up
const modulesState = computed(() =>
  Object.values(api.providers)
    .filter((provider) => provider.type === ProviderType.AUDIO_ANALYSIS)
    .map((provider) => `${provider.instance_id}:${provider.available}`)
    .join(),
);

if (canManageAnalysis) {
  onMounted(refreshCoverage);
  watch(modulesState, refreshCoverage);
}
</script>
