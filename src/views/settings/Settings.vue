<template>
  <div>
    <Toolbar :icon="Settings" :show-loading="true">
      <template #title>
        <v-breadcrumbs :items="breadcrumbItems" class="pa-0" />
      </template>
      <template #append>
        <v-btn
          v-if="isOverview"
          :icon="settingsViewMode === 'list' ? 'mdi-view-list' : 'mdi-grid'"
          variant="text"
          :title="t('tooltip.toggle_view_mode')"
          @click="toggleSettingsViewMode()"
        />
        <v-btn
          v-if="isPlayersPage"
          :icon="playersViewMode === 'list' ? 'mdi-view-list' : 'mdi-grid'"
          variant="text"
          :title="t('tooltip.toggle_view_mode')"
          @click="togglePlayersViewMode()"
        />
        <v-btn
          v-if="isProvidersPage"
          :icon="providersViewMode === 'list' ? 'mdi-view-list' : 'mdi-grid'"
          variant="text"
          :title="t('tooltip.toggle_view_mode')"
          @click="toggleProvidersViewMode()"
        />
        <v-btn
          v-if="documentationUrl"
          icon="mdi-help-circle"
          variant="text"
          :title="t('settings.view_documentation')"
          @click="openLinkInNewTab(documentationUrl)"
        />
      </template>
    </Toolbar>

    <v-divider />

    <Container
      v-if="isOverview"
      variant="comfortable"
      class="settings-overview"
    >
      <div v-if="settingsViewMode === 'card'" class="settings-card-view">
        <div class="settings-featured">
          <Card
            v-for="section in featuredSections"
            :key="section.name"
            class="setting-card"
            @click="router.push(section.route)"
          >
            <CardHeader class="setting-card-header">
              <div class="setting-header-top">
                <div
                  class="setting-icon"
                  :style="getIconBackgroundStyle(section.color)"
                >
                  <Icon :icon="section.icon" size="24" color="white" />
                </div>
                <div class="setting-chevron">
                  <Icon icon="mdi-chevron-right" size="20" />
                </div>
              </div>
              <CardTitle class="setting-title">
                {{ t(section.label) }}
              </CardTitle>
              <CardDescription class="setting-description">
                {{ t(section.description) }}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div class="settings-grid">
          <Card
            v-for="section in regularSections"
            :key="section.name"
            class="setting-card"
            @click="router.push(section.route)"
          >
            <CardHeader class="setting-card-header">
              <div class="setting-header-top">
                <div
                  class="setting-icon"
                  :style="getIconBackgroundStyle(section.color)"
                >
                  <Icon :icon="section.icon" size="24" color="white" />
                </div>
                <div class="setting-chevron">
                  <Icon icon="mdi-chevron-right" size="20" />
                </div>
              </div>
              <CardTitle class="setting-title">
                {{ t(section.label) }}
              </CardTitle>
              <CardDescription class="setting-description">
                {{ t(section.description) }}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div v-else class="settings-list-view">
        <v-list class="settings-list">
          <ListItem
            v-for="section in providersSection"
            :key="section.name"
            link
            class="settings-list-item"
            @click="router.push(section.route)"
          >
            <template #prepend>
              <div
                class="setting-list-icon"
                :style="getIconBackgroundStyle(section.color)"
              >
                <Icon :icon="section.icon" size="20" color="white" />
              </div>
            </template>
            <template #title>
              {{ t(section.label) }}
            </template>
            <template #subtitle>
              {{ t(section.description) }}
            </template>
            <template #append>
              <Icon icon="mdi-chevron-right" size="20" />
            </template>
          </ListItem>

          <ListItem
            v-for="section in playersSection"
            :key="section.name"
            link
            class="settings-list-item"
            @click="router.push(section.route)"
          >
            <template #prepend>
              <div
                class="setting-list-icon"
                :style="getIconBackgroundStyle(section.color)"
              >
                <Icon :icon="section.icon" size="20" color="white" />
              </div>
            </template>
            <template #title>
              {{ t(section.label) }}
            </template>
            <template #subtitle>
              {{ t(section.description) }}
            </template>
            <template #append>
              <Icon icon="mdi-chevron-right" size="20" />
            </template>
          </ListItem>

          <ListItem
            v-for="section in otherSettingsSections"
            :key="section.name"
            link
            class="settings-list-item"
            @click="router.push(section.route)"
          >
            <template #prepend>
              <div
                class="setting-list-icon"
                :style="getIconBackgroundStyle(section.color)"
              >
                <Icon :icon="section.icon" size="20" color="white" />
              </div>
            </template>
            <template #title>
              {{ t(section.label) }}
            </template>
            <template #subtitle>
              {{ t(section.description) }}
            </template>
            <template #append>
              <Icon icon="mdi-chevron-right" size="20" />
            </template>
          </ListItem>
        </v-list>
      </div>
    </Container>

    <router-view v-else v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import Icon from "@/components/Icon.vue";
