<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="system" />
    <UnsupportedInstallBanner />
    <SettingsTiles :tiles="tiles" test-id-prefix="system" />
  </div>
</template>

<script setup lang="ts">
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsTiles, {
  type SettingsTile,
} from "@/components/settings/SettingsTiles.vue";
import UnsupportedInstallBanner from "@/components/UnsupportedInstallBanner.vue";
import { coreModuleName } from "@/helpers/core_modules";
import { coreOwner, isKnownOwner } from "@/helpers/settings_pages";
import { sectionPages } from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import type { CoreConfig } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Settings2 } from "@lucide/vue";
import { computed, markRaw, onMounted, ref } from "vue";

/**
 * The hub for running the server: a tile for each page about the server, and
 * one for the settings of a core module that no settings page shows.
 */

const coreConfigs = ref<CoreConfig[]>([]);

// a module added on the server before any settings page shows it keeps its
// plain page, so its settings stay reachable
const unknownModuleTiles = computed<SettingsTile[]>(() =>
  coreConfigs.value
    .filter(({ domain }) => !isKnownOwner(coreOwner(domain)))
    .map(({ domain }) => ({
      key: `core_${domain}`,
      icon: markRaw(Settings2),
      color: "grey-darken-1" as const,
      label: coreModuleName(
        domain,
        (key) => $t(key),
        api.providerManifests[domain]?.name,
      ),
      description: api.providerManifests[domain]?.description ?? "",
      to: { name: "editcore", params: { domain } },
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

const tiles = computed<SettingsTile[]>(() => [
  ...sectionPages("system", (scope) => authManager.hasScope(scope)).map(
    (page) => ({
      key: page.key,
      icon: markRaw(page.icon),
      color: page.color,
      label: $t(page.label),
      description: $t(page.description),
      to: page.route,
    }),
  ),
  ...unknownModuleTiles.value,
]);

onMounted(async () => {
  try {
    coreConfigs.value = await api.getCoreConfigs();
  } catch {
    // the api reports the failure itself
  }
});
</script>
