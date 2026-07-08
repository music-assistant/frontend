<template>
  <div class="p-4">
    <!-- Header card -->
    <Card class="mb-4">
      <CardHeader class="flex flex-row items-center gap-4 pb-4">
        <div
          class="flex size-14 shrink-0 items-center justify-center rounded-xl bg-orange-500/10"
        >
          <Palette class="size-8 text-orange-500" />
        </div>
        <div class="flex flex-col gap-1">
          <CardTitle>{{ $t("settings.frontend") }}</CardTitle>
          <CardDescription>{{
            $t("settings.frontend_description")
          }}</CardDescription>
        </div>
      </CardHeader>
    </Card>

    <!-- Config entries -->
    <EditConfig
      v-if="config.length > 0"
      :config-entries="config"
      :disabled="false"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <!-- Loading overlay -->
    <div
      v-if="loading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
    >
      <Spinner class="size-16" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Palette } from "@lucide/vue";
import { useColorMode } from "@vueuse/core";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useUserPreferences } from "@/composables/userPreferences";
import { DEFAULT_MENU_ITEMS, DEVICE_SETTING_KEYS } from "@/constants";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { companionMode } from "@/plugins/companion";
import { $t, i18n } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import EditConfig from "./EditConfig.vue";

// global refs
const router = useRouter();
const config = ref<ConfigEntry[]>([]);
const loading = ref(false);
const mode = useColorMode();

onMounted(() => {
  // TODO: Remove localStorage fallbacks below once migration period is over
  // (theme, language, menu_items moved from localStorage to user preferences)
  const storedMenuConf = localStorage.getItem("frontend.settings.menu_items");
  const enabledMenuItems: string[] = storedMenuConf
    ? storedMenuConf.split(",")
    : DEFAULT_MENU_ITEMS;

  const storedTheme = localStorage.getItem("frontend.settings.theme") || "auto";
  mode.value = storedTheme as "light" | "dark" | "auto";

  const configEntries: ConfigEntry[] = [
    {
      key: "theme",
      type: ConfigEntryType.STRING,
      label: "theme",
      default_value: "auto",
      required: false,
      options: [
        { title: "auto", value: "auto" },
        { title: "dark", value: "dark" },
        { title: "light", value: "light" },
      ],
      multi_value: false,
      category: "preferences",
      value: (store.currentUser?.preferences?.theme as string) || storedTheme,
    },
    {
      key: "language",
      type: ConfigEntryType.STRING,
      label: "language",
      default_value: "auto",
      required: false,
      options: [
        { title: "auto", value: "auto" },
        ...i18n.global.availableLocales.map((x) => {
          return { title: x, value: x };
        }),
      ],
      multi_value: false,
      category: "preferences",
      value:
        (store.currentUser?.preferences?.language as string) ||
        localStorage.getItem("frontend.settings.language"),
    },
    {
      key: "menu_items",
      type: ConfigEntryType.STRING,
      label: "menu_items",
      default_value: DEFAULT_MENU_ITEMS,
      required: false,
      options: [
        { title: $t("discover"), value: "discover" },
        { title: $t("search"), value: "search" },
        ...(store.enabledPlugins.has("party")
          ? [{ title: $t("party_mode"), value: "party" }]
          : []),
        { title: $t("artists"), value: "artists" },
        { title: $t("albums"), value: "albums" },
        { title: $t("tracks"), value: "tracks" },
        { title: $t("playlists"), value: "playlists" },
        { title: $t("audiobooks"), value: "audiobooks" },
        { title: $t("podcasts"), value: "podcasts" },
        { title: $t("radios"), value: "radios" },
        { title: $t("genres"), value: "genres" },
        { title: $t("browse"), value: "browse" },
        { title: $t("settings.settings"), value: "settings" },
      ],
      multi_value: true,
      category: "preferences",
      value:
        (store.currentUser?.preferences?.menu_items as string[] | string) ||
        enabledMenuItems,
    },
    {
      key: "enable_browser_controls",
      type: ConfigEntryType.BOOLEAN,
      label: "enable_browser_controls",
      default_value: true,
      required: false,
      multi_value: false,
      category: "display_settings",
      hidden: companionMode.value,
      value:
        localStorage.getItem("frontend.settings.enable_browser_controls") !==
        "false",
    },
    {
      key: "force_mobile_layout",
      type: ConfigEntryType.BOOLEAN,
      label: "force_mobile_layout",
      default_value: false,
      required: false,
      multi_value: false,
      category: "display_settings",
      value:
        localStorage.getItem("frontend.settings.force_mobile_layout") ===
        "true",
    },
    {
      key: "show_waveform",
      type: ConfigEntryType.BOOLEAN,
      label: "show_waveform",
      default_value: true,
      required: false,
      multi_value: false,
      category: "display_settings",
      value: (store.currentUser?.preferences?.show_waveform as boolean) ?? true,
    },
    {
      key: "mobile_sidebar_side",
      type: ConfigEntryType.STRING,
      label: "mobile_sidebar_side",
      default_value: "left",
      required: false,
      options: [
        { title: "Left", value: "left" },
        { title: "Right", value: "right" },
      ],
      multi_value: false,
      category: "display_settings",
      value:
        localStorage.getItem("frontend.settings.mobile_sidebar_side") || "left",
    },
  ];

  // Add web player settings (if not running in companion mode)
  if (!companionMode.value) {
    configEntries.push({
      key: "web_player_enabled",
      type: ConfigEntryType.BOOLEAN,
      label: "web_player_enabled",
      default_value: true,
      required: false,
      category: "web_player",
      value:
        localStorage.getItem("frontend.settings.web_player_enabled") !==
        "false",
    });
  }

  // These are frontend-only settings, so the frontend owns their translations (server-provided
  // entries are localized server-side and arrive pre-resolved). ConfigEntryField renders the
  // label/option titles directly, so resolve the frontend-owned ones here from the settings.* keys.
  for (const entry of configEntries) {
    // fall back to the in-code label/category if a locale is missing the string, so we never
    // surface a raw i18n key in the UI.
    entry.label = $t(`settings.${entry.key}.label`, entry.label);
    if (entry.category) {
      // frontend-only entries carry their translated category heading directly (server entries
      // get category_label resolved server-side); EditConfig just reads category_label.
      entry.category_label = $t(
        `settings.category.${entry.category}`,
        entry.category,
      );
    }
    const desc = $t(`settings.${entry.key}.description`);
    if (desc !== `settings.${entry.key}.description`) entry.description = desc;
    if (entry.options) {
      entry.options = entry.options.map((opt) => ({
        ...opt,
        title: $t(`settings.${entry.key}.options.${opt.value}`, opt.title),
      }));
    }
  }
  config.value = configEntries;
});

