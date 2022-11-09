<!-- eslint-disable vue/no-mutating-props -->
<template>
  <v-dialog
    v-model="showQueueContextMenu"
    fullscreen
    :scrim="false"
    transition="dialog-bottom-transition"
  >
    <v-card>
      <v-toolbar dark color="accent">
        <div style="margin-left: 16px">
          <v-icon :icon="mdiPlayCircleOutline" />
        </div>
        <v-toolbar-title v-if="props.item">
          {{
            truncateString(
              props.item?.name || '',
              $vuetify.display.mobile ? 20 : 150
            )
          }}
        </v-toolbar-title>
        <v-toolbar-title v-else>
          {{ $t('settings') }} |
          {{ activePlayerQueue?.name }}
        </v-toolbar-title>

        <v-spacer></v-spacer>
        <v-btn
          style="margin-right: 16px"
          icon
          mdiClose
          @click="showQueueContextMenu = false"
        >
          <v-icon :icon="mdiClose" />
        </v-btn>
      </v-toolbar>

      <!-- QueueItem related content menu -->
      <v-card-text v-if="props.item">
        <v-list>
          <!-- play now -->
          <v-list-item
            :title="$t('play_now')"
            @click="
              queueCommand(props.item, 'play_now');
              showQueueContextMenu = false;
            "
          >
            <template #prepend>
              <v-avatar style="padding-right: 10px">
                <v-icon :icon="mdiPlayCircleOutline" />
              </v-avatar>
            </template>
          </v-list-item>
          <v-divider />

          <!-- play next (move to next in line) -->
          <v-list-item
            :title="$t('play_next')"
            @click="
              queueCommand(props.item, 'move_next');
              showQueueContextMenu = false;
            "
          >
            <template #prepend>
              <v-avatar style="padding-right: 10px">
                <v-icon :icon="mdiSkipNextCircleOutline" />
              </v-avatar>
            </template>
          </v-list-item>
          <v-divider />

          <!-- move up -->
          <v-list-item
            :title="$t('queue_move_up')"
            @click="
              queueCommand(props.item, 'up');
              showQueueContextMenu = false;
            "
          >
            <template #prepend>
              <v-avatar style="padding-right: 10px">
                <v-icon :icon="mdiArrowUp" />
              </v-avatar>
            </template>
          </v-list-item>
          <v-divider />

          <!-- move down -->
          <v-list-item
            :title="$t('queue_move_down')"
            @click="
              queueCommand(props.item, 'down');
              showQueueContextMenu = false;
            "
          >
            <template #prepend>
              <v-avatar style="padding-right: 10px">
                <v-icon :icon="mdiArrowDown" />
              </v-avatar>
            </template>
          </v-list-item>
          <v-divider />

          <!-- delete -->
          <v-list-item
            :title="$t('queue_delete')"
            @click="
              queueCommand(props.item, 'delete');
              showQueueContextMenu = false;
            "
          >
            <template #prepend>
              <v-avatar style="padding-right: 10px">
                <v-icon :icon="mdiDelete" />
              </v-avatar>
            </template>
          </v-list-item>
          <v-divider />

          <!-- show info (track only) -->
          <v-list-item
            v-if="props.item?.media_item?.media_type == MediaType.TRACK"
            :title="$t('show_info')"
            @click="
              props.item?.media_item ? gotoItem(props.item.media_item) : '';
              showQueueContextMenu = false;
              showQueueDialog = false;
              store.showFullscreenPlayer = false;
            "
          >
            <template #prepend>
              <v-avatar style="padding-right: 10px">
                <v-icon :icon="mdiInformationOutline" />
              </v-avatar>
            </template>
          </v-list-item>
          <v-divider />
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import {
  mdiSkipNextCircleOutline,
  mdiPlayCircleOutline,
  mdiClose,
  mdiArrowUp,
  mdiArrowDown,
  mdiInformationOutline,
  mdiDelete,
} from '@mdi/js';
import { ref } from 'vue';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { QueueItem, MediaItemType } from '../plugins/api';
import { MediaType } from '../plugins/api';
import api from '../plugins/api';
import { computed } from 'vue';
import { store } from '../plugins/store';
import { truncateString } from '../utils';
import { useRouter } from 'vue-router';
import { showQueueContextMenu, showQueueDialog } from './PlayerQueue.vue';

// properties
export interface Props {
  item: any;
}

const props = withDefaults(defineProps<Props>(), {});

// global refs
const router = useRouter();

// local refs
const selectedItem = ref<QueueItem>();
const showContextMenu = ref(false);

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_queue];
  }
  return undefined;
});

const gotoItem = function (item: MediaItemType) {
  closeContextMenu();
  router.push({
    name: item.media_type,
    params: { item_id: item.item_id, provider: item.provider },
  });
};

const queueCommand = function (item: QueueItem | undefined, command: string) {
  closeContextMenu();
  if (!item || !activePlayerQueue.value) return;
  if (command == 'play_now') {
    api.queueCommandPlayIndex(activePlayerQueue?.value.queue_id, item.item_id);
  } else if (command == 'move_next') {
    api.queueCommandMoveNext(activePlayerQueue?.value.queue_id, item.item_id);
  } else if (command == 'up') {
    api.queueCommandMoveUp(activePlayerQueue?.value.queue_id, item.item_id);
  } else if (command == 'down') {
    api.queueCommandMoveDown(activePlayerQueue?.value.queue_id, item.item_id);
  } else if (command == 'delete') {
    api.queueCommandDelete(activePlayerQueue?.value.queue_id, item.item_id);
  }
};

const closeContextMenu = function () {
  selectedItem.value = undefined;
  showContextMenu.value = false;
};
</script>
