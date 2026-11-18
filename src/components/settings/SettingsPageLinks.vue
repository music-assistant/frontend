<template>
  <SettingsLinkRows :rows="rows" test-id-prefix="settings-page" />
</template>

<script setup lang="ts">
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import { settingsSectionLinks } from "@/helpers/settings_pages";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * The rows a settings section shows above its list, each leading to a settings
 * page the current user may open. Renders nothing without rows.
 */
const props = defineProps<{
  // the name of the settings section
  section: string | undefined;
  // rows of the section itself, after the ones leading to its pages
  extraRows?: readonly SettingsRow[];
}>();

const rows = computed<SettingsRow[]>(() => [
  ...settingsSectionLinks(props.section, (scope) =>
    authManager.hasScope(scope),
  ).map(({ id, route, link }) => ({
    key: id,
    icon: link.icon,
    label: $t(link.label),
    description: $t(link.description),
    to: route,
  })),
  ...(props.extraRows ?? []),
]);
</script>