// methods
const saveValues = async function (values: Record<string, ConfigValueType>) {
  const { setPreference } = useUserPreferences();
  loading.value = true;

  let hasPerUserChanges = false;

  try {
    for (const key in values) {
      const entry = config.value.find((e) => e.key === key);
      if (!entry) continue;

      if (DEVICE_SETTING_KEYS.has(key)) {
        // Save to localStorage (per-device settings)
        const storageKey = `frontend.settings.${key}`;
        const value = values[key];
        if (value != null) {
          localStorage.setItem(storageKey, value.toString());
        } else {
          localStorage.removeItem(storageKey);
        }
      } else {
        // Save to backend via user preferences
        await setPreference(key, values[key]);
        hasPerUserChanges = true;
      }
    }

    // Reload if any per-user settings changed
    if (hasPerUserChanges) {
      router.push({ name: "discover" }).then(() => {
        window.location.reload();
      });
    } else {
      router.push({ name: "discover" });
    }
  } catch (error) {
    console.error("Failed to save settings:", error);
    loading.value = false;
  }
};

const onSubmit = function (values: Record<string, ConfigValueType>) {
  saveValues(values);
};

const onAction = async function (
  _action: string,
  _values: Record<string, ConfigValueType>,
  _immediateApply: boolean,
) {};

const onImmediateApply = function (values: Record<string, ConfigValueType>) {
  for (const key in values) {
    localStorage.setItem(`frontend.settings.${key}`, String(values[key]));
  }
};
</script>
