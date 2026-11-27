<template>
  <label
    :for="checkboxId"
    class="player-group-member flex min-h-9 items-center gap-2 rounded-md pr-2 transition-colors"
    :class="{
      'bg-primary/10': modelValue,
      'hover:bg-accent/50 cursor-pointer': !disabled,
      'cursor-not-allowed': disabled,
    }"
  >
    <span
      class="player-group-member-icon flex h-6 w-[30px] shrink-0 items-center justify-center"
    >
      <PlayerIcon
        :icon="player.icon"
        :size="18"
        class="text-muted-foreground"
        :class="{
          'opacity-50': player.powered === false || !player.available,
        }"
      />
    </span>
    <span
      class="min-w-0 flex-1 truncate text-xs font-medium"
      :class="{ 'text-muted-foreground': !player.available }"
    >
      {{ getPlayerDisplayName(player) }}
    </span>
    <PlayerStatusIcon
      :enabled="true"
      :unavailable="!player.available"
      :reason="getPlayerSetupReason(player)"
      class="size-4"
    />
    <Checkbox
      :id="checkboxId"
      :model-value="modelValue"
      :disabled="disabled"
      :aria-label="getPlayerDisplayName(player)"
      class="border-muted-foreground/70 bg-background/70 size-5 border-2 shadow-sm"
      @update:model-value="emit('update:modelValue', $event === true)"
    />
  </label>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import PlayerStatusIcon from "@/components/settings/players/PlayerStatusIcon.vue";
import { Checkbox } from "@/components/ui/checkbox";
import { getPlayerDisplayName, getPlayerSetupReason } from "@/helpers/players";
import type { Player } from "@/plugins/api/interfaces";

const { disabled = false } = defineProps<{
  player: Player;
  // whether the player is (picked as) a member
  modelValue: boolean;
  checkboxId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [selected: boolean];
}>();
</script>
