<!-- eslint-disable vue/no-mutating-props -->
<template>
  <PlayerQueueContextMenu :item="selectedItem" />
  <v-tabs
    v-model="activePanel"
    show-arrows
    align-tabs="center"
    style="width: 100%"
  >
    <v-tab :value="0">
      {{ $t('queue_next_items') + ' (' + nextItems.length + ')' }}
    </v-tab>
    <v-tab :value="1">
      {{ $t('queue_previous_items') + ' (' + previousItems.length + ')' }}
    </v-tab>
  </v-tabs>
  <div
    style="
      margin: 20px 15px;
      padding: 0px;
      transition: transform 1s cubic-bezier(0.18, 0, 0, 1), opacity 1s ease,
        filter 0.5s ease;
    "
  >
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert
      v-if="activePlayerQueue && activePlayerQueue?.radio_source.length > 0"
      color="primary"
      theme="dark"
      :icon="mdiRadioTower"
      prominent
      style="margin-right: 10px"
    >
      <b>{{ $t('queue_radio_enabled') }}</b>
      <br />
      {{
        $t('queue_radio_based_on', [
          $t(activePlayerQueue?.radio_source[0].media_type),
        ])
      }}
      <b>
        <a
          @click="
            activePlayerQueue
              ? gotoItem(activePlayerQueue?.radio_source[0])
              : ''
          "
          >{{ activePlayerQueue?.radio_source[0].name }}</a
        ></b
      ><span v-if="activePlayerQueue?.radio_source.length > 1">
        (+{{ activePlayerQueue?.radio_source.length - 1 }})</span
      >
    </v-alert>
    <RecycleScroller
      v-slot="{ item }"
      :items="tabItems"
      :item-size="66"
      key-field="item_id"
      page-mode
    >
      <div>
        <v-list-item
          ripple
          :disabled="item.item_id == curQueueItem?.item_id"
          @click.stop="onClick(item)"
          @click.right.prevent="onClick(item)"
        >
          <template #prepend>
            <div class="listitem-thumb">
              <MediaItemThumb
                :item="item"
                :size="50"
                width="50px"
                height="50px"
              />
            </div>
          </template>

          <!-- title -->
          <template #title>
            {{ item.media_item ? item.media_item.name : item.name }}
          </template>

          <!-- subtitle -->
          <template #subtitle>
            <div
              v-if="
                item.media_item &&
                'artists' in item.media_item &&
                item.media_item.artists.length > 0
              "
            >
              {{ item.media_item.artists[0].name }}
            </div>
            <div v-else-if="item.media_item">
              {{ item.media_item.metadata.description }}
            </div>
            <div v-else>
              {{ item.uri }}
            </div>
          </template>

          <!-- actions -->
          <template #append>
            <div class="listitem-actions">
              <!-- item duration -->
              <div
                v-if="
                  item.duration &&
                  item.media_item?.media_type != MediaType.RADIO
                "
                class="listitem-action text-caption"
              >
                <span>{{ formatDuration(item.duration) }}</span>
              </div>

              <!-- move up -->
              <div v-if="!$vuetify.display.mobile" class="listitem-action">
                <v-tooltip location="bottom">
                  <template #activator="{ props }">
                    <v-btn
                      variant="plain"
                      ripple
                      v-bind="props"
                      :icon="mdiArrowUp"
                      @click="
                        api.queueCommandMoveUp(
                          activePlayerQueue?.queue_id,
                          item.item_id
                        )
                      "
                      @click.prevent
                      @click.stop
                    />
                  </template>
                  <span>{{ $t('queue_move_up') }}</span>
                </v-tooltip>
              </div>

              <!-- move down -->
              <div v-if="!$vuetify.display.mobile" class="listitem-action">
                <v-tooltip location="bottom">
                  <template #activator="{ props }">
                    <v-btn
                      variant="plain"
                      ripple
                      v-bind="props"
                      :icon="mdiArrowDown"
                      @click="
                        api.queueCommandMoveDown(
                          activePlayerQueue?.queue_id,
                          item.item_id
                        )
                      "
                      @click.prevent
                      @click.stop
                    />
                  </template>
                  <span>{{ $t('queue_move_down') }}</span>
                </v-tooltip>
              </div>
            </div>
          </template>
        </v-list-item>
        <v-divider />
      </div>
    </RecycleScroller>
    <v-alert
      v-if="!loading && items.length == 0"
      type="info"
      style="margin: 20px"
    >
      {{ $t('no_content') }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { mdiArrowUp, mdiArrowDown, mdiRadioTower } from '@mdi/js';
import { ref } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { QueueItem, MassEvent, MediaItemType } from '../plugins/api';
import { MassEventType, MediaType } from '../plugins/api';
import api from '../plugins/api';
import { computed, onBeforeUnmount, watchEffect } from 'vue';
import { store } from '../plugins/store';
import { formatDuration } from '../utils';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import MediaItemThumb from '../components/MediaItemThumb.vue';
import PlayerQueueContextMenu from './PlayerQueueContextMenu.vue';

// global refs
const { t } = useI18n();
const router = useRouter();

// local refs
const activePanel = ref(0);
const selectedItem = ref<QueueItem>();
const showContextMenu = ref(false);

const items = ref<QueueItem[]>([]);
const loading = ref(true);

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_queue];
  }
  return undefined;
});

const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});
const nextItems = computed(() => {
  if (activePlayerQueue.value) {
    return items.value.slice(activePlayerQueue.value.current_index);
  } else return [];
});
const previousItems = computed(() => {
  if (activePlayerQueue.value) {
    return items.value.slice(0, activePlayerQueue.value.current_index);
  } else return [];
});
const tabItems = computed(() => {
  if (activePanel.value == 1) return previousItems.value;
  else return nextItems.value;
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

// methods
const loadItems = async function () {
  loading.value = true;
  if (activePlayerQueue.value) {
    items.value = await api.getPlayerQueueItems(
      activePlayerQueue.value.queue_id
    );
  } else {
    items.value = [];
  }
  loading.value = false;
};

const onClick = function (item: QueueItem) {
  // mediaItem in the list is clicked
  selectedItem.value = item;
  showQueueContextMenu.value = true;
  showContextMenu.value = true;
};

const gotoItem = function (item: MediaItemType) {
  closeContextMenu();
  router.push({
    name: item.media_type,
    params: { item_id: item.item_id, provider: item.provider },
  });
};

const closeContextMenu = function () {
  selectedItem.value = undefined;
  showContextMenu.value = false;
};

// watchers
watchEffect(() => {
  if (activePlayerQueue.value) {
    loadItems();
  }
});
</script>

<script lang="ts">
export const showQueueContextMenu = ref(false);
export const showQueueDialog = ref(false);
</script>
