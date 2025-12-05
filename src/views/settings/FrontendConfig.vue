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
import { getSendspinDefaultSyncDelay } from "@/helpers/utils";

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

  // Only show web player mode setting for local connections
  if (!api.isRemoteConnection.value) {
    const webPlayerOptions = [
      {
        title: $t("settings.web_player_mode.options.builtin"),
        value: "builtin",
      },
      {
        title: $t("settings.web_player_mode.options.disabled"),
        value: "disabled",
      },
    ];

    // Only show sendspin option if the provider is available
    const sendspinAvailable = api.getProvider("sendspin")?.available;
    if (sendspinAvailable) {
      webPlayerOptions.unshift({
        title: $t("settings.web_player_mode.options.sendspin"),
        value: "sendspin",
      });
    }

    configEntries.splice(3, 0, {
      key: "web_player_mode",
      type: ConfigEntryType.STRING,
      label: "web_player_mode",
      default_value: "sendspin",
      required: false,
      options: webPlayerOptions,
      multi_value: false,
      category: "generic",
      value:
        localStorage.getItem("frontend.settings.web_player_mode") || "sendspin",
    });

    // Show sendspin sync delay option when sendspin is available
    if (sendspinAvailable) {
      const defaultSyncDelay = getSendspinDefaultSyncDelay();

      configEntries.splice(4, 0, {
        key: "sendspin_sync_delay",
        type: ConfigEntryType.INTEGER,
        label: "sendspin_sync_delay",
        default_value: defaultSyncDelay,
        required: false,
        multi_value: false,
        category: "generic",
        value: parseInt(
          localStorage.getItem("frontend.settings.sendspin_sync_delay") ||
            String(defaultSyncDelay),
          10,
        ),
      });

      // Output latency compensation - enabled by default everywhere
      const storedOutputLatency = localStorage.getItem(
        "frontend.settings.sendspin_output_latency_compensation",
      );
      configEntries.splice(5, 0, {
        key: "sendspin_output_latency_compensation",
        type: ConfigEntryType.BOOLEAN,
        label: "sendspin_output_latency_compensation",
        default_value: true,
        required: false,
        multi_value: false,
        category: "generic",
        value:
          storedOutputLatency !== null ? storedOutputLatency === "true" : true,
      });
    }
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
