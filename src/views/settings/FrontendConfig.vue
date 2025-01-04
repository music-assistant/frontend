<template>
  <section>
    <v-toolbar color="transparent">
      <template #title>{{ $t("settings.frontend") }} </template>
    </v-toolbar>
    <v-card-text style="margin-left: -5px; margin-right: -5px">
      <v-card-subtitle> {{ $t("settings.frontend_desc") }} </v-card-subtitle>
      <br />
      <br />

      <v-divider />
      <edit-config
        v-if="config"
        :config-entries="config"
        :disabled="false"
        @submit="onSubmit"
        @action="onAction"
      />
    </v-card-text>
    <v-overlay
      v-model="loading"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { onMounted } from "vue";
import { $t, i18n } from "@/plugins/i18n";
import { DEFAULT_MENU_ITEMS } from "@/constants";

// global refs
const router = useRouter();
const config = ref<ConfigEntry[]>([]);
const loading = ref(false);

onMounted(() => {
  const storedMenuConf = localStorage.getItem("frontend.settings.menu_items");
  const enabledMenuItems: string[] = storedMenuConf
    ? storedMenuConf.split(",")
    : DEFAULT_MENU_ITEMS;

  config.value = [
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
      value: localStorage.getItem("frontend.settings.theme"),
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
      key: "menu_style",
      type: ConfigEntryType.STRING,
      label: "menu_style",
      default_value: "horizontal",
      required: false,
      options: [
        { title: "horizontal", value: "horizontal" },
        { title: "vertical", value: "vertical" },
      ],
      multi_value: false,
      category: "generic",
      value: localStorage.getItem("frontend.settings.menu_style"),
    },
    {
      key: "menu_items",
      type: ConfigEntryType.STRING,
      label: "menu_items",
      default_value: DEFAULT_MENU_ITEMS,
      required: false,
      options: [
        { title: $t("home"), value: "home" },
        { title: $t("search"), value: "search" },
        { title: $t("artists"), value: "artists" },
        { title: $t("albums"), value: "albums" },
        { title: $t("tracks"), value: "tracks" },
        { title: $t("playlists"), value: "playlists" },
        { title: $t("audiobooks"), value: "audiobooks" },
        { title: $t("podcasts"), value: "podcasts" },
        { title: $t("radios"), value: "radios" },
        { title: $t("browse"), value: "browse" },
        { title: $t("settings.settings"), value: "settings" },
      ],
      multi_value: true,
      category: "generic",
      value: enabledMenuItems,
    },
    {
      key: "hide_settings",
      type: ConfigEntryType.BOOLEAN,
      label: "hide_settings",
      default_value: false,
      required: false,
      multi_value: false,
      category: "advanced",
      value: localStorage.getItem("frontend.settings.hide_settings") == "true",
    },
  ];
});

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  for (const key in values) {
    const storageKey = `frontend.settings.${key}`;
    const value = values[key];
    if (value) {
      localStorage.setItem(storageKey, value.toString());
    } else {
      localStorage.removeItem(storageKey);
    }
  }
  router.push({ name: "home" }).then(() => {
    // enforce refresh
    window.location.reload();
  });
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
) {};
</script>
