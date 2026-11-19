<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsHubHeader name="system" />
    <UnsupportedInstallBanner />
    <SettingsTiles :tiles="tiles" test-id-prefix="system" />
  </div>
</template>

<script setup lang="ts">
import SettingsHubHeader from "@/components/settings/SettingsHubHeader.vue";
import SettingsTiles, {
  type SettingsTile,
} from "@/components/settings/SettingsTiles.vue";
import UnsupportedInstallBanner from "@/components/UnsupportedInstallBanner.vue";
import { coreModuleName } from "@/helpers/core_modules";
import type { SettingsColor } from "@/helpers/settings_colors";
import { coreOwner, isKnownOwner } from "@/helpers/settings_pages";
import { api } from "@/plugins/api";
import { Scope, type CoreConfig } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import {
  HardDrive,
  House,
  ListChecks,
  Network,
  Settings2,
  Stethoscope,
} from "@lucide/vue";
import { computed, markRaw, onMounted, ref, type Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

/**
 * The hub for running the server: a tile for each page about the server, and
 * one for the settings of a core module that no settings page shows.
 */

interface SystemPage {
  key: string;
  icon: Component;
  color: SettingsColor;
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
    color: "blue",
    label: "settings.network.title",
    description: "settings.network.description",
    route: { name: "networksettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    key: "storage",
    icon: HardDrive,
    color: "orange",
    label: "settings.storage.title",
    description: "settings.storage.description",
    route: { name: "storagesettings" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    key: "home_assistant",
    icon: House,
    color: "cyan",
    label: "settings.home_assistant.title",
    description: "settings.home_assistant.description",
    route: { name: "homeassistantsettings" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    key: "background_tasks",
    icon: ListChecks,
    color: "green",
    label: "background_tasks.title",
    description: "background_tasks.description",
    route: { name: "backgroundtasks" },
    requiresScope: Scope.SYSTEM_READ,
  },
  {
    key: "diagnostics",
    icon: Stethoscope,
    color: "red",
    label: "settings.diagnostics",
    description: "settings.diagnostics_description",
    route: { name: "diagnostics" },
    requiresScope: Scope.SYSTEM_MANAGE,
  },
];

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
  ...SYSTEM_PAGES.filter((page) =>
    authManager.hasScope(page.requiresScope),
  ).map((page) => ({
    key: page.key,
    icon: markRaw(page.icon),
    color: page.color,
    label: $t(page.label),
    description: $t(page.description),
    to: page.route,
  })),
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
