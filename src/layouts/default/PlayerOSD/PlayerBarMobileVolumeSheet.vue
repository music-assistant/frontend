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
/* the paired class outweighs the equally-!important inset utilities the sheet
   carries */
.player-bar-popout.mobile-group-volume-sheet {
  right: var(--player-bar-popout-gap) !important;
  bottom: calc(
    var(--mobile-navigation-height) + var(--player-bar-popout-gap)
  ) !important;
  left: var(--player-bar-popout-gap) !important;
  width: auto !important;
  /* a sheet has no popper measuring the free space for it, so it grows with the
     group it shows up to the room left above the navigation instead */
  max-height: calc(
    100dvh - var(--mobile-navigation-height) - var(--player-bar-popout-gap) -
      var(--player-bar-popout-top-gap)
  );
}

/* :root lifts this above the equally-!important inset-0 the backdrop carries */
:root .mobile-group-volume-overlay {
  bottom: var(--mobile-navigation-height) !important;
}
</style>
