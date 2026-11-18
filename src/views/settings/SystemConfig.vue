<template>
  <div class="space-y-6 p-6">
    <UnsupportedInstallBanner />
    <SettingsLinkRows :rows="rows" test-id-prefix="system" />
  </div>
</template>

<script setup lang="ts">
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import UnsupportedInstallBanner from "@/components/UnsupportedInstallBanner.vue";
import { coreModuleName } from "@/helpers/core_modules";
import { coreOwner, isKnownOwner } from "@/helpers/settings_pages";
import { api } from "@/plugins/api";
import { Scope, type CoreConfig } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { ListChecks, Network, Settings2, Stethoscope } from "@lucide/vue";
import { computed, markRaw, onMounted, ref, type Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

/**
 * The hub for running the server: a row for each page about the server, and
 * one for the settings of a core module that no settings page shows.
 */

interface SystemPage {
  key: string;
  icon: Component;
  label: string;
  description: string;
  route: RouteLocationRaw;
  // the scope the route of the page needs
  requiresScope: Scope;
}

// the pages of the hub, in display order
const SYSTEM_PAGES: readonly SystemPage[] = [
  {
    key: "network",
    icon: Network,
    label: "settings.network.title",
    description: "settings.network.description",
    route: { name: "networksettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    key: "background_tasks",
    icon: ListChecks,
    label: "background_tasks.title",
    description: "background_tasks.description",
    route: { name: "backgroundtasks" },
    requiresScope: Scope.SYSTEM_READ,
  },
  {
    key: "diagnostics",
    icon: Stethoscope,
    label: "settings.diagnostics",
    description: "settings.diagnostics_description",
    route: { name: "diagnostics" },
    requiresScope: Scope.SYSTEM_MANAGE,
  },
];

const coreConfigs = ref<CoreConfig[]>([]);

// a module added on the server before any settings page shows it keeps its
// plain page, so its settings stay reachable
const unknownModuleRows = computed<SettingsRow[]>(() =>
  coreConfigs.value
    .filter(({ domain }) => !isKnownOwner(coreOwner(domain)))
    .map(({ domain }) => ({
      key: `core_${domain}`,
      icon: markRaw(Settings2),
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

const rows = computed<SettingsRow[]>(() => [
  ...SYSTEM_PAGES.filter((page) =>
    authManager.hasScope(page.requiresScope),
  ).map((page) => ({
    key: page.key,
    icon: markRaw(page.icon),
    label: $t(page.label),
    description: $t(page.description),
    to: page.route,
  })),
  ...unknownModuleRows.value,
]);

onMounted(async () => {
  try {
    coreConfigs.value = await api.getCoreConfigs();
  } catch {
    // the api reports the failure itself
  }
});
</script>
