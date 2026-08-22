<template>
  <v-card
    class="flex-fill rounded-lg player-card"
    :class="{
      'player-disabled': !playerConfig.enabled,
      'player-unavailable': !isAvailable,
      'player-needs-setup': playerConfig.enabled && needsSetup,
    }"
    @click="handleClick"
  >
    <div class="card-content">
      <div class="card-header">
        <div class="player-icon-wrapper">
          <PlayerIcon :icon="player?.icon" :size="24" />
        </div>
        <div class="player-info">
          <div class="player-name">{{ playerName }}</div>
          <div class="provider-name">{{ providerName }}</div>
        </div>
        <v-btn
          icon="mdi-dots-vertical"
          size="small"
          variant="text"
          class="menu-btn"
          @click.stop="handleMenu"
        />
      </div>

      <!-- Player needs setup warning -->
      <div
        v-if="playerConfig.enabled && needsSetup"
        class="player-warning-card"
      >
        <div class="player-warning-inline">
          <v-icon icon="mdi-alert-circle" size="16" color="warning" />
          <span class="player-warning-text">{{
            $t("settings.player_needs_setup")
          }}</span>
        </div>
        <v-btn
          size="small"
          color="warning"
          variant="flat"
          block
          class="mt-2"
          @click.stop="handleSetup"
        >
          {{ $t("settings.start_setup") }}
        </v-btn>
      </div>

      <div class="card-footer">
        <div class="protocol-chips">
          <ProtocolChip
            v-for="protocol in outputProtocols"
            :key="protocol.output_protocol_id"
            :protocol="protocol"
          />
        </div>
        <div class="status-icons">
          <v-icon
            v-if="!playerConfig.enabled"
            icon="mdi-cancel"
            size="16"
            color="grey"
            :title="$t('settings.player_disabled')"
          />
          <v-icon
            v-else-if="needsSetup"
            icon="mdi-alert-circle"
            size="16"
            color="warning"
            :title="$t('settings.player_needs_setup')"
          />
          <v-icon
            v-else-if="!isAvailable"
            icon="mdi-timer-sand"
            size="16"
            color="grey"
            :title="$t('settings.player_not_available')"
          />
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import ProtocolChip from "@/components/ProtocolChip.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import { api } from "@/plugins/api";
import { PlayerConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  playerConfig: PlayerConfig;
}>();

const emit = defineEmits<{
  (e: "click", playerConfig: PlayerConfig): void;
  (e: "menu", event: Event, playerConfig: PlayerConfig): void;
  (e: "setup", playerConfig: PlayerConfig): void;
}>();

const player = computed(() => api.players[props.playerConfig.player_id]);
const isAvailable = computed(() => player.value?.available ?? false);
const needsSetup = computed(() => player.value?.needs_setup ?? false);
const providerDomain = computed(
  () =>
    api.getProviderManifest(props.playerConfig.provider)?.domain ||
    props.playerConfig.provider,
);
const providerName = computed(() => {
  if (player.value?.device_info) {
    return `${player.value.device_info.manufacturer} / ${player.value.device_info.model}`;
  }
  return (
    api.getProviderManifest(props.playerConfig.provider)?.name ||
    props.playerConfig.provider
  );
});

const playerName = computed(() => {
  return (
    props.playerConfig.name ||
    player.value?.name ||
    props.playerConfig.default_name ||
    props.playerConfig.player_id
  );
});

const outputProtocols = computed(() => {
  // all output methods for this player, native included
  return player.value?.output_protocols || [];
});

const handleClick = () => {
  emit("click", props.playerConfig);
};

const handleMenu = (event: Event) => {
  emit("menu", event, props.playerConfig);
};

const handleSetup = () => {
  emit("setup", props.playerConfig);
};
</script>

<style scoped>
.player-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  cursor: pointer;
}

.player-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.player-disabled {
  opacity: 0.6;
}

.player-unavailable {
  opacity: 0.7;
}

.player-needs-setup {
  border-left: 3px solid rgb(var(--v-theme-warning));
}

.player-warning-card {
  background: rgba(var(--v-theme-warning), 0.08);
  border-radius: 8px;
  margin: 8px 0 0 0;
  padding: 8px 12px;
}

.player-warning-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--v-theme-warning));
}

.player-warning-text {
  font-size: 13px;
  font-weight: 500;
}

.card-content {
  display: flex;
  flex-direction: column;
  padding: 16px;
  height: 100%;
  min-height: 120px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.player-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.15);
  flex-shrink: 0;
}

.player-info {
  flex: 1;
  min-width: 0;
}

.player-name {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-name {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-btn {
  flex-shrink: 0;
  align-self: flex-start;
  margin: -4px -8px 0 0;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 12px;
}

.protocol-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
}

.status-icons {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
