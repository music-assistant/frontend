<template>
  <div>
    <Separator class="my-2" />
    <div
      v-for="player in players"
      :key="player.player_id"
      class="space-y-0.5 py-1"
      :class="{ 'opacity-50': player.powered === false }"
    >
      <div class="flex items-center gap-2 pr-2">
        <span
          class="player-child-volume-icon flex h-6 w-[30px] shrink-0 items-center justify-center"
        >
          <PlayerIcon
            :icon="player.icon"
            :size="18"
            class="text-muted-foreground"
          />
        </span>
        <span class="min-w-0 flex-1 truncate text-xs font-medium">
          {{ player.name }}
        </span>
      </div>
      <PlayerVolume :player="player" :allow-wheel="allowWheel" width="100%" />
    </div>
  </div>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import { Separator } from "@/components/ui/separator";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import type { Player } from "@/plugins/api/interfaces";

defineProps<{
  players: Player[];
  allowWheel?: boolean;
}>();
</script>
