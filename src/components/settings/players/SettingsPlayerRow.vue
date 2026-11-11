<template>
  <Item
    v-hold="onHold"
    variant="outline"
    size="sm"
    class="player-row cursor-pointer rounded-(--radius-xl) hover:bg-accent/50"
    :class="{
      'player-disabled opacity-60': !playerConfig.enabled,
      'player-unavailable opacity-70': isUnavailable,
    }"
    @click.capture="swallowClickAfterHold"
    @click="emit('click', playerConfig)"
    @click.right.prevent="handleMenu"
    @touchstart.passive="onTouchStart"
  >
    <ItemMedia>
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-(--radius-lg) bg-primary/15"
      >
        <PlayerIcon :icon="player?.icon" :size="20" />
      </div>
    </ItemMedia>
    <ItemContent class="min-w-0 gap-1">
      <ItemTitle class="player-name w-full min-w-0 gap-1.5 text-base">
        <!-- the name is the focusable control; the row itself only follows the pointer -->
        <button
          type="button"
          class="min-w-0 cursor-pointer truncate text-left"
          data-testid="player-open"
          @click.stop="emit('click', playerConfig)"
        >
          {{ playerName }}
        </button>
        <PlayerDeviceBadge v-if="isThisDevice" label />
      </ItemTitle>
      <PlayerSetupWarning
        v-if="needsSetup"
        class="self-start"
        @setup="emit('setup', playerConfig)"
      />
      <div v-else class="flex min-w-0 items-center gap-2">
        <span class="truncate text-sm text-muted-foreground">
          {{ providerName }}
        </span>
        <span class="inline-flex flex-wrap gap-1 max-[960px]:hidden">
          <ProtocolChip
            v-for="protocol in outputProtocols"
            :key="protocol.output_protocol_id"
            :protocol="protocol"
          />
        </span>
      </div>
    </ItemContent>
    <ItemActions class="gap-1">
      <PlayerStatusIcon
        :enabled="playerConfig.enabled"
        :needs-setup="needsSetup"
        :unavailable="isUnavailable"
        class="size-5"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="menuLabel"
        :title="menuLabel"
        @click.stop="handleMenu"
      >
        <MoreVertical class="size-4" />
      </Button>
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
import PlayerDeviceBadge from "@/components/PlayerDeviceBadge.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import PlayerSetupWarning from "@/components/PlayerSetupWarning.vue";
import PlayerStatusIcon from "@/components/settings/players/PlayerStatusIcon.vue";
import ProtocolChip from "@/components/ProtocolChip.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useSettingsPlayer } from "@/composables/settings/players/useSettingsPlayer";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import type { PlayerConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { MoreVertical } from "@lucide/vue";
import { computed, toRef } from "vue";

const props = defineProps<{
  playerConfig: PlayerConfig;
}>();

const emit = defineEmits<{
  (e: "click", playerConfig: PlayerConfig): void;
  (e: "menu", event: Event, playerConfig: PlayerConfig): void;
  (e: "setup", playerConfig: PlayerConfig): void;
}>();

const {
  player,
  playerName,
  isUnavailable,
  isThisDevice,
  needsSetup,
  providerName,
  outputProtocols,
} = useSettingsPlayer(toRef(props, "playerConfig"));

const menuLabel = computed(() => `${$t("more_options")}: ${playerName.value}`);

const handleMenu = (event: Event) => {
  emit("menu", event, props.playerConfig);
};

const { onHold, onTouchStart, swallowClickAfterHold } =
  useHoldToOpenMenu(handleMenu);
</script>
