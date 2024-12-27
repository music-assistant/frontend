<template>
  <div>
    <Toolbar
      icon="mdi-cog-outline"
      :title="
        getBreakpointValue('bp4')
          ? `${$t('settings.settings')} | ${$t(`settings.${activeTab}`)}`
          : ''
      "
      :show-loading="true"
      :menu-items="[
        {
          label: 'settings.providers',
          icon: 'mdi-apps',
          action: () => {
            $router.push({ name: 'providersettings' });
          },
          active: activeTab == 'providers',
        },
        {
          label: 'settings.players',
          icon: 'mdi-speaker-multiple',
          action: () => {
            $router.push({ name: 'playersettings' });
          },
          active: activeTab == 'players',
        },
        {
          label: 'settings.core',
          icon: 'mdi-engine',
          action: () => {
            $router.push({ name: 'coresettings' });
          },
          active: activeTab == 'core',
        },
        {
          label: 'settings.frontend',
          icon: 'mdi-palette-advanced',
          action: () => {
            $router.push({ name: 'frontendsettings' });
          },
          active: activeTab == 'frontend',
        },
        {
          label: 'settings.client',
          icon: 'mdi-monitor',
          action: () => {
            $router.push({ name: 'clientsettings' });
          },
          active: activeTab == 'client',
        },
      ]"
    />

    <v-divider />
    <!-- some spacing -->
    <div style="height: 15px"></div>
    <router-view v-slot="{ Component }" app>
      <component :is="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import Toolbar from "@/components/Toolbar.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";

// global refs
const router = useRouter();

// computed properties
const activeTab = computed(() => {
  if (router.currentRoute.value.name?.toString().includes("player")) {
    return "players";
  }
  if (router.currentRoute.value.name?.toString().includes("core")) {
    return "core";
  }
  if (router.currentRoute.value.name?.toString().includes("frontend")) {
    return "frontend";
  }
  if (router.currentRoute.value.name?.toString().includes("client")) {
    return "client";
  }
  return "providers";
});
</script>
