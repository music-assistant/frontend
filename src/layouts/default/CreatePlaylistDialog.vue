<!--
  Global dialog to create a new playlist or save a queue as a playlist.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <v-dialog
    v-model="showDialog"
    max-width="500"
    @update:model-value="
      (v) => {
        store.dialogActive = v;
      }
    "
  >
    <v-card>
      <v-card-title>
        {{ $t(queueId ? "save_queue_as_playlist" : "new_playlist") }}
      </v-card-title>
      <v-card-text>
        <v-text-field
          ref="nameInput"
          v-model="playlistName"
          :label="$t('new_playlist_name')"
          @keyup.enter="doSave"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showDialog = false">
          {{ $t("close") }}
        </v-btn>
        <v-btn
          variant="text"
          color="primary"
          :disabled="!playlistName"
          @click="doSave"
        >
          {{ $t("settings.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

import api from "@/plugins/api";
import { type CreatePlaylistEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
const playlistName = ref("");
const queueId = ref("");
const providerId = ref("");
const nameInput = ref();

watch(showDialog, (open) => {
  store.dialogActive = open;
  if (open) {
    nextTick(() => {
      nameInput.value?.focus();
    });
  }
});

onMounted(() => {
  eventbus.on("createPlaylist", (evt: CreatePlaylistEvent) => {
    queueId.value = evt.queueId || "";
    providerId.value = evt.providerId || "";
    playlistName.value = "";
    showDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("createPlaylist");
});

const doSave = async () => {
  if (!playlistName.value) return;
  showDialog.value = false;
  try {
    const playlist = queueId.value
      ? await api.queueCommandSaveAsPlaylist(queueId.value, playlistName.value)
      : await api.createPlaylist(playlistName.value, providerId.value);
    toast.success($t("playlist_created"), {
      action: {
        label: $t("open_playlist"),
        onClick: () => {
          store.showFullscreenPlayer = false;
          router.push({
            name: "playlist",
            params: {
              itemId: playlist.item_id,
              provider: playlist.provider,
            },
          });
        },
      },
    });
  } catch (e) {
    toast.error(e as string);
  }
};
</script>
