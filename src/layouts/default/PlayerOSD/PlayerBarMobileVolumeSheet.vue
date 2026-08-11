<template>
  <Sheet v-model:open="open">
    <SheetContent
      data-player-panel
      side="bottom"
      :show-close="false"
      class="player-bar-popout mobile-group-volume-sheet z-[998] gap-0 overflow-hidden rounded-xl p-0"
      overlay-class="mobile-group-volume-overlay z-[997]"
      @open-auto-focus="preventAutoFocus"
    >
      <PanelDragHandle @dismiss="open = false" />
      <SheetTitle class="sr-only">
        {{ $t("grouped_volume") }}
      </SheetTitle>
      <SheetDescription class="sr-only">
        {{ player.name }}
      </SheetDescription>
      <PlayerVolumePanel :player="player" />
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import PanelDragHandle from "@/components/PanelDragHandle.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Player } from "@/plugins/api/interfaces";
import PlayerVolumePanel from "./PlayerVolumePanel.vue";

defineProps<{
  player: Player;
}>();

const open = defineModel<boolean>("open", {
  default: false,
});

function preventAutoFocus(event: Event) {
  event.preventDefault();
}
</script>

<style>
.mobile-group-volume-sheet {
  right: 8px !important;
  bottom: calc(var(--mobile-navigation-height) + 8px) !important;
  left: 8px !important;
  /* grows with the group it shows, up to the room left above the navigation */
  max-height: calc(100dvh - var(--mobile-navigation-height) - 16px);
  width: auto !important;
}

.mobile-group-volume-overlay {
  bottom: var(--mobile-navigation-height) !important;
}

.mobile-group-volume-sheet [data-slot="slider-thumb"]::before {
  transition: transform 120ms ease;
}

.mobile-group-volume-sheet [data-slot="slider-thumb"]:active::before {
  transform: scale(1.8);
}
</style>
