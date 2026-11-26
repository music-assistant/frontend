<template>
  <section class="edit-player">
    <div v-if="config">
      <!-- Header card -->
      <Card class="mb-4 gap-0 py-0">
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
                {{ getPlayerTypeLabel(api.players[config.player_id]) }}
              </span>
            </div>
            <div
              v-if="api.players[config.player_id]?.output_protocols.length"
              class="protocol-chips"
            >
              <ProtocolChip
                v-for="protocol in api.players[config.player_id]
                  .output_protocols"
                :key="protocol.output_protocol_id"
                :protocol="protocol"
                link-to-docs
              />
            </div>
          </div>
          <Button
            data-testid="player-menu"
            variant="ghost"
            size="icon-sm"
            class="absolute top-4 right-4"
            aria-haspopup="menu"
            :aria-label="$t('more_options')"
            @click="openPlayerMenu"
          >
            <MoreVertical class="size-4" />
          </Button>
        </CardHeader>
        <CardContent
          class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4"
        >
          <Button
            v-if="playerSetupLabel"
            data-testid="player-setup"
            @click="startPlayerSetup"
          >
            <RefreshCw class="size-4" />
            {{ $t(playerSetupLabel) }}
          </Button>
          <Button
            as="a"
            data-testid="player-documentation"
            variant="outline"
            :href="documentationUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen class="size-4" />
            {{ $t("settings.documentation") }}
          </Button>
        </CardContent>
      </Card>
    </div>

    <!-- Disabled banner -->
    <v-alert
      v-if="config && !config.enabled"
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
      <div class="disabled-banner">
        <span>{{ setupReason ?? $t("settings.player_needs_setup") }}</span>
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
      <div class="disabled-banner">
        <span>{{ setupReason ?? $t("settings.player_not_available") }}</span>
      </div>
    </v-alert>

    <PlayerSettingsLinks
      v-if="config"
      :player-id="config.player_id"
      :has-outputs="configPages.has('outputs')"
      :has-controls="configPages.has('controls')"
      class="mb-4"
    />

    <!-- the outputs of a group show on this page -->
    <edit-config
      v-if="config"
      ref="editConfig"
      :disabled="!config?.enabled"
      :config-entries="config_entries"
      :output-protocols="player?.output_protocols || []"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <v-overlay
      :model-value="loading || enabling"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { computed, markRaw, ref } from "vue";
import { useRouter } from "vue-router";
import ProtocolChip from "@/components/ProtocolChip.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/plugins/api";
import {
  ConfigEntryType,
  ConfigValueType,
  PlayerFeature,
  PlayerType,
  IdentifierType,
} from "@/plugins/api/interfaces";
import { ConfigEntryUI, isInjected } from "@/helpers/config_entry_ui";
import { goBack } from "@/helpers/navigation";
import {
  getPlayerConfigPage,
  getPlayerName,
  getPlayerSetupLabel,
  type PlayerConfigPage,
} from "@/helpers/player_config";
import { getPlayerSettingsMenuItems } from "@/helpers/player_settings_actions";
import { getPlayerSetupReason, getPlayerTypeLabel } from "@/helpers/players";
import { getExternalLinkUrl } from "@/helpers/utils";
import { useMultiChannelCandidates } from "@/composables/settings/players/useMultiChannelCandidates";
import { usePlayerConfig } from "@/composables/settings/players/usePlayerConfig";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import {
  BookOpen,
  MoreVertical,
  Pencil,
  RefreshCw,
  RotateCcw,
} from "@lucide/vue";
import EditConfig from "./EditConfig.vue";
import PlayerSettingsLinks from "./PlayerSettingsLinks.vue";

const PLAYER_DOCS_URL =
  "https://music-assistant.io/settings/individual-player/";

// global refs
const router = useRouter();
const editConfig = ref<InstanceType<typeof EditConfig>>();

// props
const props = defineProps<{
  playerId?: string;
}>();

const {
  config,
  player,
  loading,
  enabling,
  enablePlayer,
  reloadConfig,
  save,
  onImmediateApply,
  onAction,
} = usePlayerConfig(() => props.playerId, editConfig);

