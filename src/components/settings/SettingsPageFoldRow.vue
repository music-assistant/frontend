<template>
  <SettingsFoldRow
    v-if="canEdit"
    v-slot="{ open }"
    value="settings"
    :icon="Settings2"
    :label="label ?? $t('settings.settings')"
    :description="description"
  >
    <SettingsPageForm :page="page" flat @reset="open" />
  </SettingsFoldRow>
</template>

<script setup lang="ts">
import SettingsFoldRow from "@/components/settings/SettingsFoldRow.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import {
  canEditSettingsPage,
  type SettingsPageId,
} from "@/helpers/settings_pages";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Settings2 } from "@lucide/vue";

/**
 * The settings of a settings page as a row of a `SettingsFoldRows` card, for a
 * user who may change them. Resetting them from the menu of the page opens the
 * row, so the reset values and their Save are in view.
 */
const props = defineProps<{
  page: SettingsPageId;
  description: string;
  // "Settings" by default
  label?: string;
}>();

const canEdit = canEditSettingsPage(props.page, (scope) =>
  authManager.hasScope(scope),
);
</script>
