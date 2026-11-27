<template>
  <div class="player-card-title flex min-w-0 items-center gap-1.5">
    <span class="player-card-name truncate text-sm font-medium">
      {{ playerName }}
    </span>
    <Badge
      v-if="selected"
      as="span"
      variant="default"
      class="selected-player-indicator h-5 px-2 py-0 ml-1 text-[11px] leading-none shadow-none"
    >
      {{ $t("player_tip.selected") }}
    </Badge>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";

defineProps<{
  playerName: string;
  selected?: boolean;
}>();
</script>
