<template>
  <SettingsTiles :tiles="tiles" test-id-prefix="settings-page" />
</template>

<script setup lang="ts">
import SettingsTiles, {
  type SettingsTile,
} from "@/components/settings/SettingsTiles.vue";
import { sectionPages } from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import type { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * The tiles a hub shows above its lists, each leading to a page below it that
 * the current user may open. Renders nothing without tiles.
 */
const props = defineProps<{
  // the key of the hub in the settings menu
  section: string | undefined;
}>();

const tiles = computed<SettingsTile[]>(() =>
  sectionPages(props.section, hasScope).map((page) => ({
    key: page.key,
    icon: page.icon,
    color: page.color,
    label: $t(page.label),
    description: $t(page.description),
    state: page.providerType ? activeProviders(page.providerType) : undefined,
    to: page.route,
  })),
);

function hasScope(scope: Scope): boolean {
  return authManager.hasScope(scope);
}

// how many providers of the type run
function activeProviders(type: ProviderType): string {
  const count = Object.values(api.providers).filter(
    (provider) => provider.type === type,
  ).length;
  return $t("settings.providers_active", count, { named: { count } });
}
</script>
