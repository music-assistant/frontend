<template>
  <section>
    <v-tabs v-model="activePanel" show-arrows grow>
      <v-tab :value="0">
        {{ $t("queue_next_items") + " (" + nextItems.length + ")" }}
      </v-tab>
      <v-tab :value="1">
        {{ $t("queue_previous_items") + " (" + previousItems.length + ")" }}
      </v-tab>
    </v-tabs>

    <div
      style="
        padding-left: 15px;
        padding-right: -15px;
        padding-top: 10px;
        padding-bottom: 20px;
      "
    >
      <v-alert
        v-if="activePlayerQueue && activePlayerQueue?.radio_source.length > 0"
        color="primary"
        theme="dark"
        icon="mdi-radio-tower"
        prominent
        style="margin-right: 10px"
      >
        <b>{{ $t("queue_radio_enabled") }}</b>
        <br />
        {{
          $t("queue_radio_based_on", [
            $t(activePlayerQueue?.radio_source[0].media_type),
          ])
        }}
        <b
          ><a
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
        key-field="queue_item_id"
        page-mode
      >
        <div>
          <v-list-item
            ripple
            :disabled="item.queue_item_id == curQueueItem?.queue_item_id"
            @click.stop="onClick(item)"
            @click.right.prevent="onClick(item)"
          >
            <template #prepend>
              <div class="listitem-thumb">
                <MediaItemThumb :item="item" width="50px" height="50px" />
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
                  class="listitem-action"
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
                        icon="mdi-arrow-up"
                        @click="
                          api.queueCommandMoveUp(
                            activePlayerQueue!.queue_id,
                            item.queue_item_id
                          )
                        "
                        @click.prevent
                        @click.stop
                      />
                    </template>
                    <span>{{ $t("queue_move_up") }}</span>
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
                        icon="mdi-arrow-down"
                        @click="
                          api.queueCommandMoveDown(
                            activePlayerQueue!.queue_id,
                            item.queue_item_id
                          )
                        "
                        @click.prevent
                        @click.stop
                      />
                    </template>
                    <span>{{ $t("queue_move_down") }}</span>
                  </v-tooltip>
                </div>
              </div>
            </template>
          </v-list-item>
          <v-divider />
        </div>
      </RecycleScroller>
      <v-alert v-if="items.length == 0" type="info" style="margin: 20px">
        {{ $t("no_content") }}
      </v-alert>
    </div>

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
                selectedItem?.name || "",
                $vuetify.display.mobile ? 20 : 150
              )
            }}</b>
          </v-toolbar-title>
          <v-toolbar-title v-else style="padding-left: 10px">
            <b>{{ $t("settings") }}</b> |
            {{ activePlayerQueue?.display_name }}
          </v-toolbar-title>
          <v-btn icon="mdi-close" dark text @click="closeContextMenu()" />
        </v-toolbar>

        <!-- QueueItem related content menu -->
        <v-card-text v-if="selectedItem">
          <v-list>
            <!-- play now -->
            <v-list-item
              :title="$t('play_now')"
              @click="queueCommand(selectedItem, 'play_now')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-play-circle-outline" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-divider />

            <!-- play next (move to next in line) -->
            <v-list-item
              :title="$t('play_next')"
              @click="queueCommand(selectedItem, 'move_next')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-skip-next-circle-outline" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-divider />

            <!-- move up -->
            <v-list-item
              :title="$t('queue_move_up')"
              @click="queueCommand(selectedItem, 'up')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-arrow-up" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-divider />

            <!-- move down -->
            <v-list-item
              :title="$t('queue_move_down')"
              @click="queueCommand(selectedItem, 'down')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-arrow-down" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-divider />

            <!-- delete -->
            <v-list-item
              :title="$t('queue_delete')"
              @click="queueCommand(selectedItem, 'delete')"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon icon="mdi-delete" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-divider />

            <!-- show info (track only) -->
            <v-list-item
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
            </v-list-item>
            <v-divider />
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RecycleScroller } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import type {
  QueueItem,
  EventMessage,
  MediaItemType,
} from "../plugins/api/interfaces";
import { EventType, MediaType } from "../plugins/api/interfaces";
import { api } from "../plugins/api";
import { computed, onBeforeUnmount, watch } from "vue";
import { store } from "../plugins/store";
import { formatDuration, truncateString } from "../utils";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import MediaItemThumb from "../components/MediaItemThumb.vue";

