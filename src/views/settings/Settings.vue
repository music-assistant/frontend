<template>
  <div>
    <Toolbar icon="mdi-cog-outline" :show-loading="true">
      <template #title>
        <v-breadcrumbs :items="breadcrumbItems" class="pa-0" /> </template
    ></Toolbar>

    <v-divider />

    <Container
      v-if="isOverview"
      variant="comfortable"
      class="settings-overview"
    >
      <v-card class="settings-main-card">
        <v-list class="settings-list">
          <v-list-item
            v-for="section in settingsSections"
            :key="section.name"
            :ripple="true"
            class="settings-list-item"
            @click="router.push(section.route)"
          >
            <template #prepend>
              <v-avatar :color="section.color" size="48">
                <v-icon :icon="section.icon" size="24" color="white" />
              </v-avatar>
            </template>

            <v-list-item-title class="text-h6">
              {{ t(section.label) }}
            </v-list-item-title>

            <v-list-item-subtitle>
              {{ t(section.description) }}
            </v-list-item-subtitle>

            <template #append>
              <v-icon icon="mdi-chevron-right" />
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </Container>

    <!-- Settings Subsections -->
    <router-view v-else v-slot="{ Component }" app>
      <component :is="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import Toolbar from "@/components/Toolbar.vue";
import { authManager } from "@/plugins/auth";
import { match } from "ts-pattern";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();
const { t } = useI18n();

const allSettingsSections = [
  {
    name: "profile",
    label: "auth.profile",
    description: "settings.profile_description",
    icon: "mdi-account-cog",
    color: "indigo",
    route: { name: "profile" },
    adminOnly: false,
  },
  {
    name: "providers",
    label: "settings.providers",
    description: "settings.providers_description",
    icon: "mdi-monitor-dashboard",
    color: "blue",
    route: { name: "providersettings" },
    adminOnly: true,
  },
  {
    name: "players",
    label: "settings.players",
    description: "settings.players_description",
    icon: "mdi-speaker-multiple",
    color: "green",
    route: { name: "playersettings" },
    adminOnly: true,
  },
  {
    name: "core",
    label: "settings.system",
    description: "settings.system_description",
    icon: "mdi-server",
    color: "purple",
    route: { name: "coresettings" },
    adminOnly: true,
  },
  {
    name: "frontend",
    label: "settings.frontend",
    description: "settings.frontend_description",
    icon: "mdi-palette",
    color: "orange",
    route: { name: "frontendsettings" },
    adminOnly: false,
  },
  {
    name: "users",
    label: "auth.user_management",
    description: "settings.users_description",
    icon: "mdi-account-multiple",
    color: "teal",
    route: { name: "usersettings" },
    adminOnly: true,
  },
];

const settingsSections = computed(() => {
  const isAdmin = authManager.isAdmin();
  return allSettingsSections.filter((section) => !section.adminOnly || isAdmin);
});

// computed properties
const isOverview = computed(() => {
  return router.currentRoute.value.name === "settings";
});

const activeTab = computed(() => {
  const name = router.currentRoute.value.name?.toString() || "";
  if (name === "profile") {
    return "profile";
  }
  if (name.includes("player")) {
    return "players";
  }
  if (name.includes("core")) {
    return "core";
  }
  if (name.includes("frontend")) {
    return "frontend";
  }
  if (name.includes("user")) {
    return "users";
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
      to: { name: "settings" },
    },
  ];

  if (!isOverview.value) {
    const currentTab = activeTab.value;
    if (currentTab === "profile") {
      items.push({
        title: t("auth.profile"),
        disabled: name === "profile",
        to: { name: "profile" },
      });
    } else if (currentTab === "players") {
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
    } else if (currentTab === "users") {
      items.push({
        title: t("settings.users"),
        disabled: name === "usersettings",
        to: { name: "usersettings" },
      });
    } else if (currentTab === "providers") {
      items.push({
        title: t("settings.providers"),
        disabled: name === "providersettings",
        to: { name: "providersettings" },
      });
    }
  }

  match(name)
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

<style scoped>
.settings-overview {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-main-card {
  overflow: hidden;
}

.settings-list {
  padding: 0;
}

.settings-list-item {
  cursor: pointer;
  padding: 20px 24px;
  min-height: 80px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.settings-list-item:last-child {
  border-bottom: none;
}

.settings-list-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.settings-list-item :deep(.v-list-item__prepend) {
  margin-right: 16px;
}

.v-avatar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
