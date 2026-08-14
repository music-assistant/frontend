<template>
  <section>
    <div class="px-4 pt-4">
      <!-- Header card -->
      <Card v-if="config" class="mb-4 gap-0 py-0">
        <CardHeader class="relative flex flex-col gap-5 p-6 pr-16 sm:flex-row">
          <div class="header-icon">
            <PlayerIcon
              :icon="api.players[config.player_id]?.icon"
              :size="32"
              class="text-primary"
            />
          </div>
          <div class="header-info">
            <div class="header-title-row">
              <h2 class="header-title">{{ getPlayerName(config) }}</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                class="rename-btn"
                :title="$t('settings.player_name')"
                @click="renamePlayer"
              >
                <Pencil class="size-4" />
                <span class="sr-only">{{ $t("settings.player_name") }}</span>
              </Button>
            </div>
            <div class="header-meta">
              <span class="meta-item">
                <v-icon size="14" class="mr-1">mdi-identifier</v-icon>
                {{ config.player_id }}
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-information</v-icon>
                {{ api.players[config.player_id].device_info.manufacturer }} /
                {{ api.players[config.player_id].device_info.model }}
              </span>
              <span
                v-if="
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.IP_ADDRESS
                  ]
                "
                class="meta-item"
              >
                <v-icon size="14" class="mr-1">mdi-ip-network</v-icon>
                {{
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.IP_ADDRESS
                  ]
                }}
              </span>
              <span
                v-if="
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.MAC_ADDRESS
                  ]
                "
                class="meta-item"
              >
                <v-icon size="14" class="mr-1">mdi-network</v-icon>
                {{
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.MAC_ADDRESS
                  ]
                }}
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-tag</v-icon>
                {{ $t(`player_type.${api.players[config.player_id].type}`) }}
              </span>
            </div>
            <div
              v-if="api.players[config.player_id]?.output_protocols.length"
              class="protocol-chips"
            >
              <v-chip
                v-for="protocol in api.players[config.player_id]
                  .output_protocols"
                :key="protocol.output_protocol_id"
                size="x-small"
                variant="tonal"
                class="protocol-chip"
                :class="{
                  'protocol-chip--clickable': api.getProviderManifest(
                    protocol.protocol_domain,
                  )?.documentation,
                  'protocol-chip--unavailable': !protocol.available,
                }"
                @click="
                  api.getProviderManifest(protocol.protocol_domain)
                    ?.documentation &&
                  openLinkInNewTab(
                    api.getProviderManifest(protocol.protocol_domain)!
                      .documentation!,
                  )
                "
              >
                <template #prepend>
                  <ProviderIcon
                    :domain="protocol.protocol_domain"
                    :size="14"
                    class="chip-icon"
                  />
                </template>
                {{
                  api.getProviderManifest(protocol.protocol_domain)?.name ||
                  protocol.protocol_domain
                }}
                <v-icon
                  v-if="
                    api.getProviderManifest(protocol.protocol_domain)
                      ?.documentation
                  "
                  size="12"
                  class="ml-1"
                  >mdi-open-in-new</v-icon
                >
              </v-chip>
            </div>
          </div>
          <Button
            data-testid="player-menu"
            variant="ghost"
            size="icon-sm"
            class="absolute top-4 right-4"
            :aria-label="$t('more_options')"
            @click="openPlayerMenu"
          >
            <MoreVertical class="size-4" />
          </Button>
        </CardHeader>
        <CardContent
          v-if="playerSetupLabel"
          class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4"
        >
          <Button data-testid="player-setup" @click="startPlayerSetup">
            <RefreshCw class="size-4" />
            {{ $t(playerSetupLabel) }}
          </Button>
        </CardContent>
      </Card>

      <!-- Disabled banner -->
      <v-alert
        v-if="config && !config.enabled"
        type="warning"
        variant="tonal"
        class="mb-4"
        closable
      >
        <div class="player-banner">
          <span>{{ $t("settings.player_disabled") }}</span>
          <v-btn
            size="small"
            color="warning"
            variant="flat"
            :loading="enabling"
            @click="enablePlayer"
          >
            {{ $t("settings.enable_player") }}
          </v-btn>
        </div>
      </v-alert>

      <!-- Needs setup banner -->
      <v-alert
        v-if="
          config && config.enabled && api.players[config.player_id]?.needs_setup
        "
        type="warning"
        variant="tonal"
        class="mb-4"
      >
        <div class="player-banner">
          <span>{{ $t("settings.player_needs_setup") }}</span>
          <v-btn
            size="small"
            color="warning"
            variant="flat"
            @click="startPlayerSetup"
          >
            {{ $t("settings.start_setup") }}
          </v-btn>
        </div>
      </v-alert>

      <!-- Not available banner -->
      <v-alert
        v-else-if="
          config && config.enabled && !api.players[config.player_id]?.available
        "
        type="warning"
        variant="tonal"
        class="mb-4"
      >
        <div class="player-banner">
          <span>{{ $t("settings.player_not_available") }}</span>
        </div>
      </v-alert>

      <Tabs
        v-if="tabs.length > 1"
        :model-value="activeTab"
        class="mb-2"
        @update:model-value="(value) => openTab(value as string)"
      >
        <TabsList>
          <TabsTrigger v-for="tab in tabs" :key="tab.name" :value="tab.name">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <router-view />
  </section>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { goBack } from "@/helpers/navigation";
