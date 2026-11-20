<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="metadata" />
    <SettingsFoldRows v-if="canEditSettings">
      <SettingsPageFoldRow
        page="metadata"
        :description="$t('settings.metadata_settings_description')"
      />
    </SettingsFoldRows>
    <CommunityMovedTypeNotice :type="ProviderType.METADATA" />
    <ProviderList :type="ProviderType.METADATA" />
  </div>
</template>

<script setup lang="ts">
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { canEditSettingsPage } from "@/helpers/settings_pages";
import { ProviderType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";

/**
 * The metadata on one page: the settings of the metadata, folded at the top,
 * and the metadata sources.
 */
const canEditSettings = canEditSettingsPage("metadata", (scope) =>
  authManager.hasScope(scope),
);
</script>
