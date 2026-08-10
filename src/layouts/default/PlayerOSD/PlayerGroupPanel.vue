<template>
  <PanelDragHandle @dismiss="emit('dismiss')" />
  <div
    data-panel-drag-region
    class="flex items-center justify-between gap-3 border-b px-4 pt-1 pb-3"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class="min-w-0 ml-1">
        <h2 class="text-base font-semibold">
          {{ $t("settings.group_members") }}
        </h2>
        <p class="text-muted-foreground truncate text-xs">
          {{ getPlayerName(player, 36) }}
        </p>
      </div>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          :class="{ 'text-primary': filter !== 'all' }"
          :aria-label="$t('settings.player_type_label')"
        >
          <EllipsisVertical class="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="z-[100001]">
        <DropdownMenuLabel>
          {{ $t("settings.player_type_label") }}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          :model-value="filter"
          @update:model-value="setFilter"
        >
          <DropdownMenuRadioItem value="all">
            {{ $t("genre_content_type.all") }}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="players">
            {{ $t("players") }}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem v-if="hasLights" value="lights">
            {{ $t("lights") }}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem v-if="hasVisualizers" value="visualizers">
            {{ $t("visualizers") }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <div class="player-group-list min-h-0 flex-1 overflow-y-auto px-4 pb-4">
    <PlayerGroupMembers
      :key="player.player_id"
      :player="player"
      :members="members"
      :filter="filter"
      :group-heading="$t('speakers_in_group')"
      :show-separator="false"
    />
  </div>
</template>

<script setup lang="ts">
import PanelDragHandle from "@/components/PanelDragHandle.vue";
import PlayerGroupMembers from "@/components/PlayerGroupMembers.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isPlayerGroupFilter,
  type PlayerGroupFilter,
} from "@/helpers/player_group";
import { getPlayerName } from "@/helpers/utils";
import type { Player } from "@/plugins/api/interfaces";
import { EllipsisVertical } from "@lucide/vue";

defineProps<{
  player: Player;
  members: Player[];
  filter: PlayerGroupFilter;
  hasLights: boolean;
  hasVisualizers: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
  "update:filter": [filter: PlayerGroupFilter];
}>();

function setFilter(value: unknown) {
  if (isPlayerGroupFilter(value)) emit("update:filter", value);
}
</script>

<style scoped>
.player-group-list {
  scrollbar-width: thin;
}

.player-group-list::-webkit-scrollbar {
  width: 6px;
}
</style>
