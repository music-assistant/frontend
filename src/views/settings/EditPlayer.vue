<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div
        v-if="config && config.provider in api.providerManifests"
        style="margin-left: -5px; margin-right: -5px"
      >
        <v-card-title>
          {{
            $t("settings.config_player", [
              config.name || api.players[config.player_id].name,
            ])
          }}
        </v-card-title>
        <v-card-subtitle>
          <b>{{ $t("settings.player_id") }}: </b>{{ config.player_id }}
        </v-card-subtitle>
        <v-card-subtitle>
          <b>{{ $t("settings.player_provider") }}: </b
          >{{ api.providerManifests[config.provider].name }}
          (
          {{ api.providerManifests[config.provider].description }})
          <a
            v-if="api.providerManifests[config.provider].documentation"
            :href="api.providerManifests[config.provider].documentation"
            target="_blank"
            >{{ $t("settings.check_docs") }}</a
          >
        </v-card-subtitle>
        <v-card-subtitle v-if="api.players[config.player_id]">
          <b>{{ $t("settings.player_model") }}: </b
          >{{ api.players[config.player_id].device_info.manufacturer }} /
          {{ api.players[config.player_id].device_info.model }}
        </v-card-subtitle>
        <v-card-subtitle v-if="api.players[config.player_id]">
          <b>{{ $t("settings.player_address") }}: </b
          >{{ api.players[config.player_id].device_info.address }}
        </v-card-subtitle>
        <v-card-subtitle>
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
        />
        <!-- enable field -->
        <v-switch
          v-if="'enabled' in config"
          v-model="config.enabled"
          :label="$t('settings.enable_player')"
          color="primary"
          :disabled="api.providerManifests[config.provider]?.builtin"
        />
      </div>
      <br />
      <v-divider />
      <edit-config
        v-if="config"
        :disabled="!config.enabled"
        :config-entries="Object.values(config.values)"
        @submit="onSubmit"
      />
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ConfigValueType,
  PlayerConfig,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watch } from "vue";

// global refs
const router = useRouter();
const config = ref<PlayerConfig>();

// props
const props = defineProps<{
  playerId?: string;
}>();

// watchers

watch(
  () => props.playerId,
  async (val) => {
    if (val) {
      config.value = await api.getPlayerConfig(val);
    }
  },
  { immediate: true }
);

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  values["enabled"] = config.value!.enabled;
  values["name"] = config.value!.name || null;
  api.savePlayerConfig(props.playerId!, values);
  router.push({ name: "playersettings" });
};
</script>

<style scoped></style>
