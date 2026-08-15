<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader class="text-left">
        <DialogTitle>{{ $t("custom_image") }}</DialogTitle>
        <DialogDescription>
          {{ $t("custom_image_help") }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="genre" class="flex flex-col items-center gap-4">
        <img
          v-if="previewUrl || currentImageUrl"
          :src="previewUrl || currentImageUrl"
          :alt="genre.name"
          class="h-40 w-40 rounded-lg object-cover"
        />
        <div class="flex items-center gap-2">
          <Button variant="outline" :disabled="uploading" @click="pickFile">
            <ImagePlus />
            {{ $t("choose_image") }}
          </Button>
          <span class="max-w-[180px] truncate text-sm text-muted-foreground">
            {{ selectedFile?.name ?? "" }}
          </span>
        </div>
        <Alert v-if="uploadError" variant="destructive">
          <AlertDescription>{{ uploadError }}</AlertDescription>
        </Alert>
        <input
          ref="fileInputRef"
          type="file"
          :accept="CUSTOM_IMAGE_ACCEPT"
          class="hidden"
          :aria-label="$t('choose_image')"
          @change="onFileSelected"
        />
      </div>

      <DialogFooter>
        <Button
          v-if="hasCustomImage"
          variant="destructive"
          :disabled="uploading"
          @click="removeImage"
        >
          <ImageOff />
          {{ $t("remove_custom_image") }}
        </Button>
        <Button variant="outline" :disabled="uploading" @click="open = false">
          {{ $t("cancel") }}
        </Button>
        <Button :disabled="!selectedFile || uploading" @click="upload">
          <Spinner v-if="uploading" />
          {{ $t("save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  CUSTOM_IMAGE_ACCEPT,
  getCustomImage,
  MAX_CUSTOM_IMAGE_BYTES,
  readFileAsBase64,
} from "@/helpers/customImage";
import { getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { ImageType, type Genre } from "@/plugins/api/interfaces";
import { eventbus, type GenreImageDialogEvent } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { ImageOff, ImagePlus } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t } = useI18n();

const open = ref(false);
const genre = ref<Genre>();
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref("");
const uploadError = ref("");
const uploading = ref(false);

const currentImageUrl = computed(() =>
  genre.value
    ? getImageThumbForItem(genre.value, ImageType.THUMB, 320)
    : undefined,
);

const hasCustomImage = computed(
  () => !!genre.value && !!getCustomImage(genre.value),
);

const pickFile = () => {
  fileInputRef.value?.click();
};

const onFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  // Allow re-picking the same file after a failed upload.
  input.value = "";
  uploadError.value = "";
  if (!file) return;
  if (file.size > MAX_CUSTOM_IMAGE_BYTES) {
    clearSelection();
    uploadError.value = t("image_too_large", [
      Math.round(MAX_CUSTOM_IMAGE_BYTES / 1024 / 1024),
    ]);
    return;
  }
  clearSelection();
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
};

const upload = async () => {
  const file = selectedFile.value;
  if (!file || !genre.value || uploading.value) return;
  uploading.value = true;
  uploadError.value = "";
  try {
    const data = await readFileAsBase64(file);
    genre.value = await api.setGenreImage(genre.value.item_id, data, file.name);
    toast.success(t("custom_image_updated"));
    open.value = false;
  } catch (error) {
    // The server explains why (size, unsupported format), and that message
    // is more useful than anything we could write here.
    uploadError.value =
      typeof error === "string"
        ? error
        : ((error as Error)?.message ?? t("custom_image_upload_failed"));
  } finally {
    uploading.value = false;
  }
};

const removeImage = async () => {
  if (!genre.value || uploading.value) return;
  uploading.value = true;
  try {
    genre.value = await api.removeGenreImage(genre.value.item_id);
    toast.success(t("custom_image_removed"));
    open.value = false;
  } finally {
    uploading.value = false;
  }
};

function clearSelection(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
  selectedFile.value = null;
}

function reset(): void {
  clearSelection();
  uploadError.value = "";
  uploading.value = false;
}

watch(open, (isOpen) => {
  store.dialogActive = isOpen;
  if (!isOpen) reset();
});

onMounted(() => {
  eventbus.on("genreImageDialog", (evt: GenreImageDialogEvent) => {
    reset();
    genre.value = evt.genre;
    open.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("genreImageDialog");
});
</script>
