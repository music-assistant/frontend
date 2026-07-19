<template>
  <div class="player-card-title min-w-0">
    <div class="flex min-w-0 items-center gap-1.5">
      <span class="player-card-name truncate text-sm font-medium">
        {{ playerName }}
      </span>
      <slot />
    </div>
    <p
      v-if="memberNames.length > 0"
      class="player-card-group-members text-muted-foreground mt-0.5 text-pretty text-[11px] leading-4"
    >
      {{ memberNames.join(" • ") }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  playerName: string;
  memberNames: string[];
}>();
</script>
