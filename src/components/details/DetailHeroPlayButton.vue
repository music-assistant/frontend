<template>
  <!-- held to the room the row leaves it, so a long name ellipsizes before the
       buttons beside it would wrap away -->
  <div ref="wrapper" class="relative flex min-w-0" :style="roomStyle">
    <MenuButton
      ref="playButton"
      class="max-w-full min-w-0"
      truncate
      :text="playButtonText"
      :label="playSentence"
      :menu-button-label="`${$t('more_options')}: ${$t('play')}`"
      :loading="playActionInProgress"
      @click="playButtonClick()"
      @menu="playButtonClick(true)"
    />
    <!-- the full sentence, out of sight, to know whether it fits the row -->
    <MenuButton
      ref="sentenceProbe"
      class="pointer-events-none invisible absolute top-0 left-0 w-max"
      aria-hidden="true"
      inert
      truncate
      :text="playSentence"
    />
  </div>
</template>

<script setup lang="ts">
import MenuButton from "@/components/MenuButton.vue";
import { handlePlayBtnClick } from "@/helpers/media_item_actions";
import { getPlayerName, isBuiltinPlayer } from "@/helpers/players";
import { roomInRow } from "@/helpers/room_in_row";
import { api } from "@/plugins/api";
import {
  type MediaItemType,
  type SortDirection,
  type SortField,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { useResizeObserver } from "@vueuse/core";
import {
  computed,
  nextTick,
  onMounted,
  ref,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from "vue";

export interface Props {
  item: MediaItemType;
  // container the item belongs to, which gives the play menu its options for
  // playing on from the item (e.g. the podcast an episode belongs to)
  parentItem?: MediaItemType;
  // the order the item's tracks are listed in on its page, to play them that way
  tracksSortField?: SortField;
  tracksSortDirection?: SortDirection;
}
const props = withDefaults(defineProps<Props>(), {
  parentItem: undefined,
  tracksSortField: undefined,
  tracksSortDirection: undefined,
});

const wrapper = useTemplateRef<HTMLElement>("wrapper");
const playButton = useTemplateRef<ComponentPublicInstance>("playButton");
const sentenceProbe = useTemplateRef<ComponentPublicInstance>("sentenceProbe");

// what the button does, naming the player in full; also its label for screen
// readers and the tooltip
const playSentence = computed(() => {
  const player = store.activePlayer;
  if (!player) return $t("play");
  if (isBuiltinPlayer(player)) return $t("play_on_this_device");
  return $t("play_on_player", { player: getPlayerName(player, Infinity) });
});

// the player's name alone, for a row without room for the whole sentence
const playerName = computed(() => {
  const player = store.activePlayer;
  if (!player) return $t("play");
  if (isBuiltinPlayer(player)) return $t("this_device");
  return getPlayerName(player, Infinity);
});

// px the row leaves the button, and px the whole sentence needs; until the row
// is laid out, the sentence is taken to fit
const room = ref(Infinity);
const sentenceWidth = ref(0);

const sentenceFits = computed(() => sentenceWidth.value <= room.value);

// px the button keeps however crowded its row, room for the play icon, a few
// letters of the name and the dropdown; the menu button's own minimum (min-w-40)
const MIN_BUTTON_WIDTH = 160;

// inline, as a utility class would outrank it (they are all !important). Below
// the minimum the button keeps it, and a row that wraps moves its other
// buttons to the next line instead
const roomStyle = computed(() => ({
  maxWidth: Number.isFinite(room.value)
    ? `${Math.max(room.value, MIN_BUTTON_WIDTH)}px`
    : "100%",
}));

const playButtonText = computed(() =>
  sentenceFits.value ? playSentence.value : playerName.value,
);

/** The room the row leaves the button, and the width the whole sentence needs. */
const measure = function () {
  const probe = sentenceProbe.value?.$el as HTMLElement | undefined;
  if (!wrapper.value || !probe) return;
  // whole pixels, so sub-pixel widths beside it can't tip the row into wrapping
  room.value = Math.floor(roomInRow(wrapper.value));
  sentenceWidth.value = probe.offsetWidth;
};

onMounted(measure);
useResizeObserver(() => wrapper.value?.parentElement, measure);
watch(playSentence, () => nextTick(measure));

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
    undefined,
    undefined,
    undefined,
    props.tracksSortField,
    props.tracksSortDirection,
  );
};
</script>
