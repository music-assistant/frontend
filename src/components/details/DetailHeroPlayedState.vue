<template>
  <!-- the chrome of the hero buttons, for a fact that is not an action. Unplayed,
       it still holds its place so the buttons after it keep their position -->
  <span
    class="inline-flex flex-none items-center justify-center border border-white/25 bg-black/40"
    :class="[
      isPhone ? 'size-11 rounded-[10px]' : 'size-9 rounded-lg',
      { invisible: !label },
    ]"
    :role="label ? 'img' : undefined"
    :aria-hidden="label ? undefined : 'true'"
    :title="label"
    :aria-label="label"
  >
    <Check v-if="playedState === 'fully_played'" :size="20" />
    <ClockFading v-else-if="playedState === 'in_progress'" :size="20" />
  </span>
</template>

<script setup lang="ts">
import { getPlayedState } from "@/helpers/played_state";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { Check, ClockFading } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item: MediaItemType;
}
const props = defineProps<Props>();

const isPhone = computed(() => isPhoneSizedScreen());
const playedState = computed(() => getPlayedState(props.item));
const label = computed(() => {
  if (playedState.value === "fully_played") return $t("item_fully_played");
  return playedState.value ? $t("item_in_progress") : undefined;
});
</script>
