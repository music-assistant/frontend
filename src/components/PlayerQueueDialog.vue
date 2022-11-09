<!-- eslint-disable vue/no-mutating-props -->
<template>
  <v-dialog
    v-model="showQueueDialog"
    fullscreen
    :scrim="false"
    transition="dialog-bottom-transition"
  >
    <v-card style="border: none">
      <v-toolbar dark color="primary">
        <div style="margin-left: 16px">
          <v-icon :icon="mdiPlayCircleOutline" />
        </div>
        <v-toolbar-title>
          {{ ContextMenuTitle }}
        </v-toolbar-title>

        <v-spacer></v-spacer>
        <v-btn
          style="margin-right: 16px"
          icon
          mdiClose
          @click="api.queueCommandClear(activePlayerQueue?.queue_id)"
        >
          <v-icon :icon="mdiDelete" />
        </v-btn>
        <v-btn
          style="margin-right: 16px"
          icon
          mdiClose
          @click="showQueueDialog = false"
        >
          <v-icon :icon="mdiClose" />
        </v-btn>
      </v-toolbar>
      <PlayerQueue />
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiPlayCircleOutline, mdiClose, mdiDelete } from '@mdi/js';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import api from '../plugins/api';
import { computed, ref, watchEffect } from 'vue';
import { store } from '../plugins/store';
import PlayerQueue, { showQueueDialog } from '@/components/PlayerQueue.vue';
import { useI18n } from 'vue-i18n';

// global refs
const { t } = useI18n();

// local refs
const ContextMenuTitle = ref('');

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_queue];
  }
  return undefined;
});

// watchers
watchEffect(() => {
  if (activePlayerQueue.value) {
    if (activePlayerQueue.value) {
      ContextMenuTitle.value = t('queue') + ': ' + activePlayerQueue.value.name;
    } else {
      ContextMenuTitle.value = t('queue');
    }
  }
});
</script>
