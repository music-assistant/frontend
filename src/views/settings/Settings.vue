<template>
  <div>
    <Toolbar
      :icon="Settings"
      :menu-items="toolbarMenuItems"
      :enforce-overflow-menu="true"
      :menu-active="toolbarMenuActive"
    >
      <template #title>
        <ToolbarHeading
          :title="t('settings.settings')"
          :to="isOverview ? undefined : { name: 'settings' }"
          :items="breadcrumbItems"
        />
      </template>
      <template #append>
        <SettingsViewModeToggle
          v-if="viewModeToggle"
          :mode="viewModeToggle.mode"
          @toggle="viewModeToggle.toggle()"
        />
      </template>
    </Toolbar>

    <Separator />

    <div v-if="isOverview" class="p-5 max-md:px-3 max-md:py-4">
      <SettingsOverview
        :sections="settingsSections"
        :view-mode="settingsViewMode"
      />

      <div v-if="canOpenOnboarding" class="mt-2 flex justify-center">
        <Button
          variant="link"
          class="text-muted-foreground"
          data-testid="run-onboarding"
          @click="launchOnboarding"
        >
          {{ t(onboardingLinkKey) }}
        </Button>
      </div>
    </div>

    <router-view v-else v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import SettingsOverview from "@/components/settings/SettingsOverview.vue";
