<!--
  Global dialog to create a new playlist or save a queue as a playlist.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t(queueId ? "save_queue_as_playlist" : "new_playlist") }}
        </DialogTitle>
        <DialogDescription v-if="queueId" class="sr-only">
          {{ $t("save_queue_as_playlist") }}
        </DialogDescription>
        <DialogDescription v-else>
          {{ $t("playlist_create_media_types", [providerName]) }}
          {{ playlistAllowedMediaTypesTranslated.join(", ") }}
        </DialogDescription>

        <div v-if="!queueId" class="flex flex-col gap-4 mb-3">
          <DialogDescription v-if="playlistAllowMixedMediaTypes">
            {{ $t("playlist_mix_allowed") }}
          </DialogDescription>
          <div
            v-else-if="!queueId && playlistAllowedMediaTypes.length > 1"
            class="flex flex-col gap-3"
          >
            <DialogDescription>{{
              $t("playlist_mix_not_allowed")
            }}</DialogDescription>

            <RadioGroup
              v-model="playlistSelectedMediaType"
              class="flex flex-row flex-wrap gap-4 justify-center mt-2"
            >
              <div
                v-for="(item, index) in playlistAllowedMediaTypes"
                :key="index"
                class="flex items-center gap-2"
              >
                <RadioGroupItem :id="`media-type-${index}`" :value="item" />
                <Label :for="`media-type-${index}`">
                  {{ playlistAllowedMediaTypesTranslated[index] }}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div class="flex flex-col gap-4 mb-3">
          <div class="flex flex-col gap-2 mt-3">
            <Label for="playlist-name">{{ $t("new_playlist_name") }}</Label>
            <Input
              id="playlist-name"
              ref="nameInput"
              v-model="playlistName"
              @keyup.enter="doSave"
            />
          </div>
        </div>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button :disabled="!playlistName" @click="doSave">
          {{ $t("settings.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import api from "@/plugins/api";
import { MediaType, ProviderFeature } from "@/plugins/api/interfaces";
import { type CreatePlaylistEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
// force Dialog remount via dynamic key to prevent the enter animation from
// stalling at opacity:0 when opened from a context menu
const dialogKey = ref(0);
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
      nameInput.value?.focus?.();
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

    if (!queueId.value) {
      // Provider feature detection is only needed for the "new playlist" flow.
      // The queue-to-playlist flow uses a different backend endpoint that
      // handles provider selection internally.
      const provider = api.getProvider(providerId.value);

      if (provider != undefined) {
        providerName.value = provider.name;
        if (
          provider.supported_features.includes(
            ProviderFeature.PLAYLIST_CREATE,
          ) ||
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
        playlistAllowMixedMediaTypes.value =
          provider.supported_features.includes(
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
        toast.error($t("playlist_create_provider_error"));
        return;
      }
      playlistAllowedMediaTypesTranslated.value =
        getTranslatedSupportedMediaTypes();
    }
    dialogKey.value++;
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
      toast.error($t("playlist_create_no_type_selected"));
      return;
    }
    selectedMediaTypes = [playlistSelectedMediaType.value];
  }

  try {
    if (queueId.value) {
      await api.queueCommandSaveAsPlaylist(queueId.value, playlistName.value, {
        showBackgroundTaskToast: false,
      });
      toast.info($t("background_tasks.toast.added"), {
        action: {
          label: $t("background_tasks.open"),
          onClick: () => {
            store.showFullscreenPlayer = false;
            router.push({ name: "backgroundtasks" });
          },
        },
      });
      return;
    }

    const playlist = await api.createPlaylist(
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
    toast.error(getErrorMessage(e, $t("background_tasks.status.failed")));
  }
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const getTranslatedSupportedMediaTypes = (): string[] => {
  let translatedItems: string[] = [];
  playlistAllowedMediaTypes.value.forEach((item, _, __) => {
    translatedItems.push($t(item));
  });
  return translatedItems;
};
</script>