import ListItem from "@/components/ListItem.vue";
import Toolbar from "@/components/Toolbar.vue";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUserPreferences } from "@/composables/userPreferences";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { Settings } from "lucide-vue-next";
import { match } from "ts-pattern";
import { computed, provide, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();
const { t } = useI18n();
const { getPreference, setPreference } = useUserPreferences();

const settingsViewMode = ref<"list" | "card">("card");
const savedSettingsViewMode = getPreference<"list" | "card">(
  "settings.overview.viewMode",
  "card",
);

watch(
  () => savedSettingsViewMode.value,
  (savedViewMode) => {
    if (savedViewMode === "list" || savedViewMode === "card") {
      settingsViewMode.value = savedViewMode;
    }
  },
  { immediate: true },
);

const toggleSettingsViewMode = function () {
  settingsViewMode.value = settingsViewMode.value === "list" ? "card" : "list";
  setPreference("settings.overview.viewMode", settingsViewMode.value);
};

const playersViewMode = ref<"list" | "card">("list");
const isPlayersPage = computed(() => {
  const name = router.currentRoute.value.name?.toString() || "";
  return name.includes("players") || name === "addgroup";
});

const savedPlayersViewMode = getPreference<"list" | "card">(
  "settings.players.viewMode",
  "list",
);

watch(
  () => savedPlayersViewMode.value,
  (savedViewMode) => {
    if (savedViewMode === "list" || savedViewMode === "card") {
      playersViewMode.value = savedViewMode;
    }
  },
  { immediate: true },
);

const togglePlayersViewMode = function () {
  playersViewMode.value = playersViewMode.value === "list" ? "card" : "list";
  setPreference("settings.players.viewMode", playersViewMode.value);
};

provide("playersViewMode", {
  viewMode: playersViewMode,
  toggleViewMode: togglePlayersViewMode,
});

const providersViewMode = ref<"list" | "card">("list");
const isProvidersPage = computed(() => {
  const name = router.currentRoute.value.name?.toString() || "";
  return name.includes("providers");
});

const savedProvidersViewMode = getPreference<"list" | "card">(
  "settings.providers.viewMode",
  "list",
);

watch(
  () => savedProvidersViewMode.value,
  (savedViewMode) => {
    if (savedViewMode === "list" || savedViewMode === "card") {
      providersViewMode.value = savedViewMode;
    }
  },
  { immediate: true },
);

const toggleProvidersViewMode = function () {
  providersViewMode.value =
    providersViewMode.value === "list" ? "card" : "list";
  setPreference("settings.providers.viewMode", providersViewMode.value);
};

provide("providersViewMode", {
  viewMode: providersViewMode,
  toggleViewMode: toggleProvidersViewMode,
});

const allSettingsSections = [
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
    name: "profile",
    label: "auth.profile",
    description: "settings.profile_description",
    icon: "mdi-account-cog",
    color: "indigo",
    route: { name: "profile" },
    adminOnly: false,
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
  {
    name: "remote_access",
    label: "settings.remote_access",
    description: "settings.remote_access_description",
    icon: "mdi-cloud-lock",
    color: "deep-purple",
    route: { name: "remoteaccesssettings" },
    adminOnly: true,
  },
  {
    name: "system",
    label: "settings.system",
    description: "settings.system_description",
    icon: "mdi-server",
    color: "purple",
    route: { name: "systemsettings" },
    adminOnly: true,
  },
  {
    name: "about",
    label: "settings.about",
    description: "settings.about_description",
    icon: "mdi-information-outline",
    color: "grey-darken-1",
    route: { name: "aboutsettings" },
    adminOnly: false,
  },
];

const settingsSections = computed(() => {
  const isAdmin = authManager.isAdmin();
  return allSettingsSections.filter((section) => !section.adminOnly || isAdmin);
});

const featuredSections = computed(() => {
  return settingsSections.value.filter(
    (section) => section.name === "providers" || section.name === "players",
  );
});

const regularSections = computed(() => {
  return settingsSections.value.filter(
    (section) => section.name !== "providers" && section.name !== "players",
  );
});

const providersSection = computed(() => {
  return settingsSections.value.filter(
    (section) => section.name === "providers",
  );
});

const playersSection = computed(() => {
  return settingsSections.value.filter((section) => section.name === "players");
});

const otherSettingsSections = computed(() => {
  return settingsSections.value.filter(
    (section) => section.name !== "providers" && section.name !== "players",
  );
});

const getIconBackgroundStyle = (color: string) => {
  const colorMap: Record<string, string> = {
    indigo: "rgb(99, 102, 241)",
    blue: "rgb(59, 130, 246)",
    green: "rgb(34, 197, 94)",
    purple: "rgb(168, 85, 247)",
    "deep-purple": "rgb(124, 58, 237)",
    orange: "rgb(249, 115, 22)",
    teal: "rgb(20, 184, 166)",
    "grey-darken-1": "rgb(158, 158, 158)",
  };
  return { backgroundColor: colorMap[color] || colorMap.indigo };
};

// computed properties
const isOverview = computed(() => {
  return router.currentRoute.value.name === "settings";
});

const activeTab = computed(() => {
  const name = router.currentRoute.value.name?.toString() || "";
  if (name === "profile") {
    return "profile";
  }
  if (name.includes("player") || name === "addgroup") {
    return "players";
  }
  if (
    name.includes("system") ||
    name.includes("core") ||
    name.includes("serverlog") ||
    name === "genremanagement"
  ) {
    return "system";
  }
  if (name.includes("frontend")) {
    return "frontend";
  }
  if (name.includes("remoteaccess")) {
    return "remote_access";
  }
  if (name.includes("user")) {
    return "users";
  }
  if (name.includes("about")) {
    return "about";
  }
  return "providers";
});

const getProviderName = (instanceId: string) => {
  const providerInstance = api.getProvider(instanceId);
  if (providerInstance) {
    return providerInstance.name;
  }
  const providerDomain = instanceId.split("--")[0];
  const manifest = api.providerManifests[providerDomain];
  return manifest?.name || instanceId;
};

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
    } else if (currentTab === "system") {
      items.push({
        title: t("settings.system"),
        disabled: name === "systemsettings",
        to: { name: "systemsettings" },
      });
    } else if (currentTab === "remote_access") {
      items.push({
        title: t("settings.remote_access"),
        disabled: name === "remoteaccesssettings",
        to: { name: "remoteaccesssettings" },
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
    } else if (currentTab === "about") {
      items.push({
        title: t("settings.about"),
        disabled: name === "aboutsettings",
        to: { name: "aboutsettings" },
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
        title: getProviderName(route.params.instanceId as string),
        disabled: true,
      });
    })
    .with("addgroup", () => {
      items.push({ title: t("settings.add_group_player"), disabled: true });
    })
    .with("editplayer", () => {
      items.push({ title: t("settings.player_settings"), disabled: true });
    })
    .with("editplayerdsp", () => {
      items.push({ title: "DSP", disabled: true });
    })
    .with("editcore", () => {
      const domain = route.params.domain as string;
      const translated = t(`settings.core_module.${domain}.name`);
      const moduleName =
        translated !== `settings.core_module.${domain}.name`
          ? translated
          : api.providerManifests[domain]?.name || domain;
      items.push({
        title: moduleName,
        disabled: true,
      });
    })
    .with("serverlogs", () => {
      items.push({
        title: t("settings.server_logging"),
        disabled: true,
      });
    })
    .with("genremanagement", () => {
      items.push({
        title: t("settings.genre_management"),
        disabled: true,
      });
    })
    .otherwise(() => {
      return;
    });

  return items;
});