import SettingsViewModeToggle from "@/components/settings/SettingsViewModeToggle.vue";
import Toolbar from "@/components/Toolbar.vue";
import ToolbarHeading, {
  type ToolbarHeadingItem,
} from "@/components/ToolbarHeading.vue";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { provideEditedProviderName } from "@/composables/useEditedProviderName";
import { provideSettingsToolbarMenu } from "@/composables/useSettingsToolbarMenu";
import { useOnboarding } from "@/composables/useOnboarding";
import { useUserPreferences } from "@/composables/userPreferences";
import { hasOnboardingTrack, isAdminTrack } from "@/helpers/onboarding_access";
import { embeddedProviderDomain } from "@/helpers/provider_domain";
import { coreModuleName } from "@/helpers/core_modules";
import {
  providerListType,
  providerSettingsPage,
  SETTINGS_PAGES,
} from "@/helpers/settings_pages";
import {
  availableSettingsSections,
  providerListPage,
  providerSettingsSectionName,
} from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { Settings } from "@lucide/vue";
import { match } from "ts-pattern";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { goBack } from "@/helpers/navigation";
import { computed, provide, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();
const { t } = useI18n();
const { getPreference, setPreference } = useUserPreferences();

// the provider settings page publishes the name it shows, so the crumb above
// it cannot disagree with its heading
const editedProviderName = provideEditedProviderName();

// the page on screen puts what it offers in the toolbar's overflow menu
const toolbarMenuItems = provideSettingsToolbarMenu();
// an option that is on shows on the menu button
const toolbarMenuActive = computed(() =>
  toolbarMenuItems.value.some((item) => item.active),
);

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

const providersViewMode = ref<"list" | "card">("card");

const savedProvidersViewMode = getPreference<"list" | "card">(
  "settings.providers.viewMode",
  "card",
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

// the page on screen owns the toolbar's view mode toggle, if it has one; the
// lists of a hub have the toggle in their panel
const viewModeToggle = computed(() => {
  if (isOverview.value)
    return { mode: settingsViewMode.value, toggle: toggleSettingsViewMode };
  if (isTasksPage.value)
    return { mode: tasksViewMode.value, toggle: toggleTasksViewMode };
  return undefined;
});

// Onboarding is reachable again from here: the setup wizard for the admin who
// sets every kind of provider up, and the welcome for everyone else who lives
// here — there is no setup for them to run again.
const canOpenOnboarding = computed(() => hasOnboardingTrack());
const onboardingLinkKey = computed(() =>
  isAdminTrack() ? "onboarding.run_again" : "onboarding.welcome_again",
);
const { open: openOnboarding } = useOnboarding();
// Running the wizard again starts at its first choice; the paused banner
// separately resumes wherever the user left it.
const launchOnboarding = () =>
  openOnboarding(isAdminTrack() ? "intent" : "welcome");

const settingsSections = computed(() =>
  availableSettingsSections((scope) => authManager.hasScope(scope)),
);

// computed properties
const isOverview = computed(() => {
  return router.currentRoute.value.name === "settings";
});

useEscapeBack(
  () => goBack(router, { name: "settings" }),
  () => !isOverview.value,
);

// the pages below Music that list no providers
const MUSIC_ROUTE_NAMES = [
  "librarysettings",
  "genremanagement",
  "metadatasettings",
  "audioanalysissettings",
];

// the provider type a list of providers shows: the first one its route names
const listedType = computed(() => {
  const typesQuery = router.currentRoute.value.query.types as
    string | undefined;
  return typesQuery ? typesQuery.split(",")[0].trim() : undefined;
});

const activeTab = computed(() => {
  const name = router.currentRoute.value.name?.toString() || "";
  if (name === "profile") {
    return "profile";
  }
  if (MUSIC_ROUTE_NAMES.includes(name)) {
    return "music";
  }
  if (
    name.includes("player") ||
    name.includes("queue") ||
    name === "addgroup" ||
    name === "playbacksettings"
  ) {
    return "players";
  }
  if (
    name.includes("system") ||
    name.includes("core") ||
    name.includes("serverlog") ||
    name === "backgroundtasks" ||
    name === "tasksettings" ||
    name === "diagnostics" ||
    name === "networksettings" ||
    name === "remoteaccesssettings" ||
    name === "homeassistantsettings" ||
    name === "storagesettings"
  ) {
    return "system";
  }
  if (name.includes("frontend")) {
    return "frontend";
  }
  if (name.includes("user")) {
    return "users";
  }
  if (name.includes("about")) {
    return "about";
  }
  // the Catalog carries a types query of its own, for the tab it opens on
  if (name === "catalog") {
    return "catalog";
  }

  const typeSection = providerSettingsSectionName(listedType.value);
  if (typeSection) return typeSection;

  if (name === "editprovider") {
    const instanceId = router.currentRoute.value.params.instanceId as string;
    // the providers with a settings page of their own have it under System
    if (providerSettingsPage(embeddedProviderDomain(instanceId))) {
      return "system";
    }
    const providerSection = providerSettingsSectionName(
      providerListOf(instanceId),
    );
    if (providerSection) return providerSection;
  }

  return "music";
});

// the list the provider of an instance shows in, which its manifest decides so
// a disabled instance, which is not loaded, shows in the same one
const providerListOf = function (instanceId: string) {
  const manifest = api.providerManifests[embeddedProviderDomain(instanceId)];
  const type = manifest?.type ?? api.getProvider(instanceId)?.type;
  return type && providerListType(type, manifest?.features);
};

// the crumb of the page below a section listing the providers of a type, a
// link for whoever may open it
const providerListCrumbs = function (
  type: string | undefined,
): ToolbarHeadingItem[] {
  const page = providerListPage(type);
  if (!page) return [];
  return [
    {
      title: t(page.label),
      disabled: false,
      to: authManager.hasScope(page.requiresScope) ? page.route : undefined,
    },
  ];
};

const breadcrumbItems = computed(() => {
  const route = router.currentRoute.value;
  const name = route.name?.toString() || "";
  // without config.players.write only the player options open, so the crumbs
  // leading to the players and their settings are plain text
  const canConfigurePlayers = authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE);

  // "Settings" heads the toolbar on its own line, so the trail starts below it
  const items: ToolbarHeadingItem[] = [];

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
        to: canConfigurePlayers ? { name: "playersettings" } : undefined,
      });
    } else if (currentTab === "system") {
      if (!(
        name === "backgroundtasks" &&
        !authManager.hasScope(Scope.CONFIG_CORE_WRITE)
      )) {
        items.push({
          title: t("settings.system"),
          disabled: name === "systemsettings",
          to: { name: "systemsettings" },
        });
      }
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
    } else if (currentTab === "catalog") {
      items.push({ title: t("settings.catalog.title"), disabled: true });
    } else if (currentTab === "music") {
      items.push({
        title: t("settings.music"),
        // the lists of the other provider types below Music share its route
        disabled:
          name === "providersettings" && !providerListPage(listedType.value),
        to: { name: "providersettings", query: { types: "music" } },
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
    .with("providersettings", () => {
      const page = providerListPage(listedType.value);
      if (page) items.push({ title: t(page.label), disabled: true });
    })
    .with("editprovider", () => {
      const instanceId = route.params.instanceId as string;
      const ownPage = providerSettingsPage(embeddedProviderDomain(instanceId));
      if (ownPage) {
        items.push({
          title: t(ownPage.title),
          disabled: false,
          to: ownPage.route,
        });
      }
      items.push(...providerListCrumbs(providerListOf(instanceId)));
      items.push({
        title: editedProviderName.value || api.getProviderName(instanceId),
        disabled: true,
      });
    })
    .with("addgroup", () => {
      items.push({ title: t("settings.add_group_player"), disabled: true });
    })
    .with(
      "editplayer",
      "editplayerdsp",
      "editplayeroptions",
      "editqueue",
      () => {
        // a queue is identified by the player id of the player owning it
        const playerId = (route.params.playerId ||
          route.params.queueId) as string;
        items.push({
          // a disabled player is never registered, so it has no name to show
          title: api.players[playerId]?.name || t("settings.player_settings"),
          disabled: name === "editplayer",
          to: canConfigurePlayers
            ? { name: "editplayer", params: { playerId } }
            : undefined,
        });
        const section = match(name)
          .with("editplayerdsp", () => t("settings.category.dsp"))
          .with("editplayeroptions", () => t("settings.category.options"))
          .with("editqueue", () => t("settings.queue_settings"))
          .otherwise(() => undefined);
        if (section) items.push({ title: section, disabled: true });
      },
    )
    .with("editcore", () => {
      const domain = route.params.domain as string;
      items.push({
        title: coreModuleName(
          domain,
          (key) => t(key),
          api.providerManifests[domain]?.name,
        ),
        disabled: true,
      });
    })
    .with("diagnostics", () => {
      items.push({
        title: t("settings.diagnostics"),
        disabled: true,
      });
    })
    .with("backgroundtasks", () => {
      items.push({
        title: t("background_tasks.title"),
        disabled: true,
      });
    })
    .with("tasksettings", () => {
      items.push(
        {
          title: t("background_tasks.title"),
          disabled: false,
          to: { name: "backgroundtasks" },
        },
        { title: t(SETTINGS_PAGES.task_settings.title), disabled: true },
      );
    })
    .with("librarysettings", () => {
      items.push({ title: t(SETTINGS_PAGES.library.title), disabled: true });
    })
    .with("storagesettings", () => {
      items.push({ title: t("settings.storage.title"), disabled: true });
    })
    .with("genremanagement", () => {
      items.push({ title: t("settings.genre_management"), disabled: true });
    })
    .with("metadatasettings", () => {
      items.push(...providerListCrumbs(ProviderType.METADATA), {
        title: t(SETTINGS_PAGES.metadata.title),
        disabled: true,
      });
    })
    .with("playbacksettings", () => {
      items.push({ title: t(SETTINGS_PAGES.playback.title), disabled: true });
    })
    .with("networksettings", () => {
      items.push({ title: t(SETTINGS_PAGES.network.title), disabled: true });
    })
    .with("remoteaccesssettings", () => {
      const { title, route: pageRoute } = SETTINGS_PAGES.network;
      items.push({ title: t(title), disabled: false, to: pageRoute });
      items.push({ title: t("settings.remote_access"), disabled: true });
    })
    .with("homeassistantsettings", () => {
      items.push({
        title: t(SETTINGS_PAGES.home_assistant.title),
        disabled: true,
      });
    })
    .with("audioanalysissettings", () => {
      items.push(...providerListCrumbs(ProviderType.AUDIO_ANALYSIS), {
        title: t(SETTINGS_PAGES.audio_analysis.title),
        disabled: true,
      });
    })
    .otherwise(() => {
      return;
    });

  return items;
});
</script>
