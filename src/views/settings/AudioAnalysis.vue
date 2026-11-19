<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="audio_analysis" />
    <template v-if="canManageAnalysis">
      <AudioAnalysisCoverage />
      <AudioAnalysisFailures />
    </template>
    <CommunityMovedTypeNotice :type="ProviderType.AUDIO_ANALYSIS" />
    <ProviderList
      :type="ProviderType.AUDIO_ANALYSIS"
      :title="$t('settings.audio_analysis_modules')"
    />
    <SettingsPageForm v-if="canManageAnalysis" page="audio_analysis" />
  </div>
</template>

<script setup lang="ts">
import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";
import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";

/**
 * The audio analysis on one page: how far the analysis of the library is, the
 * tracks that failed, the analysis modules and the settings of the analysis.
 */

// the analysis itself is server management, the modules are not
const canManageAnalysis = authManager.hasScope(Scope.SYSTEM_MANAGE);
</script>
