<template>
  <section class="edit-player">
    <div
      v-if="
        config &&
        api.getProviderManifest(config.provider)!.domain in
          api.providerManifests
      "
    >
      <!-- Disabled banner -->
      <v-alert
        v-if="!config?.enabled"
        type="warning"
        variant="tonal"
        class="mb-4"
        closable
      >
        <div class="disabled-banner">
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
      <v-card v-if="config" class="header-card mb-4" elevation="0">
        <div class="header-content">
          <div class="header-icon">
            <v-icon size="32" color="primary">mdi-speaker</v-icon>
          </div>
          <div class="header-info">
            <div class="header-title-row">
              <h2 class="header-title">
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
                class="rename-btn"
                @click="showRenameDialog = true"
              />
            </div>
            <div class="header-meta">
              <span class="meta-item">
                <v-icon size="14" class="mr-1">mdi-identifier</v-icon>
                {{ config.player_id }}
              </span>
              <span class="meta-item">
                <v-icon size="14" class="mr-1">mdi-puzzle</v-icon>
                {{ api.getProviderManifest(config.provider)?.name }}
                <a
                  v-if="api.getProviderManifest(config.provider)?.documentation"
                  class="docs-link"
                  @click="
                    openLinkInNewTab(
                      api.getProviderManifest(config.provider)?.documentation!,
                    )
                  "
                >
                  <v-icon size="12">mdi-open-in-new</v-icon>
                </a>
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-information</v-icon>
                {{ api.players[config.player_id].device_info.manufacturer }} /
                {{ api.players[config.player_id].device_info.model }}
              </span>
              <span
                v-if="api.players[config.player_id]?.device_info.ip_address"
                class="meta-item"
              >
                <v-icon size="14" class="mr-1">mdi-ip-network</v-icon>
                {{ api.players[config.player_id].device_info.ip_address }}
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-tag</v-icon>
                {{ $t(`player_type.${api.players[config.player_id].type}`) }}
              </span>
            </div>
          </div>
        </div>
      </v-card>
    </div>

    <!-- Not available banner -->
    <v-alert
      v-if="config && !api.players[config.player_id]?.available"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="disabled-banner">
        <span>{{ $t("settings.player_not_available") }}</span>
      </div>
    </v-alert>

    <edit-config
      v-else-if="config"
      :disabled="!config?.enabled"
      :config-entries="allConfigEntries"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <!-- Rename dialog -->
    <v-dialog v-model="showRenameDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("settings.player_name") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editName"
            :placeholder="
              api.players[config?.player_id!]?.name || config?.default_name
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
  ConfigEntry,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watch } from "vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { nanoid } from "nanoid";
import { useI18n } from "vue-i18n";
import { GroupContext, deriveGroupContext } from "@/helpers/player_group_utils";

// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const sessionId = nanoid(11);
const loading = ref(false);
const showRenameDialog = ref(false);
const editName = ref<string | null>(null);

// props
const props = defineProps<{
  playerId?: string;
}>();

const { t } = useI18n();

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

function addGroupLabel(
  adjEntries: ConfigEntry[],
  category: string,
  groupCtx: GroupContext,
) {
  const base: Omit<ConfigEntry, "key"> = {
    type: ConfigEntryType.LABEL,
    default_value: null,
    required: false,
    category,
  };

  if (!groupCtx.isLeader) {
    adjEntries.push({
      ...base,
      key: "grouping_prevents_settings",
      label:
        "This player is part of a group. Settings are inherited from {link}.",
      action: "group_leader_link",
      action_label: groupCtx.leaderName ?? "",
    });
  } else {
    adjEntries.push({
      ...base,
      key: "settings_apply_to_group_members",
      label:
        "This player is the group leader. Changes here affect all players in the group.",
    });
  }
}

// computed properties
const group_ctx = computed<GroupContext>(() => {
  const playerId = config.value?.player_id;
  const players = api.players;
  return deriveGroupContext(playerId, players);
});

