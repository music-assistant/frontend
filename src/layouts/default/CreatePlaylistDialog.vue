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
        {{ $t("playlist_create_media_types", [providerName]) }}
        {{ playlistAllowedMediaTypesTranslated.join(", ") }}
        <div v-if="playlistAllowMixedMediaTypes">
          {{ $t("playlist_mix_allowed") }}
        </div>
        <div v-else-if="playlistAllowedMediaTypes.length > 1">
          {{ $t("playlist_mix_not_allowed") }}
          <v-radio-group v-model="playlistSelectedMediaType" inline>
            <div
              v-for="(item, index) in playlistAllowedMediaTypes"
              :key="index"
            >
              <v-radio
                :label="playlistAllowedMediaTypesTranslated[index]"
                :value="item"
              />
            </div>
          </v-radio-group>
        </div>
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
import { MediaType, ProviderFeature } from "@/plugins/api/interfaces";

const showDialog = ref(false);
const playlistName = ref("");
const playlistAllowedMediaTypes = ref<MediaType[]>([]);
const playlistAllowedMediaTypesTranslated = ref<string[]>([]);
const playlistSelectedMediaType = ref<MediaType>(MediaType.UNKNOWN);
const playlistAllowMixedMediaTypes = ref(false);
const queueId = ref("");
const providerId = ref("");
const providerName = ref("");
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
    playlistAllowedMediaTypes.value = [];
    playlistSelectedMediaType.value = MediaType.UNKNOWN;
    let provider = api.getProvider(providerId.value);
    if (provider != undefined) {
      providerName.value = provider.name;
      if (
        provider.supported_features.includes(ProviderFeature.PLAYLIST_CREATE) ||
        provider.supported_features.includes(
          ProviderFeature.PLAYLIST_CREATE_TRACKS,
        )
      ) {
        playlistAllowedMediaTypes.value.push(MediaType.TRACK);
      }
      if (
        provider.supported_features.includes(
          ProviderFeature.PLAYLIST_CREATE_AUDIOBOOKS,
        )
      ) {
        playlistAllowedMediaTypes.value.push(MediaType.AUDIOBOOK);
      }
      if (
        provider.supported_features.includes(
          ProviderFeature.PLAYLIST_CREATE_PODCAST_EPISODES,
        )
      ) {
        playlistAllowedMediaTypes.value.push(MediaType.PODCAST_EPISODE);
      }
      if (
        provider.supported_features.includes(
          ProviderFeature.PLAYLIST_CREATE_RADIOS,
        )
      ) {
        playlistAllowedMediaTypes.value.push(MediaType.RADIO);
      }
      playlistAllowMixedMediaTypes.value = provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_MIXED,
      );
      if (
        !playlistAllowMixedMediaTypes.value &&
        playlistAllowedMediaTypes.value.length > 1
      ) {
        // set the first to be the default for the radio button
        playlistSelectedMediaType.value = playlistAllowedMediaTypes.value[0];
      }
    } else {
      toast.error("Unable to get provider.");
    }
    playlistAllowedMediaTypesTranslated.value =
      getTranslatedSupportedMediaTypes();
    showDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("createPlaylist");
});

const doSave = async () => {
  if (!playlistName.value) return;
  showDialog.value = false;
  let selectedMediaTypes: MediaType[] = [];
  if (
    playlistAllowMixedMediaTypes.value ||
    playlistAllowedMediaTypes.value.length < 2
  ) {
    // here we didn't show the radio dialog, and just create a playlist
    // with all supported types
    selectedMediaTypes = playlistAllowedMediaTypes.value;
  } else {
    if (playlistSelectedMediaType.value === MediaType.UNKNOWN) {
      toast.error("No media type selected.");
      return;
    }
    selectedMediaTypes = [playlistSelectedMediaType.value];
  }

  try {
    const playlist = queueId.value
      ? await api.queueCommandSaveAsPlaylist(queueId.value, playlistName.value)
      : await api.createPlaylist(
          playlistName.value,
          providerId.value,
          selectedMediaTypes,
        );
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

const getTranslatedSupportedMediaTypes = (): string[] => {
  let translatedItems: string[] = [];
  playlistAllowedMediaTypes.value.forEach((item, _, __) => {
    translatedItems.push($t(item));
  });
  return translatedItems;
};
</script>
