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
import { match } from "ts-pattern";
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
  const route = router.currentRoute.value;
  const name = route.name?.toString() || "";

  const items: Array<{
    title: string;
    disabled: boolean;
    href?: string;
    to?: any;
  }> = [
    {
      title: t("settings.settings"),
      disabled: false,
      href: "#",
      to: { name: "providersettings" },
    },
  ];

  const currentTab = activeTab.value;
  if (currentTab === "players") {
    items.push({
      title: t("settings.players"),
      disabled: name === "playersettings",
      to: { name: "playersettings" },
    });
  } else if (currentTab === "core") {
    items.push({
      title: t("settings.core"),
      disabled: name === "coresettings",
      to: { name: "coresettings" },
    });
  } else if (currentTab === "frontend") {
    items.push({
      title: t("settings.frontend"),
      disabled: name === "frontendsettings",
      to: { name: "frontendsettings" },
    });
  } else {
    items.push({
      title: t("settings.providers"),
      disabled: name === "providersettings",
      to: { name: "providersettings" },
    });
  }

  match(name)
    .with("addprovider", () => {
      items.push({ title: t("settings.add_provider"), disabled: true });
    })
    .with("addproviderdetails", () => {
      items.push({
        title: t("settings.setup_provider", [route.params.domain || ""]),
        disabled: true,
      });
    })
    .with("editprovider", () => {
      items.push({
        title: t("settings.edit_provider", [route.params.instanceId || ""]),
        disabled: true,
      });
    })
    .with("addgroup", () => {
      items.push({ title: t("settings.add_group_player"), disabled: true });
    })
    .with("editplayer", () => {
      items.push({ title: t("settings.player_settings"), disabled: true });
    })
    .with("editcore", () => {
      items.push({ title: t("settings.settings"), disabled: true });
    })
    .otherwise(() => {
      return;
    });

  return items;
});
</script>
