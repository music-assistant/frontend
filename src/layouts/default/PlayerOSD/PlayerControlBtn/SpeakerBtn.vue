<template>
  <!-- active player -->
  <Button
    variant="icon"
    :ripple="false"
    :icon="getBreakpointValue('bp6') ? false : true"
    @click="store.showPlayersMenu = true"
  >
    <v-badge
      v-if="curGroupPlayers && curGroupPlayers.length > 0"
      size="small"
      :content="store.selectedPlayer?.group_childs.length"
    >
      <v-icon :color="props.color ? color : ''" :size="24">mdi-speaker</v-icon>
    </v-badge>
    <v-icon v-else :color="props.color ? color : ''" :size="24">mdi-speaker</v-icon>
    <h6 v-if="activePlayerQueue && getBreakpointValue('bp6')" class="line-clamp-1">
      {{ truncateString(activePlayerQueue?.display_name, 8) }}
    </h6>
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import { getBreakpointValue } from '@/plugins/breakpoint';
import Button from '@/components/mods/Button.vue';
import { isColorDark, truncateString } from '@/helpers/utils';

// properties
export interface Props {
  color?: string;
}
const props = defineProps<Props>();

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});

const curGroupPlayers = computed(() => {
  if (store.selectedPlayer) {
    return store.selectedPlayer.group_childs;
  }
  return undefined;
});
</script>
