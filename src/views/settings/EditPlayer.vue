<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div
        v-if="
          config &&
          api.getProviderManifest(config.provider)!.domain in
            api.providerManifests
        "
        style="margin-left: -5px; margin-right: -5px"
      >
        <v-card-title>
          {{
            $t("settings.config_player", [
              config.name ||
                api.players[config.player_id]?.name ||
                config.default_name,
            ])
          }}
        </v-card-title>
        <v-card-subtitle>
          <b>{{ $t("settings.player_id") }}: </b>{{ config.player_id }}
        </v-card-subtitle>
        <v-card-subtitle>
          <b>{{ $t("settings.player_provider") }}: </b
          >{{ api.getProviderManifest(config.provider)?.name }}
          <a
            v-if="api.getProviderManifest(config.provider)?.documentation"
            @click="
              openLinkInNewTab(
                api.getProviderManifest(config.provider)?.documentation!,
              )
            "
          >
            [{{ $t("settings.check_docs") }}]</a
          >
        </v-card-subtitle>
        <v-card-subtitle v-if="api.players[config.player_id]">
          <b>{{ $t("settings.player_model") }}: </b
          >{{ api.players[config.player_id].device_info.manufacturer }} /
          {{ api.players[config.player_id].device_info.model }}
        </v-card-subtitle>
        <v-card-subtitle
          v-if="api.players[config.player_id]?.device_info.ip_address"
        >
          <b>{{ $t("settings.player_address") }}: </b
          >{{ api.players[config.player_id].device_info.ip_address }}
        </v-card-subtitle>
        <v-card-subtitle v-if="api.players[config.player_id]">
          <b>{{ $t("settings.player_type_label") }}: </b
          >{{ $t(`player_type.${api.players[config.player_id].type}`) }}
        </v-card-subtitle>
        <br />
        <v-divider />
        <br />
        <br />

        <!-- name field -->
        <v-text-field
          v-if="'name' in config"
          v-model="config.name"
          :placeholder="config?.name"
          :label="$t('settings.player_name')"
          variant="outlined"
          clearable
          class="configcolumnleft"
          style="margin-right: 25px"
        />
        <!-- enable field -->
        <v-switch
          v-if="'enabled' in config"
          v-model="config.enabled"
          :label="$t('settings.enable_player')"
          color="primary"
          :disabled="api.getProviderManifest(config.provider)?.builtin"
        />
      </div>
      <br />
      <v-divider />
      <edit-config
        v-if="config"
        :disabled="!config.enabled"
        :config-entries="config_entries"
        @submit="onSubmit"
        @action="onAction"
      />
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ConfigEntryType,
  ConfigValueType,
  DSPConfig,
  EventType,
  PlayerConfig,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watch } from "vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { nanoid } from "nanoid";

// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const sessionId = nanoid(11);
const loading = ref(false);

// props
const props = defineProps<{
  playerId?: string;
}>();

const dspEnabled = ref(false);

const loadDSPEnabled = async () => {
  if (props.playerId) {
    try {
      dspEnabled.value = (await api.getDSPConfig(props.playerId)).enabled;
    } catch (error) {
      console.error("Error fetching DSP config:", error);
    }
  }
};
loadDSPEnabled();

const unsub = api.subscribe(
  EventType.PLAYER_DSP_CONFIG_UPDATED,
  (evt: { data: DSPConfig }) => {
    dspEnabled.value = evt.data.enabled;
  },
);
onBeforeUnmount(unsub);

// computed properties

const config_entries = computed(() => {
  if (!config.value) return [];
  const entries = Object.values(config.value.values);
  // inject a DSP config property if the player is not a group
  const player = api.players[config.value.player_id];
  if (player && player.type !== PlayerType.GROUP) {
    entries.push({
      key: "dsp_settings",
      type: ConfigEntryType.DSP_SETTINGS,
      label: "",
      default_value: dspEnabled.value,
      required: false,
      category: "audio",
    });
  } else if (
    player &&
    player.type === PlayerType.GROUP &&
    player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group",
      type: ConfigEntryType.LABEL,
      label: "You can configure the DSP for each player individually.",
      default_value: null,
      required: false,
      category: "audio",
    });
  } else if (
    player &&
    player.type === PlayerType.GROUP &&
    !player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group_not_supported",
      type: ConfigEntryType.LABEL,
      label:
        "This group type does not support DSP when playing to multiple devices.",
      default_value: null,
      required: false,
      category: "audio",
    });
  }
  return entries;
});

// watchers

watch(
  () => props.playerId,
  async (val) => {
    if (val) {
      config.value = await api.getPlayerConfig(val);
    }
  },
  { immediate: true },
);

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  delete values["dsp_settings"]; // delete the injected dsp_settings since its UI only
  values["enabled"] = config.value!.enabled;
  values["name"] = config.value!.name || null;
  api.savePlayerConfig(props.playerId!, values);
  router.push({ name: "playersettings" });
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
) {
  loading.value = true;
  // append existing ConfigEntry values to allow
  // values be passed between flow steps
  for (const entry of Object.values(config.value!.values)) {
    if (entry.value !== undefined && values[entry.key] == undefined) {
      values[entry.key] = entry.value;
    }
  }
  // ensure the session id is passed along (for auth actions)
  values["session_id"] = sessionId;
  api
    .getPlayerConfigEntries(config.value!.player_id, action, values)
    .then((entries) => {
      config.value!.values = {};
      for (const entry of entries) {
        config.value!.values[entry.key] = entry;
      }
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
    })
    .finally(() => {
      loading.value = false;
    });
};

const openDspConfig = function () {
  router.push(`/settings/editplayer/${props.playerId}/dsp`);
};
</script>

<style scoped></style>
