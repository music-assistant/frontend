<!--
  Global dialog to play item(s) to a player.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <v-dialog
    v-model="show"
    :fullscreen="$vuetify.display.mobile"
    transition="dialog-bottom-transition"
    scrim
    @update:model-value="
      (v) => {
        store.dialogActive = v;
      }
    "
  >
    <v-card>
      <v-toolbar color="transparent" density="compact" class="titlebar">
        <template #prepend>
          <v-icon
            size="large"
            class="ml-4 d-none d-sm-block"
            style="vertical-align: initial"
            icon="mdi-play-circle-outline"
            aria-hidden="true"
          />
        </template>
        <v-toolbar-title>
          <h2 class="font-weight-bold">{{ header }}</h2>
        </v-toolbar-title>
        <v-btn icon="mdi-close" dark @click="close()" />
      </v-toolbar>
      <v-divider />

      <!-- play contextmenu items -->
      <v-card-text v-if="playMenuItems.length > 0">
        <v-select
          :label="$t('play_on')"
          :model-value="store.selectedPlayerId"
          :items="availablePlayers"
          hide-details
          @update:model-value="
            (newVal) => {
              store.selectedPlayerId = newVal;
            }
          "
        />

        <v-list>
          <div v-for="item of playMenuItems" :key="item.label">
            <ListItem
              :title="$t(item.label, item.labelArgs || [])"
              density="default"
              @click="itemClicked(item)"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon :icon="item.icon" />
                </v-avatar>
              </template>
            </ListItem>
          </div>
        </v-list>
      </v-card-text>
      <!-- action contextmenu items -->
      <v-card-text
        v-if="showContextMenuItems && contextMenuItems.length > 0"
        style="padding-top: 0; margin-top: -10px; padding-bottom: 0"
      >
        <v-list-item-subtitle style="margin-left: 10px">
          {{ $t('actions') }}
        </v-list-item-subtitle>
        <v-list>
          <div v-for="item of contextMenuItems" :key="item.label">
            <ListItem
              :title="$t(item.label, item.labelArgs || [])"
              density="default"
              @click="itemClicked(item)"
            >
              <template #prepend>
                <v-avatar style="padding-right: 10px">
                  <v-icon :icon="item.icon" />
                </v-avatar>
              </template>
            </ListItem>
          </div>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { MediaItemType } from '@/plugins/api/interfaces';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import api from '@/plugins/api';
import { useI18n } from 'vue-i18n';
import { store } from '@/plugins/store';
import ListItem from '@/components/mods/ListItem.vue';
import {
  getContextMenuItems,
  ContextMenuItem,
  getPlayMenuItems,
} from '@/helpers/contextmenu';
import { PlayItemDialogEvent, eventbus } from '@/plugins/eventbus';

const { t } = useI18n();

const show = ref<boolean>(false);
const parentItem = ref<MediaItemType>();
const selectedItems = ref<MediaItemType[]>([]);
const showContextMenuItems = ref<boolean>(false);

const contextMenuItems = ref<ContextMenuItem[]>([]);
const playMenuItems = ref<ContextMenuItem[]>([]);
const header = ref('');

onMounted(() => {
  eventbus.on('playdialog', async (evt: PlayItemDialogEvent) => {
    selectedItems.value = evt.items;
    parentItem.value = evt.parentItem;
    showContextMenuItems.value = evt.showContextMenuItems || false;
    showDialog();
  });
  onBeforeUnmount(() => {
    eventbus.off('playdialog');
  });
});

const showDialog = async function () {
  show.value = true;
  // show contextmenu items for the selected mediaItem(s)
  if (!selectedItems.value) return;

  if (selectedItems.value.length === 1)
    header.value = selectedItems.value[0].name;
  else
    header.value = t('items_selected', [selectedItems.value.length]).toString();

  if (store.selectedPlayer && store.selectedPlayer.available) {
    playMenuItems.value = getPlayMenuItems(
      selectedItems.value,
      parentItem.value,
    );
  } else {
    playMenuItems.value = [];
  }

  // grab the full (lazy) fullItem so we have details about in-library etc.
  let firstItem: MediaItemType = selectedItems.value[0];
  let orgPosition: number | undefined = 0;

  if ('position' in firstItem) {
    orgPosition = firstItem.position;
  }
  if (firstItem.provider !== 'library') {
    try {
      firstItem = await api.getItemByUri(selectedItems.value[0].uri);
    } catch (error) {
      firstItem = selectedItems.value[0];
    }
  }
  // fetch contextmenu items too (if enabled)
  if (showContextMenuItems.value) {
    contextMenuItems.value = getContextMenuItems(
      selectedItems.value,
      parentItem.value,
    );
  } else {
    contextMenuItems.value = [];
  }
};
const itemClicked = async function (item: ContextMenuItem) {
  close();
  if (item.action) item.action();
};

const close = function () {
  show.value = false;
};

const availablePlayers = computed(() => {
  const res: { title: string; value: string }[] = [];
  for (const player_id in api?.players) {
    const player = api?.players[player_id];
    if (player.synced_to) continue;
    res.push({ title: player.display_name, value: player.player_id });
  }
  return res
    .slice()
    .sort((a, b) => (a.title.toUpperCase() > b.title.toUpperCase() ? 1 : -1));
});
</script>