// computed properties
const { layouts: multiChannelLayouts } = useMultiChannelCandidates(player);

const playerSetupLabel = computed(() =>
  config.value?.enabled ? getPlayerSetupLabel(player.value) : undefined,
);

const setupReason = computed(() => getPlayerSetupReason(player.value));

// the docs of a beta server live on the beta site
const documentationUrl = computed(() => getExternalLinkUrl(PLAYER_DOCS_URL));

// the outputs (but for those of a group) and the player controls have pages of their own
const config_entries = computed(() => {
  if (!config.value) return [];
  const player = api.players[config.value.player_id];
  if (!player) return [];

  const entries: ConfigEntryUI[] = Object.values(config.value.values).filter(
    (entry) => getPlayerConfigPage(entry, player) === "player",
  );

  if (
    player.type === PlayerType.GROUP &&
    player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group",
      type: ConfigEntryType.LABEL,
      label: $t("settings.dsp_note_multi_device_group.label"),
      default_value: null,
      required: false,
      options: [],
      category: "dsp",
      injected: true,
    });
  } else if (player.type === PlayerType.GROUP) {
    entries.push({
      key: "dsp_note_multi_device_group_unsupported",
      type: ConfigEntryType.LABEL,
      label: $t("settings.dsp_note_multi_device_group_unsupported.label"),
      default_value: null,
      required: false,
      options: [],
      category: "dsp",
      injected: true,
    });
  }
  // Frontend-injected entries need their category heading translated here
  // (server-provided entries get category_label resolved server-side).
  for (const entry of entries) {
    if (isInjected(entry) && entry.category) {
      entry.category_label = $t(
        `settings.category.${entry.category}`,
        entry.category,
      );
    }
  }
  return entries;
});

// the pages that show an entry of the config, so no row leads to an empty page
const configPages = computed(() => {
  const pages = new Set<PlayerConfigPage>();
  if (!config.value || !player.value) return pages;
  for (const entry of Object.values(config.value.values)) {
    if (!entry.hidden) pages.add(getPlayerConfigPage(entry, player.value));
  }
  return pages;
});

// methods
const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
};

const openPlayerMenu = function (evt: MouseEvent) {
  if (!config.value) return;
  const menuItems = getPlayerSettingsMenuItems(config.value, {
    // the player is gone, and with it the page showing its settings; unsaved
    // edits have nothing left to save to, so they must not hold the way out
    onDeleted: () => {
      editConfig.value?.discardChanges();
      router.replace({ name: "playersettings" });
    },
    // the player went into the one that stays, which now holds its settings
    onMerged: (targetPlayerId) => {
      editConfig.value?.discardChanges();
      router.replace(`/settings/editplayer/${targetPlayerId}`);
    },
    multiChannelLayouts: multiChannelLayouts.value,
    // the server numbers the speakers anew, so the form starts over from what is stored
    onSpeakersChanged: reloadConfig,
  });
  // resetting acts on the form rather than on the player, so it is not part of
  // the menu the other player surfaces share
  menuItems.push({
    label: "settings.reset_to_defaults",
    action: resetToDefaults,
    icon: markRaw(RotateCcw),
    disabled: !config.value.enabled,
  });
  // a click from the keyboard carries no coordinates, so fall back to the
  // button itself and the menu opens against it rather than in the corner
  const trigger =
    evt.clientX || evt.clientY
      ? undefined
      : (evt.currentTarget as HTMLElement | null)?.getBoundingClientRect();
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: trigger ? trigger.left : evt.clientX,
    posY: trigger ? trigger.bottom : evt.clientY,
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
  if (!config.value?.enabled || !playerSetupLabel.value) return;
  eventbus.emit("setupFlowDialog", {
    kind: "player",
    playerId: config.value.player_id,
  });
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  values["enabled"] = config.value!.enabled;
  if (await save(values)) goBack(router, { name: "playersettings" });
};
</script>

<style scoped>
.edit-player {
  padding: 16px;
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

.protocol-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 8px;
}

@media (max-width: 600px) {
  .header-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