const config_entries = computed(() => {
  if (!config.value) return [];
  const player = api.players[config.value.player_id];
  if (!player) return [];

  const entries = Object.values(config.value.values);
  // inject a DSP config property if the player is not a group
  if (group_ctx.value.ownsDSPSettings) {
    entries.push({
      key: "dsp_settings",
      type: ConfigEntryType.DSP_SETTINGS,
      label: "",
      default_value: dspEnabled.value,
      required: false,
      category: "audio",
    });
  } else if (player.type === PlayerType.GROUP && group_ctx.value.dspPerPlayer) {
    entries.push({
      key: "dsp_note_multi_device_group",
      type: ConfigEntryType.LABEL,
      label: "You can configure the DSP for each player individually.",
      default_value: null,
      required: false,
      category: "audio",
    });
  } else {
    entries.push({
      key: "dsp_note_multi_device_group_unsupported",
      type: ConfigEntryType.LABEL,
      label:
        "This group type does not support DSP when playing to multiple devices.",
      default_value: null,
      required: false,
      category: "audio",
    });
  }

  if (group_ctx.value.inGroup) {
    const adjEntries: ConfigEntry[] = [];
    const byCategory = new Map<string, ConfigEntry[]>();

    for (const e of entries) {
      const arr = byCategory.get(e.category);
      if (arr) arr.push(e);
      else byCategory.set(e.category, [e]);
    }

    const toFilterSet = new Set(group_ctx.value.perGrpCfgKeys);
    for (const [category, arr] of byCategory) {
      const perGroupOnly = arr.filter((e) => toFilterSet.has(e.key));
      const remaining = arr.filter((e) => !toFilterSet.has(e.key));

      if (perGroupOnly.length > 0) {
        addGroupLabel(adjEntries, category, group_ctx.value);

        const perGroupOut = group_ctx.value.isLeader
          ? perGroupOnly
          : perGroupOnly.map((e) => ({ ...e, read_only: true }));
        adjEntries.push(...perGroupOut);

        if (remaining.length > 0) {
          adjEntries.push({
            key: `group_config_divider_${category}`,
            type: ConfigEntryType.DIVIDER,
            label:
              player.type == PlayerType.GROUP
                ? ""
                : t(
                    "settings.player_specific_divider",
                    "Player-specific settings:",
                  ),
            category: category,
          });
        }
      }
      adjEntries.push(...remaining);
    }

    return adjEntries;
  }

  return entries;
});

const allConfigEntries = computed(() => {
  // Pass all entries (including hidden ones) to EditConfig
  // Hidden entries contain values that need to be preserved on save
  return config_entries.value;
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
const saveRename = function () {
  if (config.value) {
    config.value.name = editName.value || undefined;
  }
  api
    .savePlayerConfig(props.playerId!, { name: config.value!.name || null })
    .then(() => {
      loading.value = true;
    })
    .finally(() => {
      loading.value = false;
      showRenameDialog.value = false;
    });
  showRenameDialog.value = false;
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  delete values["dsp_settings"]; // delete the injected dsp_settings since its UI only
  values["enabled"] = config.value!.enabled;
  api.savePlayerConfig(props.playerId!, values);
  router.push({ name: "playersettings" });
};

const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  // Immediately apply a config value change to the backend
  api.savePlayerConfig(props.playerId!, values);
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
) {
  if (action === "group_leader_link") {
    openPlayerConfig(group_ctx.value.leaderId);
    return;
  }
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

const openPlayerConfig = function (player_id: string) {
  const route = router.currentRoute.value;
  const segments = route.path.split("/").filter(Boolean);
  segments[segments.length - 1] = player_id;
  router.push(`${router.currentRoute.value.path}`);
  const newPath = "/" + segments.join("/");
  router.push(newPath);
};
</script>

<style scoped>
.edit-player {
  padding: 16px;
}

.header-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
}

.header-content {
  display: flex;
  gap: 20px;
  padding: 24px;
}

.header-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.rename-btn {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.rename-btn:hover {
  opacity: 1;
}

.disabled-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  font-size: 0.813rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.docs-link {
  margin-left: 4px;
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.docs-link:hover {
  opacity: 1;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
