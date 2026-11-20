<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="audio_analysis" />
    <SettingsFoldRows v-if="canManageAnalysis || canEditSettings">
      <template v-if="canManageAnalysis">
        <AudioAnalysisCoverage />
        <AudioAnalysisFailures />
      </template>
      <SettingsPageFoldRow
        page="audio_analysis"
        :description="$t('settings.audio_analysis_settings_description')"
      />
    </SettingsFoldRows>
    <CommunityMovedTypeNotice :type="ProviderType.AUDIO_ANALYSIS" />
    <ProviderList
      :type="ProviderType.AUDIO_ANALYSIS"
      :title="$t('settings.audio_analysis_modules')"
    />
  </div>
</template>

<script setup lang="ts">
import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";
import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { canEditSettingsPage } from "@/helpers/settings_pages";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";

/**
 * The audio analysis on one page: how far the analysis of the library is, the
 * tracks that failed and the settings of the analysis, folded at the top, and
 * the analysis modules.
 */

// the analysis itself is server management, the modules are not
const canManageAnalysis = authManager.hasScope(Scope.SYSTEM_MANAGE);
const canEditSettings = canEditSettingsPage("audio_analysis", (scope) =>
  authManager.hasScope(scope),
);
</script>
