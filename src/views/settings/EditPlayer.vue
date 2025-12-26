<template>
  <v-container fluid class="pa-6">
    <v-row>
      <v-col cols="12" md="8" offset-md="2">
        <div
          v-if="
            config &&
            api.getProviderManifest(config.provider)!.domain in
              api.providerManifests
          "
        >
          <!-- Disabled banner -->
          <v-alert
            v-if="!config.enabled"
            type="warning"
            variant="tonal"
            class="mb-6"
            closable
          >
            <div class="d-flex align-center justify-space-between w-100">
              <span>{{ $t("settings.player_disabled") }}</span>
              <v-btn
                size="small"
                color="warning"
                variant="flat"
                @click="config.enabled = true"
              >
                {{ $t("settings.enable_player") }}
              </v-btn>
            </div>
          </v-alert>

          <!-- Header card -->
          <v-card class="mb-6">
            <v-card-text class="d-flex gap-4 align-start">
              <v-icon size="48" color="primary" class="flex-shrink-0">
                mdi-speaker
              </v-icon>
              <div class="flex-grow-1">
                <div class="d-flex align-center justify-space-between mb-2">
                  <div class="d-flex align-center gap-2">
                    <h2 class="text-h5 font-weight-bold">
                      {{
                        config.name ||
                        api.players[config.player_id]?.name ||
                        config.default_name
                      }}
                    </h2>
                    <v-btn
                      icon="mdi-pencil"
                      variant="text"
                      size="small"
                      density="compact"
                      class="text-medium-emphasis"
                      @click="showRenameDialog = true"
                    />
                  </div>
                  <v-btn
                    v-if="
                      api.players[config.player_id]?.type !== PlayerType.GROUP
                    "
                    prepend-icon="mdi-equalizer"
                    variant="tonal"
                    @click="
                      router.push(
                        `/settings/editplayer/dsp/${config.player_id}`,
                      )
                    "
                  >
                    {{ $t("settings.dsp.title") }}
                  </v-btn>
                </div>

                <div
                  class="d-flex flex-wrap gap-4 text-body-2 text-medium-emphasis"
                >
                  <div class="d-flex align-center">
                    <v-icon size="16" class="mr-2">mdi-identifier</v-icon>
                    {{ config.player_id }}
                  </div>

                  <div class="d-flex align-center">
                    <v-icon size="16" class="mr-2">mdi-puzzle</v-icon>
                    {{ api.getProviderManifest(config.provider)?.name }}
                    <v-btn
                      v-if="
                        api.getProviderManifest(config.provider)?.documentation
                      "
                      icon="mdi-open-in-new"
                      variant="text"
                      size="x-small"
                      density="compact"
                      class="ml-1"
                      @click="
                        openLinkInNewTab(
                          api.getProviderManifest(config.provider)
                            ?.documentation!,
                        )
                      "
                    />
                  </div>

                  <div
                    v-if="api.players[config.player_id]"
                    class="d-flex align-center"
                  >
                    <v-icon size="16" class="mr-2">mdi-information</v-icon>
                    {{ api.players[config.player_id].device_info.manufacturer }}
                    /
                    {{ api.players[config.player_id].device_info.model }}
                  </div>

                  <div
                    v-if="api.players[config.player_id]?.device_info.ip_address"
                    class="d-flex align-center"
                  >
                    <v-icon size="16" class="mr-2">mdi-ip-network</v-icon>
                    {{ api.players[config.player_id].device_info.ip_address }}
                  </div>

                  <div
                    v-if="api.players[config.player_id]"
                    class="d-flex align-center"
                  >
                    <v-icon size="16" class="mr-2">mdi-tag</v-icon>
                    {{
                      $t(`player_type.${api.players[config.player_id].type}`)
                    }}
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <v-card>
          <v-card-text>
            <edit-config
              v-if="config"
              :disabled="!config.enabled"
              :config-entries="allConfigEntries"
              @submit="onSubmit"
              @action="onAction"
              @immediate-apply="onImmediateApply"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Rename dialog -->
    <v-dialog v-model="showRenameDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("settings.player_name") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editName"
            :placeholder="
              api.players[config?.player_id ?? '']?.name || config?.default_name
            "
            variant="outlined"
            density="comfortable"
            autofocus
            clearable
            @keyup.enter="saveRename"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRenameDialog = false">
            {{ $t("close") }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="saveRename">
            {{ $t("settings.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  PlayerConfig,
  ConfigValueType,
  ConfigEntry,
  PlayerType,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { openLinkInNewTab } from "@/helpers/utils";

// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const showRenameDialog = ref(false);
const editName = ref<string | null>(null);

// props
const props = defineProps<{
  playerId?: string;
}>();

// computed properties
const allConfigEntries = computed(() => {
  if (!config.value) return [];
  // Pass all entries (including hidden ones) to EditConfig
  // Hidden entries contain values that need to be preserved on save
  return Object.values(config.value.values);
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

watch(showRenameDialog, (val) => {
  if (val && config.value) {
    editName.value = config.value.name || null;
  }
});

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new player config
  values["enabled"] = config.value!.enabled;
  api
    .savePlayerConfig(config.value!.player_id, values)
    .then(() => {
      router.push({ name: "playersettings" });
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
    });
};

const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  // Immediately apply a config value change to the backend
  api.savePlayerConfig(config.value!.player_id, values);
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
) {
  // append existing ConfigEntry values to allow
  // values be passed between flow steps
  for (const entry of Object.values(config.value!.values)) {
    if (entry.value !== undefined && values[entry.key] == undefined) {
      values[entry.key] = entry.value;
    }
  }
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
    });
};

const saveRename = function () {
  if (config.value) {
    config.value.name = editName.value || "";
  }
  api
    .savePlayerConfig(config.value!.player_id, {
      name: config.value!.name || null,
    })
    .then(() => {
      showRenameDialog.value = false;
    });
};
</script>

<style scoped>
.gap-4 {
  gap: 16px;
}
.gap-2 {
  gap: 8px;
}
</style>
