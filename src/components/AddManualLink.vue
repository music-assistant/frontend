<!--
  Dialog to Add (or edit) a custom Radio or Track link
-->
<template>
  <Dialog v-model:open="model">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("add_url_item") }}</DialogTitle>
        <DialogDescription class="sr-only">{{ $t('aria.add_url_item') }}</DialogDescription>
      </DialogHeader>
      <Separator />
      <div class="space-y-4 pt-2">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ $t("enter_url") }}</label>
          <Input
            v-model="url"
            :placeholder="$t('enter_url')"
            :disabled="loading"
            @blur="fetchItemDetails"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ $t("enter_name") }}</label>
          <Input
            v-model="name"
            :placeholder="$t('enter_name')"
            :disabled="loading"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ $t("image_url") }}</label>
          <Input
            v-model="image"
            :placeholder="$t('image_url')"
            :disabled="loading"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="model = false">{{
          $t("cancel")
        }}</Button>
        <Button
          :disabled="loading"
          @click="save"
          >{{ $t("save") }}</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ImageType, MediaType } from "@/plugins/api/interfaces";
import type { Radio, Track } from "@/plugins/api/interfaces";
import { ref, watch } from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
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
import { Separator } from "@/components/ui/separator";

export interface Props {
  type: MediaType;
}

const model = defineModel<boolean>();
const compProps = defineProps<Props>();
const url = ref<string>("");
const name = ref<string>("");
const image = ref<string>("");
const loading = ref<boolean>(false);
const itemDetails = ref<Radio | Track>();

watch(
  () => model.value,
  (active) => {
    if (active != null) store.dialogActive = active;
    if (active == false) {
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
    if (details) {
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
        provider: "builtin",
        remotely_accessible: true,
      },
    ];
  }
  api.addItemToLibrary(itemDetails.value, true).then(() => {
    model.value = false;
  });
};
</script>
