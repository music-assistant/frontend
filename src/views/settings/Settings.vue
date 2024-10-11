<template>
  <div>
    <Toolbar
      icon="mdi-cog-outline"
      :title="$t('settings.settings')"
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
  return "providers";
});
</script>
