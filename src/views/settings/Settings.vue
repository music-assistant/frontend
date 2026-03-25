<template>
  <div>
    <Toolbar :icon="Settings">
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
          v-if="isTasksPage"
          :icon="tasksViewMode === 'list' ? 'mdi-view-list' : 'mdi-grid'"
          variant="text"
          :title="t('tooltip.toggle_view_mode')"
          @click="toggleTasksViewMode()"
        />
        <v-btn
          v-if="isSystemPage"
          :icon="systemViewMode === 'list' ? 'mdi-view-list' : 'mdi-grid'"
          variant="text"
          :title="t('tooltip.toggle_view_mode')"
          @click="toggleSystemViewMode()"
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
      <!-- Onboarding welcome message -->
      <div v-if="store.isOnboarding" class="onboarding-card">
        <div class="onboarding-header">
          <div>
            <h2 class="onboarding-title">
              {{ t("settings.onboarding_title") }}
            </h2>
            <p class="onboarding-subtitle">
              {{ t("settings.onboarding_subtitle") }}
            </p>
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            class="onboarding-close"
            @click="store.isOnboarding = false"
          />
        </div>

        <div class="onboarding-sections">
          <div class="onboarding-section">
            <div class="section-icon music">
              <v-icon icon="mdi-music" size="24" />
            </div>
            <div class="section-content">
              <h3>{{ t("settings.onboarding_music_title") }}</h3>
              <p>{{ t("settings.onboarding_music_desc") }}</p>
            </div>
            <v-btn
              color="primary"
              variant="flat"
              class="section-btn"
              @click="
                router.push({
                  name: 'providersettings',
                  query: { types: 'music' },
                })
              "
            >
              {{ t("settings.onboarding_add_music") }}
            </v-btn>
          </div>

          <div class="onboarding-section">
            <div class="section-icon player">
              <v-icon icon="mdi-speaker" size="24" />
            </div>
            <div class="section-content">
              <h3>{{ t("settings.onboarding_player_title") }}</h3>
              <p>{{ t("settings.onboarding_player_desc") }}</p>
            </div>
            <v-btn
              color="primary"
              variant="flat"
              class="section-btn"
              @click="
                router.push({
                  name: 'providersettings',
                  query: { types: 'player' },
                })
              "
            >
              {{ t("settings.onboarding_add_player") }}
            </v-btn>
          </div>
        </div>

        <p class="onboarding-footer">
          <v-icon icon="mdi-information-outline" size="16" class="mr-1" />
          {{ t("settings.onboarding_footer") }}
        </p>
      </div>

      <div v-if="settingsViewMode === 'card'" class="settings-card-view">
        <div class="settings-featured">
          <Card
            v-for="section in [...musicSections, ...playerSections]"
            :key="section.name"
            class="setting-card"
            @click="router.push(section.route)"
          >
            <CardHeader>
              <div class="setting-header-top">
                <div
                  class="setting-icon"
                  :style="getIconBackgroundStyle(section.color)"
                >
                  <Icon :icon="section.icon" size="20" color="white" />
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
            <CardHeader>
              <div class="setting-header-top">
                <div
                  class="setting-icon"
                  :style="getIconBackgroundStyle(section.color)"
                >
                  <Icon :icon="section.icon" size="20" color="white" />
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
import { ProviderType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { Settings } from "lucide-vue-next";
import { match } from "ts-pattern";
import { computed, provide, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { useDisplay } from "vuetify";

// global refs
const router = useRouter();
const { t } = useI18n();
const { getPreference, setPreference } = useUserPreferences();
const { mobile } = useDisplay();

const settingsViewMode = ref<"list" | "card">("card");
const settingsListPrependGap = computed(() => (mobile.value ? 4 : 24));
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

const tasksViewMode = ref<"list" | "card">("list");
const isTasksPage = computed(
  () => router.currentRoute.value.name?.toString() === "backgroundtasks",
);

const savedTasksViewMode = getPreference<"list" | "card">(
  "settings.tasks.viewMode",
  "list",
);

watch(
  () => savedTasksViewMode.value,
  (savedViewMode) => {
    if (savedViewMode === "list" || savedViewMode === "card") {
      tasksViewMode.value = savedViewMode;
    }
  },
  { immediate: true },
);

const toggleTasksViewMode = function () {
  tasksViewMode.value = tasksViewMode.value === "list" ? "card" : "list";
  setPreference("settings.tasks.viewMode", tasksViewMode.value);
};

provide("tasksViewMode", {
  viewMode: tasksViewMode,
  toggleViewMode: toggleTasksViewMode,
});

const isSystemPage = computed(
  () => router.currentRoute.value.name?.toString() === "systemsettings",
);

const systemViewMode = ref<"list" | "card">("list");
const savedSystemViewMode = getPreference<"list" | "card">(
  "settings.system.viewMode",
  "list",
);

watch(
  () => savedSystemViewMode.value,
  (savedViewMode) => {
    if (savedViewMode === "list" || savedViewMode === "card") {
      systemViewMode.value = savedViewMode;
    }
  },
  { immediate: true },
);

const toggleSystemViewMode = function () {
  systemViewMode.value = systemViewMode.value === "list" ? "card" : "list";
  setPreference("settings.system.viewMode", systemViewMode.value);
};

provide("systemViewMode", {
  viewMode: systemViewMode,
  toggleViewMode: toggleSystemViewMode,
});

const allSettingsSections = [
  {
    name: "music_providers",
    label: "settings.music_sources",
    description: "settings.music_providers_description",
    icon: "mdi-music",
    color: "blue",
    route: { name: "providersettings", query: { types: "music" } },
    adminOnly: true,
  },
  {
    name: "player_providers",
    label: "settings.playerproviders",
    description: "settings.player_providers_description",
    icon: "mdi-speaker-multiple",
    color: "green",
    route: { name: "providersettings", query: { types: "player" } },
    adminOnly: true,
  },
  {
    name: "metadata_providers",
    label: "settings.metadataproviders",
    description: "settings.metadata_providers_description",
    icon: "mdi-file-code",
    color: "indigo",
    route: { name: "providersettings", query: { types: "metadata" } },
    adminOnly: true,
  },
  {
    name: "plugin_providers",
    label: "settings.plugins",
    description: "settings.plugin_providers_description",
    icon: "mdi-puzzle",
    color: "deep-purple",
    route: { name: "providersettings", query: { types: "plugin" } },
    adminOnly: true,
  },
  {
    name: "players",
    label: "settings.players",
    description: "settings.players_description",
    icon: "mdi-tune",
    color: "teal",
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

const providerSectionNames = [
  "music_providers",
  "player_providers",
  "metadata_providers",
  "plugin_providers",
];

const musicSections = computed(() => {
  return settingsSections.value.filter(
    (section) => section.name === "music_providers",
  );
});

const playerSections = computed(() => {
  return settingsSections.value.filter((section) => section.name === "players");
});

const regularSections = computed(() => {
  return settingsSections.value.filter(
    (section) =>
      section.name !== "music_providers" && section.name !== "players",
  );
});

const providersSection = computed(() => {
  return settingsSections.value.filter((section) =>
    providerSectionNames.includes(section.name),
  );
});

const playersSection = computed(() => {
  return settingsSections.value.filter((section) => section.name === "players");
});

const otherSettingsSections = computed(() => {
  return settingsSections.value.filter(
    (section) =>
      !providerSectionNames.includes(section.name) &&
      section.name !== "players",
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
    name === "backgroundtasks" ||
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

  const typesQuery = router.currentRoute.value.query.types as
    | string
    | undefined;
  const firstType = typesQuery ? typesQuery.split(",")[0].trim() : undefined;
  if (firstType === "music") return "music_providers";
  if (firstType === "player") return "player_providers";
  if (firstType === "metadata") return "metadata_providers";
  if (firstType === "plugin") return "plugin_providers";

  if (name === "editprovider") {
    const instanceId = router.currentRoute.value.params.instanceId as string;
    const provider = api.getProvider(instanceId);
    if (provider) {
      if (provider.type === ProviderType.MUSIC) return "music_providers";
      if (provider.type === ProviderType.PLAYER) return "player_providers";
      if (provider.type === ProviderType.METADATA) return "metadata_providers";
      if (provider.type === ProviderType.PLUGIN) return "plugin_providers";
    }
  }

  if (name === "addproviderdetails") {
    const domain = router.currentRoute.value.params.domain as string;
    const manifest = api.providerManifests[domain];
    if (manifest) {
      if (manifest.type === ProviderType.MUSIC) return "music_providers";
      if (manifest.type === ProviderType.PLAYER) return "player_providers";
      if (manifest.type === ProviderType.METADATA) return "metadata_providers";
      if (manifest.type === ProviderType.PLUGIN) return "plugin_providers";
    }
  }
  return "music_providers";
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
    to?: RouteLocationRaw;
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
      if (!(name === "backgroundtasks" && !authManager.isAdmin())) {
        items.push({
          title: t("settings.system"),
          disabled: name === "systemsettings",
          to: { name: "systemsettings" },
        });
      }
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
    } else if (currentTab === "music_providers") {
      items.push({
        title: t("settings.music_sources"),
        disabled: name === "providersettings",
        to: { name: "providersettings", query: { types: "music" } },
      });
    } else if (currentTab === "player_providers") {
      items.push({
        title: t("settings.playerproviders"),
        disabled: name === "providersettings",
        to: { name: "providersettings", query: { types: "player" } },
      });
    } else if (currentTab === "metadata_providers") {
      items.push({
        title: t("settings.metadataproviders"),
        disabled: name === "providersettings",
        to: { name: "providersettings", query: { types: "metadata" } },
      });
    } else if (currentTab === "plugin_providers") {
      items.push({
        title: t("settings.plugins"),
        disabled: name === "providersettings",
        to: { name: "providersettings", query: { types: "plugin" } },
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
    .with("editplayeroptions", () => {
      items.push({ title: t("settings.category.options"), disabled: true });
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
    .with("backgroundtasks", () => {
      items.push({
        title: t("background_tasks.title"),
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
  max-width: 1200px !important;
  margin: 0 auto;
}

.settings-card-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-featured {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .settings-featured {
    grid-template-columns: 1fr;
  }
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

@media (min-width: 960px) {
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
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 6px 0 0 0;
}

.setting-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 12px 24px rgba(0, 0, 0, 0.15),
    0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.setting-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.setting-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
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
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
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
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
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
  max-width: 1200px;
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
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.settings-list-item :deep(.v-list-item__prepend) {
  padding-inline-end: 6px;
}

.settings-list-item :deep(.v-list-item__prepend .v-icon) {
  margin-inline-end: 0 !important;
}

.settings-list-item :deep(.v-list-item__content > div) {
  padding-left: 0;
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
  .settings-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .settings-overview {
    padding: 16px 12px;
  }

  .setting-header-top {
    margin-bottom: 8px;
  }

  .setting-icon {
    width: 40px;
    height: 40px;
  }

  .setting-chevron {
    width: 26px;
    height: 26px;
  }

  .setting-title {
    font-size: 0.938rem;
  }

  .settings-list-item {
    padding: 16px;
    min-height: 72px;
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

  .settings-list-item :deep(.v-list-item-title) {
    font-size: 1rem;
  }

  .settings-list-item :deep(.v-list-item-subtitle) {
    font-size: 0.813rem;
  }
}

.onboarding-card {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.08) 0%,
    rgba(var(--v-theme-primary), 0.02) 100%
  );
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 25px;
}

.onboarding-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.onboarding-close {
  opacity: 0.6;
}

.onboarding-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--v-theme-on-surface));
}

.onboarding-subtitle {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.onboarding-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.onboarding-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.6);
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.section-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.section-icon.music {
  background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
  color: white;
}

.section-icon.player {
  background: linear-gradient(135deg, #5c6bc0 0%, #7986cb 100%);
  color: white;
}

.section-content {
  flex: 1;
  min-width: 0;
}

.section-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: rgb(var(--v-theme-on-surface));
}

.section-content p {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0;
  line-height: 1.4;
}

.section-btn {
  flex-shrink: 0;
}

.onboarding-footer {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin: 0;
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .onboarding-card {
    padding: 20px;
  }

  .onboarding-section {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .section-btn {
    width: 100%;
  }

  .onboarding-title {
    font-size: 20px;
  }
}
</style>
