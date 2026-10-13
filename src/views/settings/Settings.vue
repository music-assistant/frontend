<template>
  <div>
    <Toolbar :icon="Settings">
      <template #title>
        <ToolbarHeading
          :title="t('settings.settings')"
          :to="isOverview ? undefined : { name: 'settings' }"
          :items="breadcrumbItems"
        />
      </template>
      <template #append>
        <Button
          v-if="viewModeToggle"
          variant="ghost"
          size="icon"
          :title="getToggleViewModeLabel(viewModeToggle.mode)"
          :aria-label="getToggleViewModeLabel(viewModeToggle.mode)"
          @click="viewModeToggle.toggle()"
        >
          <List v-if="viewModeToggle.mode === 'list'" class="size-5" />
          <LayoutGrid v-else class="size-5" />
        </Button>
      </template>
    </Toolbar>

    <Separator />

    <Container
      v-if="isOverview"
      variant="comfortable"
      class="mx-auto max-w-[1200px] max-md:px-3 max-md:py-4"
    >
      <div v-if="settingsViewMode === 'card'" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SettingsSectionLink
            v-for="section in featuredSections"
            :key="section.name"
            :section="section"
            variant="card"
          />
        </div>
        <div
          class="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-4 min-[960px]:grid-cols-2 xl:grid-cols-3"
        >
          <SettingsSectionLink
            v-for="section in regularSections"
            :key="section.name"
            :section="section"
            variant="card"
          />
        </div>
      </div>

      <nav v-else :aria-label="t('settings.settings')">
        <ItemGroup>
          <SettingsSectionLink
            v-for="section in listSections"
            :key="section.name"
            :section="section"
            variant="list"
          />
        </ItemGroup>
      </nav>

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
    </Container>

    <router-view v-else v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import SettingsSectionLink from "@/components/settings/SettingsSectionLink.vue";
import Toolbar from "@/components/Toolbar.vue";
import ToolbarHeading, {
  type ToolbarHeadingItem,
} from "@/components/ToolbarHeading.vue";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { provideEditedProviderName } from "@/composables/useEditedProviderName";
import { useOnboarding } from "@/composables/useOnboarding";
import { useUserPreferences } from "@/composables/userPreferences";
import { hasOnboardingTrack, isAdminTrack } from "@/helpers/onboarding_access";
import { embeddedProviderDomain } from "@/helpers/provider_domain";
import { availableSettingsSections } from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { LayoutGrid, List, Settings } from "@lucide/vue";
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

const settingsViewMode = ref<"list" | "card">("card");
const savedSettingsViewMode = getPreference<"list" | "card">(
  "settings.overview.viewMode",
  "card",
);

type SettingsViewMode = "list" | "card";

const getSettingsViewModeLabel = function (mode: SettingsViewMode) {
  return mode === "list" ? t("view.list") : t("view.card");
};

const getNextSettingsViewMode = function (
  mode: SettingsViewMode,
): SettingsViewMode {
  return mode === "list" ? "card" : "list";
};

const getToggleViewModeLabel = function (mode: SettingsViewMode) {
  const nextMode = getNextSettingsViewMode(mode);
  return t("tooltip.view_mode_switch", [
    getSettingsViewModeLabel(mode),
    getSettingsViewModeLabel(nextMode),
  ]);
};

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

const providersViewMode = ref<"list" | "card">("card");
const isProvidersPage = computed(() => {
  const name = router.currentRoute.value.name?.toString() || "";
  return name.includes("providers");
});

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

