<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{
          genreIds.length > 1
            ? $t("delete_genres", [genreIds.length])
            : $t("delete_genre")
        }}</DialogTitle>
      </DialogHeader>
      <div class="py-4">
        <p class="text-sm text-muted-foreground">
          {{ confirmationMessage }}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          :disabled="loading"
          @click="handleConfirm"
        >
          {{ $t("delete") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/plugins/api";
import { eventbus, type DeleteGenreDialogEvent } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

const { t } = useI18n();
const router = useRouter();

const open = ref(false);
const loading = ref(false);
const step = ref(1);
const genreIds = ref<string[]>([]);
const navigateBack = ref(false);

const confirmationMessage = computed(() => {
  if (step.value === 1) {
    return genreIds.value.length > 1
      ? t("confirm_delete_genres", [genreIds.value.length])
      : t("confirm_delete_genre");
  }
  return t("confirm_delete_genre_2");
});

const handleConfirm = () => {
  if (step.value === 1) {
    step.value = 2;
  } else {
    if (genreIds.value.length === 0) return;
    loading.value = true;
    for (const id of genreIds.value) {
      api.removeGenreFromLibrary(id);
    }
    toast.success(
      genreIds.value.length > 1
        ? t("genres_deleted", [genreIds.value.length])
        : t("genre_deleted"),
    );
    open.value = false;
    if (navigateBack.value) {
      router.back();
    }
    eventbus.emit("clearSelection");
  }
};

const reset = () => {
  genreIds.value = [];
  navigateBack.value = false;
  loading.value = false;
  step.value = 1;
};

watch(open, (v) => {
  store.dialogActive = v;
  if (!v) {
    // Reset after close animation
    setTimeout(reset, 200);
  }
});

onMounted(() => {
  eventbus.on("deleteGenreDialog", (evt: DeleteGenreDialogEvent) => {
    reset();
    genreIds.value = evt.genreIds;
    navigateBack.value = evt.navigateBack ?? false;
    open.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("deleteGenreDialog");
});
</script>
