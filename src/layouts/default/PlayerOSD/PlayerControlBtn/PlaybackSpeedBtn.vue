<template>
  <v-menu
    v-if="isVisible && playerQueue"
    location="top"
    :close-on-content-click="true"
  >
    <template #activator="{ props: menu }">
      <Button
        v-bind="{ ...menu }"
        variant="icon"
        :title="$t('playback_speed')"
        :disabled="!playerQueue.active || playerQueue.items === 0"
        :style="currentSpeed !== 1.0 ? { color: activeColor } : {}"
      >
        <span class="speed-label">{{ formatSpeed(currentSpeed) }}</span>
      </Button>
    </template>

    <v-list density="compact" nav>
      <v-list-subheader>{{ $t("playback_speed") }}</v-list-subheader>
      <v-list-item
        v-for="speed in SPEED_PRESETS"
        :key="speed"
        :title="formatSpeed(speed)"
        :active="Math.abs(currentSpeed - speed) < 0.01"
        active-color="primary"
        @click="setSpeed(speed)"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import api from "@/plugins/api";
import { PlayerQueue } from "@/plugins/api/interfaces";
import { computed } from "vue";

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  isVisible?: boolean;
  activeColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
  activeColor: "rgb(var(--v-theme-primary))",
});

const currentSpeed = computed<number>(() => {
  const speed = props.playerQueue?.extra_attributes?.playback_speed;
  return typeof speed === "number" ? speed : 1.0;
});

function formatSpeed(speed: number): string {
  return speed === 1.0 ? "1×" : `${speed}×`;
}

function setSpeed(speed: number) {
  if (props.playerQueue) {
    api.queueCommandSetPlaybackSpeed(props.playerQueue.queue_id, speed);
  }
}
</script>

<style scoped>
.speed-label {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 28px;
  text-align: center;
}
</style>