// the page on screen owns the toolbar's view mode toggle, if it has one
const viewModeToggle = computed(() => {
  if (isOverview.value)
    return { mode: settingsViewMode.value, toggle: toggleSettingsViewMode };
  if (isPlayersPage.value)
    return { mode: playersViewMode.value, toggle: togglePlayersViewMode };
  if (isProvidersPage.value)
    return { mode: providersViewMode.value, toggle: toggleProvidersViewMode };
  if (isTasksPage.value)
    return { mode: tasksViewMode.value, toggle: toggleTasksViewMode };
  if (isSystemPage.value)
    return { mode: systemViewMode.value, toggle: toggleSystemViewMode };
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
// The setup wizard opens on whatever is left to set up. The welcome has been
// shown by the time this link is any use, so nothing is left to do on it and
// it would otherwise open on its own summary: showing it again means showing
// it from the top.
const launchOnboarding = () =>
  openOnboarding(isAdminTrack() ? undefined : "welcome");

const settingsSections = computed(() =>
  availableSettingsSections((scope) => authManager.hasScope(scope)),
);

const providerSectionNames = [
  "music_providers",
  "player_providers",
  "metadata_providers",
  "plugin_providers",
  "audio_analysis_providers",
];

const featuredSectionNames = ["music_providers", "players"];

const featuredSections = computed(() =>
  settingsSections.value.filter((section) =>
    featuredSectionNames.includes(section.name),
  ),
);

const regularSections = computed(() =>
  settingsSections.value.filter(
    (section) => !featuredSectionNames.includes(section.name),
  ),
);

// the list groups the providers first, then the players, then the rest
const listSections = computed(() => {
  const sections = settingsSections.value;
  return [
    ...sections.filter((section) =>
      providerSectionNames.includes(section.name),
    ),
    ...sections.filter((section) => section.name === "players"),
    ...sections.filter(
      (section) =>
        !providerSectionNames.includes(section.name) &&
        section.name !== "players",
    ),
  ];
});

// computed properties
const isOverview = computed(() => {
  return router.currentRoute.value.name === "settings";
});

useEscapeBack(
  () => goBack(router, { name: "settings" }),
  () => !isOverview.value,
);

const activeTab = computed(() => {
  const name = router.currentRoute.value.name?.toString() || "";
  if (name === "profile") {
    return "profile";
  }
  if (
    name.includes("player") ||
    name.includes("queue") ||
    name === "addgroup"
  ) {
    return "players";
  }
  if (
    name.includes("system") ||
    name.includes("core") ||
    name.includes("serverlog") ||
    name === "backgroundtasks" ||
    name === "diagnostics" ||
    name === "genremanagement" ||
    name === "audioanalysissettings" ||
    name === "storagesettings"
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
    string | undefined;
  const firstType = typesQuery ? typesQuery.split(",")[0].trim() : undefined;
  if (firstType === "music") return "music_providers";
  if (firstType === "player") return "player_providers";
  if (firstType === "metadata") return "metadata_providers";
  if (firstType === "plugin") return "plugin_providers";
  if (firstType === "audio_analysis") return "audio_analysis_providers";

  if (name === "editprovider") {
    const instanceId = router.currentRoute.value.params.instanceId as string;
    // disabled instances are not loaded, so fall back to the manifest type
    const providerType =
      api.getProvider(instanceId)?.type ||
      api.providerManifests[embeddedProviderDomain(instanceId)]?.type;
    if (providerType === ProviderType.MUSIC) return "music_providers";
    if (providerType === ProviderType.PLAYER) return "player_providers";
    if (providerType === ProviderType.METADATA) return "metadata_providers";
    if (providerType === ProviderType.PLUGIN) return "plugin_providers";
    if (providerType === ProviderType.AUDIO_ANALYSIS)
      return "audio_analysis_providers";
  }

  return "music_providers";
});

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
    } else if (currentTab === "audio_analysis_providers") {
      items.push({
        title: t("settings.audio_analysis_providers"),
        disabled: name === "providersettings",
        to: { name: "providersettings", query: { types: "audio_analysis" } },
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
    .with("editprovider", () => {
      items.push({
        title:
          editedProviderName.value ||
          api.getProviderName(route.params.instanceId as string),
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
    .with("genremanagement", () => {
      items.push({
        title: t("settings.genre_management"),
        disabled: true,
      });
    })
    .with("storagesettings", () => {
      items.push({
        title: t("settings.storage.title"),
        disabled: true,
      });
    })
    .with("audioanalysissettings", () => {
      items.push({
        title: t("settings.audio_analysis"),
        disabled: true,
      });
    })
    .otherwise(() => {
      return;
    });

  return items;
});
</script>
