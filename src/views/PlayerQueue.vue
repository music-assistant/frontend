<template>
  <section>
    <v-toolbar variant="flat" color="transparent" style="height: 50px">
      <template #title>
        {{ $t('queue') }} | {{ store.selectedPlayer?.display_name }}
        <v-badge
          v-if="!getBreakpointValue('bp6')"
          color="grey"
          :content="nextItems.length"
          inline
        />
      </template>
      <template #append>
        <v-tabs
          v-if="getBreakpointValue('bp6')"
          v-model="activePanel"
          show-arrows
          grow
        >
          <v-tab :value="0">
            {{ $t('queue_next_items') }}
            <v-badge color="grey" :content="nextItems.length" inline />
          </v-tab>
          <v-tab :value="1">
            {{ $t('queue_previous_items') }}
            <v-badge color="grey" :content="previousItems.length" inline />
          </v-tab>
        </v-tabs>
        <!-- contextmenu -->
        <v-menu
          v-if="topBarContextMenuItems && topBarContextMenuItems.length > 0"
          location="bottom end"
        >
          <template #activator="{ props }">
            <Button icon style="right: 3px" v-bind="props">
              <v-icon icon="mdi-dots-vertical" />
            </Button>
          </template>
          <v-list>
            <ListItem
              v-for="(item, index) in topBarContextMenuItems.filter(
                (x) => x.hide != true,
              )"
              :key="index"
              :title="$t(item.label, item.labelArgs || [])"
              :disabled="item.disabled == true"
              @click="item.action ? item.action() : ''"
            >
              <template #prepend>
                <v-avatar :icon="item.icon" />
              </template>
            </ListItem>
          </v-list>
        </v-menu>
      </template>
    </v-toolbar>

    <Container>
      <Alert
        v-if="
          store.activePlayerQueue &&
          store.activePlayerQueue?.radio_source.length > 0
        "
        icon="mdi-radio-tower"
      >
        <b>{{ $t('queue_radio_enabled') }}</b>
        <br />
        {{
          $t('queue_radio_based_on', [
            $t(store.activePlayerQueue?.radio_source[0].media_type),
          ])
        }}
        <b
          ><a
            @click="
              store.activePlayerQueue
                ? gotoItem(store.activePlayerQueue?.radio_source[0])
                : ''
            "
            >{{ store.activePlayerQueue?.radio_source[0].name }}</a
          ></b
        ><span v-if="store.activePlayerQueue?.radio_source.length > 1">
          (+{{ store.activePlayerQueue?.radio_source.length - 1 }})</span
        >
      </Alert>

      <v-virtual-scroll :height="66" :items="tabItems" style="height: 100%">
        <template #default="{ item }">
          <ListviewItem
            v-if="item.media_item"
            :key="item.queue_item_id"
            :item="item.media_item || item"
            :show-disc-number="false"
            :show-track-number="false"
            :show-duration="true"
            :show-library="true"
            :show-menu="true"
            :show-provider="false"
            :show-album="false"
            :show-checkboxes="false"
            :is-selected="false"
            :show-details="false"
            :is-disabled="
              item.queue_item_id == store.curQueueItem?.queue_item_id
            "
            ripple
            @menu="onClick(item)"
            @click="queueCommand(item, 'play_now')"
            @click.right.prevent="onClick(item)"
          >
            <template #append>
              <!-- move up -->
              <v-btn
                v-if="getBreakpointValue('bp1')"
                variant="plain"
                ripple
                icon="mdi-arrow-up"
                :title="$t('queue_move_up')"
                @click="
                  api.queueCommandMoveUp(
                    store.activePlayerQueue!.queue_id,
                    item.queue_item_id,
                  )
                "
                @click.prevent
                @click.stop
              />

              <!-- move down -->
              <v-btn
                icon="mdi-arrow-down"
                :title="$t('queue_move_down')"
                @click.prevent="
                  api.queueCommandMoveDown(
                    store.activePlayerQueue!.queue_id,
                    item.queue_item_id,
                  )
                "
              />
            </template>
          </ListviewItem>
          <ListItem v-else>
            <!-- edge case: QueueItem without MediaItem attached-->
            <template #title>{{ item.name }}</template>
          </ListItem>
        </template>
      </v-virtual-scroll>

      <Alert v-if="items.length == 0" type="info">
        {{ $t('no_content') }}
      </Alert>
    </Container>
    <!-- contextmenu -->
    <v-dialog
      v-model="showContextMenu"
      :fullscreen="$vuetify.display.mobile"
      min-height="80%"
      :scrim="true"
    >
      <v-card>
        <v-toolbar sense dark color="primary">
          <v-btn icon="mdi-play-circle-outline" />
          <v-toolbar-title v-if="selectedItem" style="padding-left: 10px">
            <b>{{
              truncateString(
                selectedItem?.name || '',
                $vuetify.display.mobile ? 20 : 150,
              )
            }}</b>
          </v-toolbar-title>
          <v-toolbar-title v-else style="padding-left: 10px">
            <b>{{ $t('settings') }}</b> |
            {{ store.activePlayerQueue?.display_name }}
          </v-toolbar-title>
          <v-btn icon="mdi-close" dark @click="closeContextMenu()" />
        </v-toolbar>

        <!-- QueueItem related content menu -->
        <v-card-text v-if="selectedItem">
          <v-list>
            <!-- play now -->
            <ListItem
              :title="$t('play_now')"
              @click="queueCommand(selectedItem, 'play_now')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-play-circle-outline" />
                </v-avatar>
              </template>
            </ListItem>
            <v-divider />

            <!-- play next (move to next in line) -->
            <ListItem
              :title="$t('play_next')"
              @click="queueCommand(selectedItem, 'move_next')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-skip-next-circle-outline" />
                </v-avatar>
              </template>
            </ListItem>
            <v-divider />

            <!-- move up -->
            <ListItem
              :title="$t('queue_move_up')"
              @click="queueCommand(selectedItem, 'up')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-arrow-up" />
                </v-avatar>
              </template>
            </ListItem>
            <v-divider />

            <!-- move down -->
            <ListItem
              :title="$t('queue_move_down')"
              @click="queueCommand(selectedItem, 'down')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-arrow-down" />
                </v-avatar>
              </template>
            </ListItem>
            <v-divider />

            <!-- delete -->
            <ListItem
              :title="$t('queue_delete')"
              @click="queueCommand(selectedItem, 'delete')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-delete" />
                </v-avatar>
              </template>
            </ListItem>
            <v-divider />

            <!-- show info (track only) -->
            <ListItem
              v-if="selectedItem?.media_item?.media_type == MediaType.TRACK"
              :title="$t('show_info')"
              @click="
                selectedItem?.media_item
                  ? gotoItem(selectedItem.media_item)
                  : ''
              "
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-information-outline" />
                </v-avatar>
              </template>
            </ListItem>
            <v-divider />
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onBeforeUnmount, watch } from 'vue';
import type {
  QueueItem,
  EventMessage,
  MediaItemType,
} from '@/plugins/api/interfaces';
import { EventType, MediaType } from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import { store } from '@/plugins/store';
import { truncateString } from '@/helpers/utils';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import ListviewItem from '@/components/ListviewItem.vue';
import Button from '@/components/mods/Button.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';
import Container from '@/components/mods/Container.vue';
import Alert from '@/components/mods/Alert.vue';
import { ContextMenuItem } from '@/layouts/default/ItemContextMenu.vue';