// global refs
const { t } = useI18n();
const router = useRouter();

// local refs
const activePanel = ref(0);
const selectedItem = ref<QueueItem>();
const showContextMenu = ref(false);

const items = ref<QueueItem[]>([]);

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
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

onMounted(() => {
  const unsub = api.subscribe_multi(
    [EventType.QUEUE_UPDATED, EventType.QUEUE_ITEMS_UPDATED],
    (evt: EventMessage) => {
      if (evt.object_id != activePlayerQueue.value?.queue_id) return;

      if (evt.event == EventType.QUEUE_ITEMS_UPDATED) {
        loadItems();
      } else {
        setMenuItems();
      }
    }
  );
  onBeforeUnmount(unsub);
});

// methods
const loadItems = async function () {
  if (activePlayerQueue.value) {
    store.topBarTitle = activePlayerQueue.value.display_name;
    items.value = [];
    await api.getPlayerQueueItems(
      activePlayerQueue.value.queue_id,
      (data: QueueItem[]) => {
        console.log("chunk", data.length);
        items.value.push(...data);
      }
    );
  } else {
    store.topBarTitle = undefined;
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
  if (!item || !activePlayerQueue.value) return;
  if (command == "play_now") {
    api.queueCommandPlayIndex(
      activePlayerQueue?.value.queue_id,
      item.queue_item_id
    );
  } else if (command == "move_next") {
    api.queueCommandMoveNext(
      activePlayerQueue?.value.queue_id,
      item.queue_item_id
    );
  } else if (command == "up") {
    api.queueCommandMoveUp(
      activePlayerQueue?.value.queue_id,
      item.queue_item_id
    );
  } else if (command == "down") {
    api.queueCommandMoveDown(
      activePlayerQueue?.value.queue_id,
      item.queue_item_id
    );
  } else if (command == "delete") {
    api.queueCommandDelete(
      activePlayerQueue?.value.queue_id,
      item.queue_item_id
    );
  }
};

const setMenuItems = function () {
  // set items in topbar contextmenu
  store.topBarContextMenuItems = [
    {
      label: "settings.player_settings",
      labelArgs: [],
      action: () => {
        router.push(
          `/settings/editplayer/${activePlayerQueue.value!.queue_id}`
        );
      },
      icon: "mdi-cog-outline",
    },
    {
      label: "queue_clear",
      labelArgs: [],
      action: () => {
        api.queueCommandClear(activePlayerQueue.value!.queue_id);
      },
      icon: "mdi-cancel",
    },
    {
      label: activePlayerQueue.value!.shuffle_enabled
        ? "shuffle_enabled"
        : "shuffle_disabled",
      labelArgs: [],
      action: () => {
        api.queueCommandShuffleToggle(activePlayerQueue.value!.queue_id);
      },
      icon: activePlayerQueue.value!.shuffle_enabled
        ? "mdi-shuffle"
        : "mdi-shuffle-disabled",
    },
    {
      label: "repeat_mode",
      labelArgs: [t(`repeatmode.${activePlayerQueue.value!.repeat_mode}`)],
      action: () => {
        api.queueCommandRepeatToggle(activePlayerQueue.value!.queue_id);
      },
      icon: activePlayerQueue.value!.shuffle_enabled
        ? "mdi-repeat"
        : "mdi-repeat-off",
    },
    {
      label: activePlayerQueue.value!.crossfade_enabled
        ? "crossfade_enabled"
        : "crossfade_disabled",
      labelArgs: [],
      action: () => {
        api.queueCommandCrossfadeToggle(activePlayerQueue.value!.queue_id);
      },
      icon: activePlayerQueue.value!.crossfade_enabled
        ? "mdi-swap-horizontal-bold"
        : "mdi-swap-horizontal",
    },
  ];
};

const closeContextMenu = function () {
  selectedItem.value = undefined;
  showContextMenu.value = false;
};

// watchers
watch(
  () => activePlayerQueue.value,
  (val) => {
    if (val) {
      loadItems();
      setMenuItems();
    }
  },
  { immediate: true }
);
</script>

<style scoped></style>
