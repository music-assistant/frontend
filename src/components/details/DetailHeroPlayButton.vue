<template>
  <MenuButton
    ref="playButton"
    :text="playButtonText"
    :label="playButtonLabel"
    :class="{ 'min-w-0 max-w-full': isPhone }"
    :truncate="shrinkLabel || isPhone"
    :menu-button-label="`${$t('more_options')}: ${$t('play')}`"
    :loading="playActionInProgress"
    @click="playButtonClick()"
    @menu="playButtonClick(true)"
  />
</template>

<script setup lang="ts">
import MenuButton from "@/components/MenuButton.vue";
import { handlePlayBtnClick } from "@/helpers/media_item_actions";
import { getPlayerName, isBuiltinPlayer } from "@/helpers/players";
import { api } from "@/plugins/api";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed, useTemplateRef, type ComponentPublicInstance } from "vue";

export interface Props {
  item: MediaItemType;
  // container the item belongs to, which gives the play menu its options for
  // playing on from the item (e.g. the podcast an episode belongs to)
  parentItem?: MediaItemType;
  // let the button shrink and ellipsis its label to fit; for a row that cannot
  // wrap, so its other buttons keep their place as the header narrows
  shrinkLabel?: boolean;
  // the order the item's tracks are listed in on its page, to play them that way
  tracksSortBy?: string;
}
const props = withDefaults(defineProps<Props>(), {
  parentItem: undefined,
  shrinkLabel: false,
  tracksSortBy: undefined,
});

const playButton = useTemplateRef<ComponentPublicInstance>("playButton");

const isPhone = computed(() => isPhoneSizedScreen());

// the longest player name the play sentence shows on a wider screen
const SENTENCE_NAME_LENGTH = 20;

/** "Play on <player>", with the player's name cut at `nameLength`. */
const playSentence = function (nameLength: number) {
  const player = store.activePlayer;
  if (!player) return $t("play");
  if (isBuiltinPlayer(player)) return $t("play_on_this_device");
  return $t("play_on_player", { player: getPlayerName(player, nameLength) });
};

// what the button does, with the player's full name for screen readers and the
// tooltip
const playButtonLabel = computed(() => playSentence(Infinity));

// a phone has room for the player's name only, which the play icon leads and
// the button ellipsizes when it is long
const playButtonText = computed(() => {
  const player = store.activePlayer;
  if (!player || !isPhone.value) return playSentence(SENTENCE_NAME_LENGTH);
  if (isBuiltinPlayer(player)) return $t("this_device");
  return getPlayerName(player, Infinity);
});

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
    props.parentItem,
    forceMenu,
    undefined,
    props.tracksSortBy,
  );
};
</script>