const documentationUrl = computed(() => {
  const route = router.currentRoute.value;
  const name = route.name?.toString() || "";

  // Show documentation link for editcore, editprovider, and addproviderdetails routes
  if (name === "editcore") {
    const domain = route.params.domain as string;
    if (domain && api.providerManifests[domain]) {
      return api.providerManifests[domain].documentation || null;
    }
  } else if (name === "editprovider") {
    const instanceId = route.params.instanceId as string;
    if (instanceId) {
      const provider = api.getProvider(instanceId);
      if (provider && api.providerManifests[provider.domain]) {
        return api.providerManifests[provider.domain].documentation || null;
      }
    }
  } else if (name === "addproviderdetails") {
    const domain = route.params.domain as string;
    if (domain && api.providerManifests[domain]) {
      return api.providerManifests[domain].documentation || null;
    }
  }

  return null;
});
</script>

<style scoped>
.settings-overview {
  padding: 32px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.settings-card-view {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.settings-featured {
  display: grid;
  grid-template-columns: 1fr;
  gap: 25px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
}

@media (min-width: 960px) {
  .settings-featured {
    grid-template-columns: repeat(2, 1fr);
  }

  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1280px) {
  .settings-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.setting-card {
  cursor: pointer;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.setting-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 12px 24px rgba(0, 0, 0, 0.15),
    0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.setting-card-header {
  position: relative;
  padding: 10px 24px 10px 24px;
}

.setting-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.setting-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.setting-card:hover .setting-icon {
  transform: scale(1.1) rotate(5deg);
}

.setting-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.3;
}

.setting-description {
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
}

.setting-chevron {
  opacity: 0.4;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.05);
  flex-shrink: 0;
}

.setting-card:hover .setting-chevron {
  opacity: 1;
  transform: translateX(4px);
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.settings-list-view {
  max-width: 800px;
  margin: 0 auto;
}

.settings-list {
  padding: 0;
  background: transparent;
}

.settings-list-item {
  cursor: pointer;
  padding: 20px 24px;
  min-height: 80px;
  border-bottom: none;
  background: transparent;
}

.settings-list-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.list-item-main {
  border-radius: 10px !important;
}

.setting-list-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.settings-list-item :deep(.v-list-item__prepend) {
  margin-right: 8px;
}

.settings-list-item :deep(.v-list-item__prepend .v-icon) {
  margin-inline-end: 0 !important;
}

.settings-list-item :deep(.v-list-item-title) {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.settings-list-item :deep(.v-list-item-subtitle) {
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-top: 4px;
}

.settings-list-item :deep(.v-list-item__append) {
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.settings-list-item:hover :deep(.v-list-item__append) {
  opacity: 1;
}

@media (max-width: 768px) {
  .settings-featured {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .settings-overview {
    padding: 20px 16px;
  }

  .setting-card-header {
    padding: 20px;
    padding-bottom: 16px;
  }

  .setting-header-top {
    margin-bottom: 12px;
  }

  .setting-icon {
    width: 48px;
    height: 48px;
  }

  .setting-chevron {
    width: 28px;
    height: 28px;
  }

  .setting-title {
    font-size: 1.125rem;
  }

  .settings-list-item {
    padding: 16px;
    min-height: 72px;
  }

  .setting-list-icon {
    width: 40px;
    height: 40px;
    margin-right: 12px;
  }

  .settings-list-item :deep(.v-list-item-title) {
    font-size: 1rem;
  }

  .settings-list-item :deep(.v-list-item-subtitle) {
    font-size: 0.813rem;
  }
}

@media (max-width: 480px) {
  .settings-overview {
    padding: 16px 12px;
  }

  .setting-card-header {
    padding: 16px;
  }

  .setting-card-featured .setting-card-header {
    padding: 16px;
  }

  .setting-icon-featured {
    width: 56px;
    height: 56px;
  }

  .setting-card-featured .setting-title {
    font-size: 1.25rem;
  }

  .settings-list-item {
    padding: 16px;
    min-height: 72px;
  }

  .setting-list-icon {
    width: 40px;
    height: 40px;
    margin-right: 12px;
  }

  .settings-list-item :deep(.v-list-item-title) {
    font-size: 1rem;
  }

  .settings-list-item :deep(.v-list-item-subtitle) {
    font-size: 0.813rem;
  }
}
</style>