// global refs
const { t } = useI18n();
const router = useRouter();

// local refs
const activePanel = ref(0);
const selectedItem = ref<QueueItem>();
const showContextMenu = ref(false);
const topBarContextMenuItems = ref<ContextMenuItem[]>([]);

const items = ref<QueueItem[]>([]);

// computed properties
const nextItems = computed(() => {
  if (store.activePlayerQueue) {
    return items.value.slice(store.activePlayerQueue.current_index);
  } else return [];
});
const previousItems = computed(() => {
  if (store.activePlayerQueue) {
    return items.value.slice(0, store.activePlayerQueue.current_index);
  } else return [];
});
const tabItems = computed(() => {
  if (activePanel.value == 1) return previousItems.value;
  else return nextItems.value;
});

// listen for item updates to refresh items when that happens

onMounted(() => {
  const unsub = api.subscribe_multi(
    [EventType.QUEUE_UPDATED, EventType.QUEUE_ITEMS_UPDATED],
    (evt: EventMessage) => {
      if (evt.object_id != store.activePlayerQueue?.queue_id) return;

      if (evt.event == EventType.QUEUE_ITEMS_UPDATED) {
        loadItems();
      } else {
        setMenuItems();
      }
    },
  );
  onBeforeUnmount(unsub);
});

// methods
const loadItems = async function () {
  if (store.activePlayerQueue) {
    items.value = [];
    await api.getPlayerQueueItems(store.activePlayerQueue.queue_id);
  } else {
    items.value = [];
  }
};

const onClick = function (item: QueueItem) {
  // mediaItem in the list is clicked
  selectedItem.value = item;
  showContextMenu.value = true;
};

const gotoItem = function (item: MediaItemType) {
  closeContextMenu();
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
  });
};

const queueCommand = function (item: QueueItem | undefined, command: string) {
  closeContextMenu();
  if (!item || !store.activePlayerQueue) return;
  if (command == 'play_now') {
    api.queueCommandPlayIndex(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'move_next') {
    api.queueCommandMoveNext(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'up') {
    api.queueCommandMoveUp(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'down') {
    api.queueCommandMoveDown(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'delete') {
    api.queueCommandDelete(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  }
};

const setMenuItems = function () {
  // set items in topbar contextmenu
  topBarContextMenuItems.value = [
    {
      label: 'settings.player_settings',
      labelArgs: [],
      action: () => {
        router.push(
          `/settings/editplayer/${store.activePlayerQueue!.queue_id}`,
        );
      },
      icon: 'mdi-cog-outline',
    },
    {
      label: 'queue_clear',
      labelArgs: [],
      action: () => {
        api.queueCommandClear(store.activePlayerQueue!.queue_id);
      },
      icon: 'mdi-cancel',
    },
    {
      label: store.activePlayerQueue!.shuffle_enabled
        ? 'shuffle_enabled'
        : 'shuffle_disabled',
      labelArgs: [],
      action: () => {
        api.queueCommandShuffleToggle(store.activePlayerQueue!.queue_id);
      },
      icon: store.activePlayerQueue!.shuffle_enabled
        ? 'mdi-shuffle'
        : 'mdi-shuffle-disabled',
    },
    {
      label: 'repeat_mode',
      labelArgs: [t(`repeatmode.${store.activePlayerQueue!.repeat_mode}`)],
      action: () => {
        api.queueCommandRepeatToggle(store.activePlayerQueue!.queue_id);
      },
      icon: store.activePlayerQueue!.shuffle_enabled
        ? 'mdi-repeat'
        : 'mdi-repeat-off',
    },
  ];
};

const closeContextMenu = function () {
  selectedItem.value = undefined;
  showContextMenu.value = false;
};

// watchers
watch(
  () => store.activePlayerQueue,
  (val) => {
    if (val) {
      loadItems();
      setMenuItems();
    }
  },
  { immediate: true },
);
</script>
