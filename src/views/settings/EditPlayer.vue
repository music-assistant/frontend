<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div
        v-if="config && config.provider in providerManifests"
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
          <b>{{ $t("settings.player_provider") }}: </b>{{ providerManifests[config.provider].name }}
          (
          {{ providerManifests[config.provider].description }})
        </v-card-subtitle>
        <v-card-subtitle v-if="api.players[config.player_id]">
          <b>{{ $t("settings.player_model") }}: </b>{{ api.players[config.player_id].device_info.manufacturer }} /
          {{ api.players[config.player_id].device_info.model }}
        </v-card-subtitle>
        <v-card-subtitle v-if="api.players[config.player_id]">
          <b>{{ $t("settings.player_address") }}: </b>{{
            api.players[config.player_id].device_info.address
          }}
        </v-card-subtitle>
      </div>
      <br>
      <v-divider />
      <br>
      <br>
      <edit-config
        v-if="config"
        :model-value="config"
        @update:modelValue="onSubmit($event as PlayerConfig)"
      />
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { PlayerConfig, ProviderManifest } from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watch } from "vue";

// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const providerManifests = reactive<{
  [provider_domain: string]: ProviderManifest;
}>({});

// props
const props = defineProps<{
  playerId?: string;
}>();

// watchers

watch(
  () => props.playerId,
  async (val) => {
    if (val) {
      config.value = await api.getData("config/players/get", {
        player_id: props.playerId,
      });
    }
  },
  { immediate: true }
);

watch(
  () => api.providers,
  async (val) => {
    if (val) {
      const manifests: ProviderManifest[] = await api.getData(
        "providers/available"
      );
      for (const prov of manifests) {
        providerManifests[prov.domain] = prov;
      }
    }
  },
  { immediate: true }
);

// methods
const onSubmit = async function (value: PlayerConfig) {
  api.sendCommand("config/players/set", { config: value });
  router.push({ name: "playersettings" });
};
</script>

<style scoped></style>
