<template>
  <Card
    v-hold="onHold"
    class="player-card min-h-[120px] cursor-pointer gap-3 rounded-(--radius-xl) p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
    :class="{
      'player-disabled opacity-60': !playerConfig.enabled,
      'player-unavailable opacity-70': isUnavailable,
    }"
    @click.capture="swallowClickAfterHold"
    @click="handleClick"
    @click.right.prevent="handleMenu"
    @touchstart.passive="onTouchStart"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex size-12 shrink-0 items-center justify-center rounded-(--radius-lg) bg-primary/15"
      >
        <PlayerIcon :icon="player?.icon" :size="24" />
      </div>
      <div class="min-w-0 flex-1">
        <div
          class="player-name flex items-center gap-1.5 text-base leading-snug font-medium"
        >
          <!-- the name is the focusable control; the card itself only follows the pointer -->
          <button
            type="button"
            class="min-w-0 cursor-pointer truncate text-left"
            data-testid="player-open"
            @click.stop="handleClick"
          >
            {{ playerName }}
          </button>
          <PlayerDeviceBadge v-if="isThisDevice" label />
        </div>
        <div class="mt-0.5 truncate text-[13px] text-muted-foreground">
          {{ providerName }}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="-mt-1 -mr-2 shrink-0 self-start"
        :aria-label="menuLabel"
        :title="menuLabel"
        @click.stop="handleMenu"
      >
        <MoreVertical class="size-4" />
      </Button>
    </div>

    <PlayerSetupWarning v-if="needsSetup" @setup="handleSetup" />

    <div class="mt-auto flex items-center justify-between">
      <div class="flex flex-1 flex-wrap gap-1">
        <ProtocolChip
          v-for="protocol in outputProtocols"
          :key="protocol.output_protocol_id"
          :protocol="protocol"
        />
      </div>
      <PlayerStatusIcon
        :enabled="playerConfig.enabled"
        :unavailable="isUnavailable"
        class="size-4"
      />
    </div>
  </Card>
</template>

<script setup lang="ts">
import PlayerDeviceBadge from "@/components/PlayerDeviceBadge.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import PlayerSetupWarning from "@/components/PlayerSetupWarning.vue";
import PlayerStatusIcon from "@/components/settings/players/PlayerStatusIcon.vue";
import ProtocolChip from "@/components/ProtocolChip.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettingsPlayer } from "@/composables/settings/players/useSettingsPlayer";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { PlayerConfig } from "@/plugins/api/interfaces";
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

const handleClick = () => {
  emit("click", props.playerConfig);
};

const handleMenu = (event: Event) => {
  emit("menu", event, props.playerConfig);
};

const { onHold, onTouchStart, swallowClickAfterHold } =
  useHoldToOpenMenu(handleMenu);

const handleSetup = () => {
  emit("setup", props.playerConfig);
};
</script>
