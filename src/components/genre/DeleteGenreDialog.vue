<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent
      class="sm:max-w-[520px]"
      :show-close-button="!loading"
      @escape-key-down="preventDismissWhileLoading"
      @interact-outside="preventDismissWhileLoading"
    >
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
        <Button
          type="button"
          variant="outline"
          :disabled="loading"
          @click="handleOpenChange(false)"
        >
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
import { backFromMediaDetails } from "@/helpers/navigation";
import { api, ApiCommandError } from "@/plugins/api";
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
let disposed = false;

const confirmationMessage = computed(() => {
  if (step.value === 1) {
    return genreIds.value.length > 1
      ? t("confirm_delete_genres", [genreIds.value.length])
      : t("confirm_delete_genre");
  }
  return t("confirm_delete_genre_2");
});

const handleOpenChange = (value: boolean) => {
  if (!loading.value) open.value = value;
};

const preventDismissWhileLoading = (event: Event) => {
  if (loading.value) event.preventDefault();
};

const reportSuccess = (count: number) => {
  toast.success(count > 1 ? t("genres_deleted", [count]) : t("genre_deleted"));
};

const handleConfirm = async () => {
  if (loading.value || disposed) return;
  if (step.value === 1) {
    step.value = 2;
    return;
  }
  if (genreIds.value.length === 0) return;
  const count = genreIds.value.length;
  loading.value = true;
  try {
    while (genreIds.value.length > 0) {
      await api.removeGenreFromLibrary(genreIds.value[0]);
      if (disposed) return;
      genreIds.value = genreIds.value.slice(1);
    }
    reportSuccess(count);
    open.value = false;
    if (navigateBack.value) backFromMediaDetails(router);
    eventbus.emit("clearSelection");
  } catch (failure) {
    if (disposed) return;
    const removed = count - genreIds.value.length;
    if (removed > 0) reportSuccess(removed);
    // API command failures already produce feedback from the API client.
    if (!(failure instanceof ApiCommandError)) {
      toast.error(
        count > 1 ? t("delete_genres_failed") : t("delete_genre_failed"),
      );
    }
  } finally {
    if (!disposed) loading.value = false;
  }
};

watch(open, (value) => {
  store.dialogActive = value;
});

onMounted(() => {
  eventbus.on("deleteGenreDialog", (evt: DeleteGenreDialogEvent) => {
    if (loading.value) return;
    genreIds.value = [...evt.genreIds];
    navigateBack.value = evt.navigateBack ?? false;
    step.value = 1;
    open.value = true;
  });
});

onBeforeUnmount(() => {
  disposed = true;
  eventbus.off("deleteGenreDialog");
});
</script>
