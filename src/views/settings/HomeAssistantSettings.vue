<template>
  <div class="space-y-6 p-6">
    <SettingsPageHeader page="home_assistant" />
    <template v-if="loaded">
      <Empty
        v-if="state === 'not_set_up'"
        class="rounded-xl border"
        data-testid="home-assistant-not-connected"
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <House />
          </EmptyMedia>
          <EmptyTitle>{{
            $t("settings.home_assistant.not_connected")
          }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("settings.home_assistant.connect_description") }}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button data-testid="home-assistant-connect" @click="connect">
            <Plug class="size-4" />
            {{ $t("settings.home_assistant.connect") }}
          </Button>
        </EmptyContent>
      </Empty>

      <template v-else>
        <SettingsLinkRows :rows="rows" test-id-prefix="home-assistant">
          <template #control="{ row }">
            <HassConnectionControl
              v-if="row.key === 'connection' && connectionAction"
              :action="connectionAction"
              :busy="connectionBusy"
              @run="runConnectionAction"
            />
            <!-- a provider that is not running has no players to choose, and
                 its page says why -->
            <HassPlayersControl
              v-else-if="row.key === 'players' && runningPlayersId"
              v-model:open="choosingPlayers"
              :instance-id="runningPlayersId"
            />
            <HassSignInControl
              v-else-if="row.key === 'sign_in'"
              :label="row.label"
            />
            <HassRemoteAccessControl
              v-else-if="row.key === 'remote_access'"
              :enabled="remoteAccessEnabled"
              :busy="remoteAccessBusy"
              :label="row.label"
              @update:enabled="setRemoteAccess"
            />
          </template>
        </SettingsLinkRows>
        <!-- the provider only has these settings while it is connected; the
             page's menu acts on the connection -->
        <SettingsPageForm
          v-if="state === 'connected'"
          page="home_assistant"
          embedded
        />
      </template>
    </template>

    <Empty v-else-if="loadFailed" class="rounded-xl border border-dashed py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <House />
        </EmptyMedia>
        <EmptyTitle>{{ $t("settings.settings_load_failed") }}</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <div v-else class="flex min-h-24 items-center justify-center">
      <Spinner class="size-6" />
    </div>
  </div>
</template>

<script setup lang="ts">
import HassConnectionControl from "@/components/settings/home-assistant/HassConnectionControl.vue";
import HassPlayersControl from "@/components/settings/home-assistant/HassPlayersControl.vue";
import HassRemoteAccessControl from "@/components/settings/home-assistant/HassRemoteAccessControl.vue";
import HassSignInControl from "@/components/settings/home-assistant/HassSignInControl.vue";
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useAIEngines } from "@/composables/settings/useAIEngines";
import { useHassConnectionActions } from "@/composables/settings/useHassConnectionActions";
import { useHomeAssistantConnection } from "@/composables/settings/useHomeAssistantConnection";
import { enginesOf } from "@/helpers/ai_engines";
import { engineSummary } from "@/helpers/ai_settings";
import {
  type HassConnectionState,
  remoteAccessStateKey,
} from "@/helpers/home_assistant";
import {
  getProviderStatusTranslationKey,
  isProviderErrorStatus,
} from "@/helpers/provider_config";
import { settingsPageRoute } from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderStatus,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import {
  CloudCog,
  House,
  LogIn,
  Plug,
  Plus,
  Sparkles,
  Speaker,
} from "@lucide/vue";
import { computed, markRaw } from "vue";

/**
 * The connection with Home Assistant and what it brings: its players, its AI
 * tasks and voices, signing in with it, remote access through Home Assistant
 * Link and its devices as player controls, each managed on the spot.
 */

const CONNECTION_STATE_KEYS: Readonly<Record<HassConnectionState, string>> = {
  not_set_up: "settings.home_assistant.not_connected",
  connected: "settings.home_assistant.state_connected",
  connecting: "settings.home_assistant.state_connecting",
  disabled: "settings.home_assistant.state_disabled",
  needs_attention: "settings.home_assistant.state_needs_attention",
};

const {
  hassConfig,
  playersConfig,
  remoteAccess,
  loaded,
  loadFailed,
  state,
  choosingPlayers,
  connect,
  addPlayers,
} = useHomeAssistantConnection();
const {
  enabled: remoteAccessEnabled,
  usingHaCloud,
  busy: remoteAccessBusy,
  setEnabled: setRemoteAccess,
} = remoteAccess;
const {
  action: connectionAction,
  busy: connectionBusy,
  runAction: runConnectionAction,
} = useHassConnectionActions(hassConfig);
const { engines, loaded: enginesLoaded } = useAIEngines();

