<script setup lang="ts">
import PanelDragHandle from "@/components/PanelDragHandle.vue";
import { Command, CommandDialog } from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { focusCommandInputOnOpen } from "@/helpers/dialog_focus";
import { store } from "@/plugins/store";
import { computed } from "vue";

const props = defineProps<{
  title: string;
  description: string;
}>();

const open = defineModel<boolean>("open", { default: false });

const asSheet = computed(() => store.mobileLayout);
</script>

<template>
  <Sheet v-if="asSheet" v-model:open="open">
    <SheetContent
      data-player-panel
      side="bottom"
      :show-close="false"
      class="player-bar-popout command-center-sheet z-[998] gap-0 overflow-hidden rounded-xl p-0"
      overlay-class="command-center-sheet-overlay z-[997]"
      @open-auto-focus="focusCommandInputOnOpen"
    >
      <PanelDragHandle @dismiss="open = false" />
      <SheetTitle class="sr-only">{{ props.title }}</SheetTitle>
      <SheetDescription class="sr-only">
        {{ props.description }}
      </SheetDescription>
      <Command class="flex min-h-0 flex-1 flex-col">
        <slot></slot>
      </Command>
    </SheetContent>
  </Sheet>

  <CommandDialog
    v-else
    v-model:open="open"
    :title="props.title"
    :description="props.description"
    :show-close-button="false"
    :focus-input-on-open="true"
    content-class="top-[10%] flex translate-y-0 flex-col gap-0 sm:max-w-2xl"
  >
    <slot></slot>
  </CommandDialog>
</template>

<style>
.player-bar-popout.command-center-sheet {
  right: var(--player-bar-popout-inset-x) !important;
  bottom: calc(
    var(--mobile-navigation-height) + var(--player-bar-popout-gap)
  ) !important;
  left: var(--player-bar-popout-inset-x) !important;
  width: auto !important;

  height: calc(
    100dvh - var(--mobile-navigation-height) - var(--player-bar-popout-gap) -
      var(--player-bar-popout-top-gap)
  );
  max-height: calc(
    100dvh - var(--mobile-navigation-height) - var(--player-bar-popout-gap) -
      var(--player-bar-popout-top-gap)
  );
}

:root .command-center-sheet-overlay {
  bottom: var(--mobile-navigation-height) !important;
}
</style>
