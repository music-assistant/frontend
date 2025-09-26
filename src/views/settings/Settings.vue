<template>
  <div>
    <Toolbar
      icon="mdi-cog-outline"
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
    >
      <template #title>
        <v-breadcrumbs :items="breadcrumbItems" class="pa-0" /> </template
    ></Toolbar>

    <v-divider />
    <router-view v-slot="{ Component }" app>
      <component :is="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import Toolbar from "@/components/Toolbar.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();
const { t } = useI18n();

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

const breadcrumbItems = computed(() => {
  const items = [
    {
      title: t("settings.settings"),
      disabled: false,
      href: "#",
      to: { name: "providersettings" },
    },
  ];

  const currentTab = activeTab.value;
  if (currentTab) {
    items.push({
      title: t(`settings.${currentTab}`),
      disabled: true,
      href: "#",
      to: { name: "providersettings" },
    });
  }

  return items;
});
</script>
