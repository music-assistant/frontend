<!--
  Dialog to Add (or edit) a custom Radio, Track or Playlist
-->
<template>
  <v-dialog v-model="model" transition="dialog-bottom-transition">
    <v-card>
      <Toolbar
        icon="mdi-playlist-plus"
        :title="isEditMode ? $t(editTitleKey) : $t('add_url_item')"
      />
      <v-divider />
      <br />
      <div style="padding: 15px">
        <v-text-field
          v-model="url"
          variant="outlined"
          :label="isEditMode ? $t('uri_read_only') : $t('enter_url')"
          :disabled="loading"
          :readonly="isEditMode"
          @blur="fetchItemDetails"
        />
        <v-text-field
          v-model="name"
          variant="outlined"
          :label="$t('enter_name')"
          :disabled="loading"
        />
        <v-text-field
          v-model="image"
          variant="outlined"
          :label="$t('image_url')"
          :disabled="loading"
        />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="model = false">{{
            $t("cancel")
          }}</v-btn>
          <v-btn
            variant="flat"
            color="primary"
            :disabled="loading"
            @click="save"
            >{{ $t("save") }}</v-btn
          >
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ImageType, MediaType } from "@/plugins/api/interfaces";
import type { Radio, Track, Playlist } from "@/plugins/api/interfaces";
import { ref, watch, computed } from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import Toolbar from "@/components/Toolbar.vue";

export interface Props {
  type: MediaType;
  editItem?: Radio | Track | Playlist;
}

const model = defineModel<boolean>();
const compProps = defineProps<Props>();
const url = ref<string>("");
const name = ref<string>("");
const image = ref<string>("");
const loading = ref<boolean>(false);
const itemDetails = ref<Radio | Track>();

const isEditMode = computed(() => !!compProps.editItem);

const editTitleKey = computed(() => {
  if (!compProps.editItem) return "add_url_item";
  const titleMap: Record<string, string> = {
    [MediaType.RADIO]: "edit_radio",
    [MediaType.TRACK]: "edit_track",
    [MediaType.PLAYLIST]: "edit_playlist",
  };
  return titleMap[compProps.editItem.media_type] || "add_url_item";
});

const updateEndpoint = computed(() => {
  if (!compProps.editItem) return "";
  const endpointMap: Record<string, string> = {
    [MediaType.RADIO]: "music/radios/update",
    [MediaType.TRACK]: "music/tracks/update",
    [MediaType.PLAYLIST]: "music/playlists/update",
  };
  return endpointMap[compProps.editItem.media_type] || "";
});

watch(
  () => model.value,
  (active) => {
    if (active != null) store.dialogActive = active;
    if (active && compProps.editItem) {
      // Pre-populate fields with current values
      name.value = compProps.editItem.name || "";
      // Show provider URI in edit mode
      url.value = compProps.editItem.uri || "";
      const thumbImage = compProps.editItem.metadata?.images?.find(
        (img) => img.type === ImageType.THUMB,
      );
      image.value = thumbImage?.path || "";
    } else if (active == false) {
      url.value = "";
      name.value = "";
      image.value = "";
      itemDetails.value = undefined;
    }
  },
  { immediate: true },
);

watch(
  () => itemDetails.value,
  (details) => {
    if (details && !isEditMode.value) {
      if (!name.value) name.value = details.name;
      for (const img of details.metadata.images || []) {
        if (img.type == "thumb") {
          image.value = img.path;
          break;
        }
      }
    }
  },
);

const fetchItemDetails = () => {
  if (isEditMode.value) return;
  if (
    !url.value ||
    !["http", "rtsp"].some((prefix) => url.value.startsWith(prefix))
  ) {
    return;
  }
  loading.value = true;
  if (compProps.type == MediaType.RADIO) {
    api
      .getRadio(url.value, "builtin")
      .then((x) => {
        itemDetails.value = x;
      })
      .catch((e) => {
        console.error(e);
        itemDetails.value = undefined;
      })
      .finally(() => {
        loading.value = false;
      });
  } else {
    api
      .getTrack(url.value, "builtin")
      .then((x) => {
        itemDetails.value = x;
      })
      .catch((e) => {
        console.error(e);
        itemDetails.value = undefined;
      })
      .finally(() => {
        loading.value = false;
      });
  }
};

const save = async function () {
  if (isEditMode.value && compProps.editItem) {
    loading.value = true;
    try {
      const updatedItem = {
        ...compProps.editItem,
        name: name.value,
      };
      delete updatedItem.sort_name;
      if (image.value) {
        updatedItem.metadata = {
          ...updatedItem.metadata,
          images: [
            {
              type: ImageType.THUMB,
              path: image.value,
              provider: "builtin",
              remotely_accessible: true,
            },
          ],
        };
      } else {
        updatedItem.metadata = {
          ...updatedItem.metadata,
          images: [],
        };
      }
      await api.sendCommand(updateEndpoint.value, {
        item_id: parseInt(compProps.editItem.item_id, 10),
        update: updatedItem,
        overwrite: true,
      });
      model.value = false;
    } catch (e) {
      console.error("Failed to edit item:", e);
    } finally {
      loading.value = false;
    }
  } else {
    fetchItemDetails();
    if (!itemDetails.value) {
      return;
    }
    itemDetails.value.name = name.value || itemDetails.value.name;
    delete itemDetails.value.sort_name;
    if (image.value) {
      itemDetails.value.metadata.images = [
        {
          type: ImageType.THUMB,
          path: image.value,
          provider: "builtin",
          remotely_accessible: true,
        },
      ];
    }
    api.addItemToLibrary(itemDetails.value, true).then(() => {
      model.value = false;
    });
  }
};
</script>
