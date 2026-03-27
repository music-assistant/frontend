<template>
  <Card
    class="flex-fill rounded-lg player-card cursor-pointer"
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
          <component
            :is="resolveIconHelper(player?.icon || 'mdi-speaker')"
            :size="24"
          />
        </div>
        <div class="player-info">
          <div class="player-name">{{ playerName }}</div>
          <div class="provider-name">{{ providerName }}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="menu-btn h-8 w-8"
          @click.stop="handleMenu"
        >
          <MoreVertical class="h-4 w-4" />
        </Button>
      </div>

      <!-- Player needs setup warning -->
      <div
        v-if="playerConfig.enabled && needsSetup"
        class="player-warning-card"
      >
        <div class="player-warning-inline">
          <AlertCircle class="h-4 w-4 text-amber-500" />
          <span class="player-warning-text">{{
            $t("settings.player_needs_setup")
          }}</span>
        </div>
      </div>

      <div class="card-footer">
        <div class="protocol-chips">
          <Badge
            v-for="protocol in outputProtocols"
            :key="protocol.output_protocol_id"
            variant="secondary"
            class="protocol-chip text-[10px] uppercase tracking-wide"
            :class="{ 'protocol-chip--unavailable': !protocol.available }"
          >
            <ProviderIcon
              :domain="protocol.protocol_domain!"
              :size="14"
              class="chip-icon mr-1"
            />
            {{
              api.getProviderManifest(protocol.protocol_domain!)?.name ||
              protocol.protocol_domain
            }}
          </Badge>
        </div>
        <div class="status-icons">
          <Ban
            v-if="!playerConfig.enabled"
            class="h-4 w-4 text-gray-500"
            :title="$t('settings.player_disabled')"
          />
          <AlertCircle
            v-else-if="needsSetup"
            class="h-4 w-4 text-amber-500"
            :title="$t('settings.player_needs_setup')"
          />
          <History
            v-else-if="!isAvailable"
            class="h-4 w-4 text-gray-500"
            :title="$t('settings.player_not_available')"
          />
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import { PlayerConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { resolveIcon as resolveIconHelper } from "@/helpers/iconMapping";
import { AlertCircle, Ban, History, MoreVertical } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  playerConfig: PlayerConfig;
}>();

const emit = defineEmits<{
  (e: "click", playerConfig: PlayerConfig): void;
  (e: "menu", event: Event, playerConfig: PlayerConfig): void;
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
  // Return only non-native protocols (ones with a protocol_domain)
  return player.value?.output_protocols || [];
});

const handleClick = () => {
  emit("click", props.playerConfig);
};

const handleMenu = (event: Event) => {
  emit("menu", event, props.playerConfig);
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
  box-shadow: var(--shadow-lg);
}

.player-disabled {
  opacity: 0.6;
}

.player-unavailable {
  opacity: 0.7;
}

.player-needs-setup {
  border-left: 3px solid var(--warning);
}

.player-warning-card {
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border-radius: 8px;
  margin: 8px 0 0 0;
  padding: 8px 12px;
}

.player-warning-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--warning);
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
  background: color-mix(in srgb, var(--primary) 15%, transparent);
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
  color: var(--muted-foreground);
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

.protocol-chip {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.3px;
}

.protocol-chip--unavailable {
  opacity: 0.4;
}

.status-icons {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.chip-icon {
  margin: 0 !important;
  width: 14px !important;
  height: 14px !important;
}
</style>