import { getPlayerSetupLabel } from "@/helpers/player_config";
import {
  getPlayerName,
  getPlayerSettingsMenuItems,
  getPlayerSettingsSections,
} from "@/helpers/player_settings_actions";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  EventMessage,
  EventType,
  IdentifierType,
  PlayerConfig,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MoreVertical, Pencil, RefreshCw } from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

// props
const props = defineProps<{
  playerId?: string;
}>();

// global refs
const route = useRoute();
const router = useRouter();
const config = ref<PlayerConfig>();
const enabling = ref(false);
let configLoadRequestId = 0;

const unsubConfigUpdated = api.subscribe(
  EventType.PLAYER_CONFIG_UPDATED,
  (evt: EventMessage) => {
    // renaming, enabling and configuring all happen elsewhere, so pick the
    // change up from the server rather than from whoever made it
    if (evt.object_id && evt.object_id === props.playerId) {
      void loadConfig(evt.object_id);
    }
  },
);
onBeforeUnmount(unsubConfigUpdated);

// computed properties
const playerSetupLabel = computed(() =>
  config.value?.enabled
    ? getPlayerSetupLabel(api.players[config.value.player_id])
    : undefined,
);

const tabs = computed(() => {
  if (!props.playerId) return [];
  const sections = getPlayerSettingsSections(props.playerId);
  return [
    {
      name: "editplayer",
      label: $t("settings.player_settings"),
      visible: sections.player,
    },
    {
      name: "editplayerqueue",
      label: $t("settings.queue_settings"),
      visible: sections.queue,
    },
    // the breadcrumb names this one untranslated too
    { name: "editplayerdsp", label: "DSP", visible: sections.dsp },
    {
      name: "editplayeroptions",
      label: $t("settings.category.options"),
      visible: sections.options,
    },
  ].filter((tab) => tab.visible);
});

// the strip follows the route, so a form holding a navigation back keeps its tab active
const activeTab = computed(() => route.name?.toString() ?? "");

// watchers
watch(
  () => props.playerId,
  (val) => {
    if (config.value?.player_id !== val) config.value = undefined;
    if (val) void loadConfig(val);
  },
  { immediate: true },
);

// methods
const openTab = function (name: string) {
  if (name === activeTab.value) return;
  router.push({ name, params: { playerId: props.playerId } });
};

const openPlayerMenu = function (evt: MouseEvent) {
  if (!config.value) return;
  eventbus.emit("contextmenu", {
    items: getPlayerSettingsMenuItems(config.value, {
      onDeleted: () => goBack(router, { name: "playersettings" }),
    }),
    posX: evt.clientX,
    posY: evt.clientY,
  });
};

const renamePlayer = function () {
  if (!config.value) return;
  eventbus.emit("playerRenameDialog", {
    playerId: config.value.player_id,
    name: config.value.name,
    defaultName: config.value.default_name,
  });
};

const startPlayerSetup = function () {
  if (!config.value?.enabled) return;
  eventbus.emit("setupFlowDialog", {
    kind: "player",
    playerId: config.value.player_id,
  });
};

const enablePlayer = async function () {
  if (!config.value || enabling.value) return;
  const playerId = config.value.player_id;
  enabling.value = true;
  try {
    const updatedConfig = await api.savePlayerConfig(playerId, {
      enabled: true,
    });
    if (props.playerId === playerId) config.value = updatedConfig;
    toast.success($t("settings.player_saved"));
  } catch (err) {
    toast.error(String(err));
  } finally {
    enabling.value = false;
  }
};

async function loadConfig(playerId: string) {
  const requestId = ++configLoadRequestId;
  try {
    const updatedConfig = await api.getPlayerConfig(playerId);
    if (requestId === configLoadRequestId && props.playerId === playerId) {
      config.value = updatedConfig;
    }
  } catch (err) {
    if (requestId === configLoadRequestId && props.playerId === playerId) {
      toast.error(String(err));
    }
  }
}
</script>

<style scoped>
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

.player-banner {
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

.protocol-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.protocol-chip {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.3px;
}

.protocol-chip--clickable {
  cursor: pointer;
}

.protocol-chip--clickable:hover {
  opacity: 0.85;
}

.protocol-chip--unavailable {
  opacity: 0.4;
}

.chip-icon {
  margin: 0 !important;
  width: auto !important;
}

.chip-icon :deep(div) {
  margin-left: 0 !important;
  margin-right: 4px !important;
  width: 14px !important;
  height: 14px !important;
}

.chip-icon :deep(.svg-wrapper) {
  width: 14px !important;
  height: 14px !important;
}

.chip-icon :deep(.svg-wrapper svg) {
  width: 14px !important;
  height: 14px !important;
}

@media (max-width: 600px) {
  .header-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
