<!--
  Dialog to Add (or edit) a custom Radio or Track link
-->
<template>
  <v-dialog v-model="model" transition="dialog-bottom-transition">
    <v-card>
      <Toolbar icon="mdi-playlist-plus" :title="$t('add_url_item')" />
      <v-divider />
      <br />
      <div style="padding: 15px">
        <v-text-field
          v-model="url"
          variant="outlined"
          :label="$t('enter_url')"
          :disabled="loading"
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
            $t('cancel')
          }}</v-btn>
          <v-btn
            variant="flat"
            color="primary"
            :disabled="loading"
            @click="save"
            >{{ $t('save') }}</v-btn
          >
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ImageType, MediaType } from '@/plugins/api/interfaces';
import type { Radio, Track } from '@/plugins/api/interfaces';
import { ref, watch } from 'vue';
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import Toolbar from '@/components/Toolbar.vue';

export interface Props {
  type: MediaType;
}

const model = defineModel<boolean>();
const compProps = defineProps<Props>();
const url = ref<string>('');
const name = ref<string>('');
const image = ref<string>('');
const loading = ref<boolean>(false);
const itemDetails = ref<Radio | Track>();

watch(
  () => model.value,
  (active) => {
    if (active != null) store.dialogActive = active;
    if (active == false) {
      url.value = '';
      name.value = '';
      image.value = '';
      itemDetails.value = undefined;
    }
  },
  { immediate: true },
);

watch(
  () => itemDetails.value,
  (details) => {
    if (details) {
      if (!name.value) name.value = details.name;
      for (const img of details.metadata.images || []) {
        if (img.type == 'thumb') {
          image.value = img.url;
          break;
        }
      }
    }
  },
);

const fetchItemDetails = () => {
  if (!url.value || !url.value.startsWith('http')) {
    return;
  }
  loading.value = true;
  if (compProps.type == MediaType.RADIO) {
    api
      .getRadio(url.value, 'builtin')
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
      .getTrack(url.value, 'builtin')
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

const save = function () {
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
        provider: 'builtin',
        remotely_accessible: true,
      },
    ];
  }
  api.addItemToLibrary(itemDetails.value, true).then(() => {
    model.value = false;
  });
};
</script>
