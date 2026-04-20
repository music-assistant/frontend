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
import { useColorMode } from "@vueuse/core";
import { Palette } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_MENU_ITEMS } from "@/constants";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { companionMode } from "@/plugins/companion";
import { store } from "@/plugins/store";
import { $t, i18n } from "@/plugins/i18n";
import EditConfig from "./EditConfig.vue";

// global refs
const router = useRouter();
const config = ref<ConfigEntry[]>([]);
const loading = ref(false);
const mode = useColorMode();

onMounted(() => {
  const enabledMenuItems = DEFAULT_MENU_ITEMS.filter(
    (item) =>
      localStorage.getItem(`frontend.settings.menu_item_${item}_enabled`) !==
      "false",
  );
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
      category: "generic",
      value: storedTheme,
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
      category: "generic",
      value: localStorage.getItem("frontend.settings.language"),
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
      category: "generic",
      value: enabledMenuItems,
    },
    {
      key: "enable_browser_controls",
      type: ConfigEntryType.BOOLEAN,
      label: "enable_browser_controls",
      default_value: true,
      required: false,
      multi_value: false,
      category: "generic",
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
      category: "generic",
      value:
        localStorage.getItem("frontend.settings.force_mobile_layout") ===
        "true",
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
      category: "generic",
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

  config.value = configEntries;
});

// methods
const saveValues = function (values: Record<string, ConfigValueType>) {
  for (const key in values) {
    const storageKey = `frontend.settings.${key}`;
    const value = values[key];
    if (value != null) {
      if (key === "menu_items") {
        const selectedItems = Array.isArray(value)
          ? (value as string[])
          : String(value).split(",");
        for (const item of DEFAULT_MENU_ITEMS) {
          if (selectedItems.includes(item)) {
            localStorage.removeItem(
              `frontend.settings.menu_item_${item}_enabled`,
            );
          } else {
            localStorage.setItem(
              `frontend.settings.menu_item_${item}_enabled`,
              "false",
            );
          }
        }
        // clean up old single-key format
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, value.toString());
      }

      if (key === "theme") {
        mode.value = value.toString() as "light" | "dark" | "auto";
      }
    } else {
      localStorage.removeItem(storageKey);
    }
  }
  router.push({ name: "discover" }).then(() => {
    // enforce refresh
    window.location.reload();
  });
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
