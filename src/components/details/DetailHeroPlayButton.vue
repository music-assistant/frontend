<template>
  <MenuButton
    ref="playButton"
    :text="playButtonText"
    :menu-button-label="`${$t('more_options')}: ${$t('play')}`"
    :loading="playActionInProgress"
    @click="playButtonClick()"
    @menu="playButtonClick(true)"
  />
</template>

<script setup lang="ts">
import MenuButton from "@/components/MenuButton.vue";
import { handlePlayBtnClick } from "@/helpers/media_item_actions";
import { getPlayerName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, useTemplateRef, type ComponentPublicInstance } from "vue";

export interface Props {
  item: MediaItemType;
}
const props = defineProps<Props>();

const playButton = useTemplateRef<ComponentPublicInstance>("playButton");

const playButtonText = computed(() =>
  store.activePlayer
    ? $t("play_on_player", { player: getPlayerName(store.activePlayer, 20) })
    : $t("play"),
);

// The queue playMedia targets are resolved directly, since activePlayerQueue is
// undefined while an external source is active.
const playActionInProgress = computed(() => {
  const player = store.activePlayer;
  if (!player) return false;
  const queueId =
    player.active_source && player.active_source in api.queues
      ? player.active_source
      : player.player_id;
  return (
    api.queues[queueId]?.extra_attributes?.play_action_in_progress === true
  );
});

const playButtonClick = function (forceMenu = false) {
  // the play menu hangs from the play button, like on the other detail pages
  const rect = (
    playButton.value?.$el as HTMLElement | undefined
  )?.getBoundingClientRect();
  handlePlayBtnClick(
    props.item,
    rect?.right ?? 0,
    rect?.bottom ?? 0,
    undefined,
    forceMenu,
  );
};
</script>
