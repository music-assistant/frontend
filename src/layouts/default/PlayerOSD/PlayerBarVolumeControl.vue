<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <button
        v-if="open"
        data-player-volume-backdrop
        type="button"
        class="modal-backdrop player-volume-backdrop player-volume-backdrop-desktop fixed inset-x-0 top-0 z-[997]"
        :aria-label="$t('close')"
        @click.stop.prevent="close"
      ></button>
    </Transition>
  </Teleport>

  <Popover :open="open" @update:open="handleOpenChange">
    <PopoverAnchor :reference="playerBarEndAnchor" />
    <PopoverTrigger as-child>
      <Button
        data-player-volume-trigger
        variant="ghost"
        class="player-control-button player-bar-action player-bar-volume-button h-20 w-16 rounded-none px-1"
        :data-active="open"
        :data-suppress-hover="suppressHover"
        :disabled="disabled"
        :aria-label="`${$t('audio_overlay_volume')}: ${displayVolume}%`"
        :aria-expanded="open"
        aria-haspopup="dialog"
        @click.capture="handleTriggerClick"
        @pointerleave="suppressHover = false"
        @wheel="adjustVolume"
      >
        <span class="player-bar-action-icon">
          <component
            :is="volumeIcon"
            :stroke-width="1.4"
            class="size-7"
            :style="{ transform: `translateX(${volumeIconOffset}px)` }"
          />
        </span>
        <span
          class="player-bar-action-label w-10 overflow-visible text-center tabular-nums"
        >
          {{ displayVolume }}%
        </span>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      data-player-panel
      side="top"
      align="end"
      :side-offset="PLAYER_BAR_POPOUT_GAP"
      :collision-padding="PLAYER_BAR_POPOUT_COLLISION_PADDING"
      class="player-bar-popout player-volume-popover flex w-[340px] max-w-[calc(100vw-2*var(--player-bar-popout-gap))] flex-col overflow-hidden p-0"
      @open-auto-focus="preventAutoFocus"
      @interact-outside="handleInteractOutside"
    >
      <PanelDragHandle @dismiss="close" />
      <PlayerVolumePanel :player="player" :allow-wheel="true" />
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import PanelDragHandle from "@/components/PanelDragHandle.vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PLAYER_BAR_POPOUT_COLLISION_PADDING,
  PLAYER_BAR_POPOUT_GAP,
  playerBarEndAnchor,
} from "@/helpers/player_bar";
import { isPlayerGrouped } from "@/helpers/players";
import { getVolumeIconComponent } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { type Player, PlayerFeature } from "@/plugins/api/interfaces";
import { computed, ref } from "vue";
import PlayerVolumePanel from "./PlayerVolumePanel.vue";

const props = defineProps<{
  player: Player;
}>();

const open = ref(false);
const suppressHover = ref(false);

const grouped = computed(() => isPlayerGrouped(props.player));
const displayVolume = computed(() =>
  Math.round(
    grouped.value
      ? (props.player.group_volume ?? 0)
      : (props.player.volume_level ?? 0),
  ),
);
const muted = computed(() =>
  grouped.value
    ? props.player.group_volume_muted === true
    : props.player.volume_muted === true,
);
const volumeIcon = computed(() =>
  getVolumeIconComponent(props.player, displayVolume.value, muted.value),
);
const volumeIconOffset = computed(() => {
  if (muted.value || displayVolume.value >= 50) return 0;
  return displayVolume.value === 0 ? 3 : 1.5;
});
const disabled = computed(
  () =>
    !props.player.available ||
    props.player.powered === false ||
    !props.player.supported_features.includes(PlayerFeature.VOLUME_SET),
);
function handleOpenChange(value: boolean) {
  open.value = value;
}

function handleTriggerClick() {
  suppressHover.value = open.value;
}

function preventAutoFocus(event: Event) {
  event.preventDefault();
}

function handleInteractOutside(event: Event) {
  const originalEvent = (event as CustomEvent<{ originalEvent?: Event }>).detail
    ?.originalEvent;
  const target = originalEvent?.target;
  if (
    target instanceof Element &&
    target.closest(
      "[data-player-volume-trigger], [data-player-volume-backdrop]",
    )
  ) {
    event.preventDefault();
  }
}

function close() {
  open.value = false;
}

function adjustVolume(event: WheelEvent) {
  if (disabled.value || muted.value || event.deltaY === 0) {
    return;
  }
  event.preventDefault();
  if (grouped.value) {
    if (event.deltaY < 0) {
      api.playerCommandGroupVolumeUp(props.player.player_id);
    } else {
      api.playerCommandGroupVolumeDown(props.player.player_id);
    }
  } else if (event.deltaY < 0) {
    api.playerCommandVolumeUp(props.player.player_id);
  } else {
    api.playerCommandVolumeDown(props.player.player_id);
  }
}
</script>

<style>
.player-volume-backdrop-desktop {
  bottom: var(--bottom-bars-height);
}

/* the paired class outweighs the equally-!important z-index utility the popover
   component carries */
.player-bar-popout.player-volume-popover {
  z-index: 998 !important;
}
</style>
