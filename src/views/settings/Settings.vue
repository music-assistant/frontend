<template>
  <!-- a query container, so the floating Save button of a form can line up
       with the column below -->
  <div class="@container">
    <Toolbar :icon="Settings">
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

    <!-- on a wide window every settings page keeps to a centred column -->
    <div
      class="mx-auto max-w-(--settings-column-width)"
      data-testid="settings-column"
    >
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
import { provideSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import { useOnboarding } from "@/composables/useOnboarding";
import { useUserPreferences } from "@/composables/userPreferences";
import { hasOnboardingTrack, isAdminTrack } from "@/helpers/onboarding_access";
import { embeddedProviderDomain } from "@/helpers/provider_domain";
import { coreModuleName } from "@/helpers/core_modules";
import { providerListType } from "@/helpers/settings_pages";
import {
  availableSettingsSections,
  providerListName,
  providerOwnPage,
  routeSettingsPage,
  settingsTrail,
} from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import { Scope } from "@/plugins/api/interfaces";
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

// the page on screen puts what it offers in the menu of its header
provideSettingsPageMenu();

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

// the overview has the toolbar's view mode toggle; the lists of the pages below
// it have theirs in their own header
const viewModeToggle = computed(() =>
  isOverview.value
    ? { mode: settingsViewMode.value, toggle: toggleSettingsViewMode }
    : undefined,
);

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

// the list the provider of an instance shows in, which its manifest decides so
// a disabled instance, which is not loaded, shows in the same one
const providerListOf = function (instanceId: string) {
  const manifest = api.providerManifests[embeddedProviderDomain(instanceId)];
  const type = manifest?.type ?? api.getProvider(instanceId)?.type;
  return type && providerListType(type, manifest?.provides);
};

// the page managing the provider of an instance: its own settings page, or the
// page listing it, the music sources while its type is unknown
const providerPageOf = function (instanceId: string) {
  return (
    providerOwnPage(embeddedProviderDomain(instanceId))?.key ??
    providerListName(providerListOf(instanceId)) ??
    "music"
  );
};

// the crumbs of a page of the settings menu and the pages above it, each a link
// for whoever may open it; the page on screen is the last one
const pageCrumbs = function (
  key: string,
  { current = false } = {},
): ToolbarHeadingItem[] {
  const trail = settingsTrail(key);
  return trail.map((page, index) => {
    if (current && index === trail.length - 1) {
      return { title: t(page.label), disabled: true };
    }
    const mayOpen =
      !page.requiresScope || authManager.hasScope(page.requiresScope);
    return {
      title: t(page.label),
      disabled: false,
      to: mayOpen ? page.route : undefined,
    };
  });
};

const breadcrumbItems = computed((): ToolbarHeadingItem[] => {
  // "Settings" heads the toolbar on its own line, so the trail starts below it
  if (isOverview.value) return [];
  const route = router.currentRoute.value;
  const name = route.name?.toString() || "";
  const page = routeSettingsPage(name);
  if (page) return pageCrumbs(page.key, { current: true });

  // without config.players.write only the player options open, so the crumbs
  // leading to the players and their settings are plain text
  const canConfigurePlayers = authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE);

  return match(name)
    .with("editprovider", () => {
      const instanceId = route.params.instanceId as string;
      return [
        ...pageCrumbs(providerPageOf(instanceId)),
        {
          title: editedProviderName.value || api.getProviderName(instanceId),
          disabled: true,
        },
      ];
    })
    .with("addgroup", () => [
      ...pageCrumbs("players"),
      { title: t("settings.add_group_player"), disabled: true },
    ])
    .with(
      "editplayer",
      "editplayerdsp",
      "editplayeroptions",
      "editqueue",
      () => {
        // a queue is identified by the player id of the player owning it
        const playerId = (route.params.playerId ||
          route.params.queueId) as string;
        const items: ToolbarHeadingItem[] = [
          ...pageCrumbs("players"),
          {
            // a disabled player is never registered, so it has no name to show
            title: api.players[playerId]?.name || t("settings.player_settings"),
            disabled: name === "editplayer",
            to: canConfigurePlayers
              ? { name: "editplayer", params: { playerId } }
              : undefined,
          },
        ];
        const section = match(name)
          .with("editplayerdsp", () => t("settings.category.dsp"))
          .with("editplayeroptions", () => t("settings.category.options"))
          .with("editqueue", () => t("settings.queue_settings"))
          .otherwise(() => undefined);
        if (section) items.push({ title: section, disabled: true });
        return items;
      },
    )
    .with("editcore", () => {
      const domain = route.params.domain as string;
      return [
        ...pageCrumbs("system"),
        {
          title: coreModuleName(
            domain,
            (key) => t(key),
            api.providerManifests[domain]?.name,
          ),
          disabled: true,
        },
      ];
    })
    .otherwise(() => []);
});
</script>
