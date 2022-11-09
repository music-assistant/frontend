<template>
  <section>
    <PlayerQueue />
  </section>
</template>

<script setup lang="ts">
import { mdiCancel } from '@mdi/js';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { QueueItem, MassEvent } from '../plugins/api';
import { MassEventType } from '../plugins/api';
import api from '../plugins/api';
import { computed, onBeforeUnmount, watchEffect, ref } from 'vue';
import { store } from '../plugins/store';
import { useI18n } from 'vue-i18n';
import PlayerQueue from '../components/PlayerQueue.vue';

// global refs
const { t } = useI18n();

// local refs

const items = ref<QueueItem[]>([]);
const loading = ref(true);

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_queue];
  }
  return undefined;
});

// listen for item updates to refresh items when that happens
const unsub = api.subscribe(
  MassEventType.QUEUE_ITEMS_UPDATED,
  (evt: MassEvent) => {
    if (evt.object_id == activePlayerQueue.value?.queue_id) {
      loadItems();
    }
  }
);
onBeforeUnmount(unsub);

store.topBarContextMenuItems = [
  {
    label: 'queue_clear',
    labelArgs: [],
    action: () => {
      api.queueCommandClear(activePlayerQueue.value?.queue_id);
    },
    icon: mdiCancel,
  },
];
onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});

// methods
const loadItems = async function () {
  loading.value = true;
  if (activePlayerQueue.value) {
    store.topBarTitle = t('queue') + ': ' + activePlayerQueue.value.name;
    items.value = await api.getPlayerQueueItems(
      activePlayerQueue.value.queue_id
    );
  } else {
    store.topBarTitle = t('queue');
    items.value = [];
  }
  loading.value = false;
};

// watchers
watchEffect(() => {
  if (activePlayerQueue.value) {
    loadItems();
  }
});
</script>
