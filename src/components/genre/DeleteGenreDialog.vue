<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("delete_genre") }}</DialogTitle>
      </DialogHeader>
      <div class="py-4">
        <p class="text-sm text-muted-foreground">
          {{ confirmationMessage }}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="cancel">
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
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const model = defineModel<boolean>();
const emit = defineEmits<{
  confirm: [];
}>();

const { t } = useI18n();
const loading = ref(false);
const step = ref(1);

const confirmationMessage = computed(() => {
  return step.value === 1
    ? t("confirm_delete_genre")
    : t("confirm_delete_genre_2");
});

const handleConfirm = () => {
  if (step.value === 1) {
    step.value = 2;
  } else {
    loading.value = true;
    emit("confirm");
    toast.success(t("genre_deleted"));
  }
};

const cancel = () => {
  model.value = false;
};

watch(
  () => model.value,
  (isOpen) => {
    if (!isOpen) {
      // Reset to step 1 when dialog closes
      setTimeout(() => {
        step.value = 1;
        loading.value = false;
      }, 200);
    }
  },
);
</script>