const runningPlayersId = computed(() =>
  playersConfig.value?.status === ProviderStatus.LOADED
    ? playersConfig.value.instance_id
    : undefined,
);

const rows = computed<SettingsRow[]>(() => {
  const hass = hassConfig.value;
  if (!hass) return [];
  const items: SettingsRow[] = [connectionRow(hass)];
  const players = playersRow();
  if (players) items.push(players);
  // Home Assistant only provides engines while it is connected
  if (
    state.value === "connected" &&
    authManager.hasScope(Scope.CONFIG_CORE_WRITE)
  ) {
    items.push(aiRow(hass));
  }
  // Home Assistant only signs users in while it is connected
  if (
    state.value === "connected" &&
    authManager.hasScope(Scope.CONFIG_CORE_WRITE)
  ) {
    items.push({
      key: "sign_in",
      icon: markRaw(LogIn),
      label: $t("settings.home_assistant.sign_in"),
      description: $t("settings.home_assistant.sign_in_new_users"),
    });
  }
  if (authManager.hasScope(Scope.SYSTEM_MANAGE)) {
    items.push({
      key: "remote_access",
      icon: markRaw(CloudCog),
      label: $t("settings.remote_access"),
      description: $t("settings.home_assistant.remote_access_description"),
      // how it runs is only known once its details are in
      state:
        remoteAccessEnabled.value && usingHaCloud.value !== undefined
          ? $t(remoteAccessStateKey(usingHaCloud.value))
          : undefined,
    });
  }
  return items;
});

// the add-on makes the connection by itself
function connectionRow(hass: ProviderConfig): SettingsRow {
  const attention = state.value === "needs_attention";
  return {
    key: "connection",
    icon: markRaw(Plug),
    label: $t("settings.home_assistant.connection"),
    description: attention
      ? problemOf(hass)
      : $t(
          api.serverInfo.value?.homeassistant_addon
            ? "settings.home_assistant.connection_addon"
            : "settings.home_assistant.connection_description",
        ),
    state: $t(CONNECTION_STATE_KEYS[state.value]),
    error: attention,
  };
}

// the provider of the players has its players chosen on the spot while it
// runs, else leads to its page, and is offered while Home Assistant is
// connected
function playersRow(): SettingsRow | undefined {
  const players = playersConfig.value;
  const base = {
    key: "players",
    icon: markRaw(Speaker),
    label: $t("settings.home_assistant.players"),
  };
  if (!players) {
    if (state.value !== "connected") return undefined;
    return {
      ...base,
      description: $t("settings.home_assistant.players_description"),
      state: $t("settings.home_assistant.players_add"),
      actionIcon: markRaw(Plus),
      action: addPlayers,
    };
  }
  const attention = isProviderErrorStatus(players.status);
  return {
    ...base,
    description: attention
      ? problemOf(players)
      : $t("settings.home_assistant.players_description"),
    // only a running provider has players to count
    state:
      players.status === ProviderStatus.LOADED
        ? String(playerCount(players.instance_id))
        : $t(getProviderStatusTranslationKey(players.status)),
    error: attention,
    to: providerRoute(players),
  };
}

// the AI page manages the engines Home Assistant provides
function aiRow(hass: ProviderConfig): SettingsRow {
  return {
    key: "ai",
    icon: markRaw(Sparkles),
    label: $t("settings.home_assistant.ai"),
    description: $t("settings.home_assistant.ai_description"),
    // what it provides is only known once the engines are in
    state: enginesLoaded.value
      ? engineSummary(enginesOf(engines.value, hass.instance_id)) ||
        $t("settings.home_assistant.ai_none")
      : undefined,
    to: settingsPageRoute("ai"),
  };
}

function playerCount(instanceId: string): number {
  return Object.values(api.players).filter(
    (player) => player.provider === instanceId,
  ).length;
}

// the server localizes last_error.message for the connection's locale
function problemOf(config: ProviderConfig): string {
  return (
    config.last_error?.message ??
    $t(getProviderStatusTranslationKey(config.status))
  );
}

function providerRoute(config: ProviderConfig) {
  return { name: "editprovider", params: { instanceId: config.instance_id } };
}
</script>
