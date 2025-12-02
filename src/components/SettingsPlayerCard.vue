<template>
  <v-card
    class="flex-fill rounded-lg player-card"
    min-height="200px"
    @click="handleClick"
  >
    <template #prepend>
      <provider-icon
        :domain="providerDomain"
        :size="50"
        class="listitem-media-thumb"
        style="margin-top: 5px; margin-bottom: 5px"
      />
    </template>

    <template #append>
      <v-btn
        v-if="!playerConfig.enabled"
        variant="text"
        size="small"
        icon
        :title="$t('settings.player_disabled')"
        @click.stop
      >
        <v-icon color="grey">mdi-cancel</v-icon>
      </v-btn>
      <v-btn
        v-else-if="!isAvailable"
        variant="text"
        size="small"
        icon
        :title="$t('settings.player_not_available')"
        @click.stop
      >
        <v-icon icon="mdi-timer-sand" />
      </v-btn>
      <v-btn
        variant="text"
        size="small"
        icon
        :title="playerTypeTitle"
        @click.stop
      >
        <v-icon :icon="playerTypeIcon" />
      </v-btn>
      <v-btn
        icon="mdi-dots-vertical"
        size="small"
        variant="text"
        @click.stop="handleMenu"
      />
    </template>

    <v-card-title>
      {{ playerName }}
    </v-card-title>

    <v-card-text class="player-description">
      <div class="provider-name">
        {{ providerName }}
      </div>
      <div v-if="playerTypeLabel" class="player-type-label">
        {{ playerTypeLabel }}
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import { PlayerConfig, PlayerType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
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
const providerDomain = computed(
  () =>
    api.getProviderManifest(props.playerConfig.provider)?.domain ||
    props.playerConfig.provider,
);
const providerName = computed(
  () =>
    api.getProviderManifest(props.playerConfig.provider)?.name ||
    props.playerConfig.provider,
);

const playerName = computed(() => {
  return (
    props.playerConfig.name ||
    player.value?.name ||
    props.playerConfig.default_name ||
    props.playerConfig.player_id
  );
});

const playerType = computed(() => player.value?.type ?? PlayerType.PLAYER);

const playerTypeTitle = computed(() => {
  return $t(`player_type.${playerType.value}`);
});

const playerTypeIcon = computed(() => {
  const iconMap = {
    [PlayerType.PLAYER]: "mdi-speaker",
    [PlayerType.GROUP]: "mdi-speaker-multiple",
    [PlayerType.STEREO_PAIR]: "mdi-speaker-wireless",
  };
  return iconMap[playerType.value] || "mdi-speaker";
});

const playerTypeLabel = computed(() => {
  if (playerType.value === PlayerType.PLAYER) {
    return null;
  }
  return $t(`player_type.${playerType.value}`);
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
  transition: all 0.2s ease;
  cursor: pointer;
}

.player-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.player-description {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-name {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-weight: 500;
}

.player-type-label {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
