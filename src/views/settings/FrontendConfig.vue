<template>
  <section>
    <v-card-text>
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
import { api } from "@/plugins/api";

// global refs
const router = useRouter();
const config = ref<ConfigEntry[]>([]);
const loading = ref(false);

onMounted(() => {
  const storedMenuConf = localStorage.getItem("frontend.settings.menu_items");
  const enabledMenuItems: string[] = storedMenuConf
    ? storedMenuConf.split(",")
    : DEFAULT_MENU_ITEMS;

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
  ];

  // Only show builtin player setting for local connections
  // (builtin player uses HTTP which is not compatible with WebRTC)
  if (!api.isRemoteConnection.value) {
    configEntries.splice(3, 0, {
      key: "enable_builtin_player",
      type: ConfigEntryType.BOOLEAN,
      label: "enable_builtin_player",
      default_value: true,
      required: true,
      multi_value: false,
      category: "generic",
      value:
        localStorage.getItem("frontend.settings.enable_builtin_player") !=
        "false",
    });
  }

  config.value = configEntries;
});

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  for (const key in values) {
    const storageKey = `frontend.settings.${key}`;
    const value = values[key];
    if (value != null) {
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
