<template>
  <div>
    <Toolbar icon="mdi-cog-outline" :show-loading="true">
      <template #title>
        <v-breadcrumbs :items="breadcrumbItems" class="pa-0" />
      </template>
      <template #append>
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
    <router-view v-else v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import Toolbar from "@/components/Toolbar.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { match } from "ts-pattern";
import { computed, provide, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();
const { t } = useI18n();
const { getPreference, setPreference } = useUserPreferences();

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
    if (isPlayersPage.value && savedViewMode) {
      if (savedViewMode === "list" || savedViewMode === "card") {
        playersViewMode.value = savedViewMode;
      }
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
    if (isProvidersPage.value && savedViewMode) {
      if (savedViewMode === "list" || savedViewMode === "card") {
        providersViewMode.value = savedViewMode;
      }
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
    name: "system",
    label: "settings.system",
    description: "settings.system_description",
    icon: "mdi-server",
    color: "purple",
    route: { name: "systemsettings" },
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
    name.includes("serverlog")
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

/* Mobile optimizations */
@media (max-width: 600px) {
  .settings-list-item {
    padding: 12px 16px;
    min-height: 64px;
  }

  .settings-list-item :deep(.v-list-item__prepend) {
    margin-right: 12px;
  }

  .settings-list-item :deep(.v-avatar) {
    width: 40px !important;
    height: 40px !important;
  }

  .settings-list-item :deep(.v-list-item-title) {
    font-size: 1rem !important;
    line-height: 1.3;
  }

  .settings-list-item :deep(.v-list-item-subtitle) {
    font-size: 0.813rem !important;
    line-height: 1.3;
  }
}
</style>
