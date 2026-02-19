<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("remove_alias") }}</DialogTitle>
      </DialogHeader>
      <p>{{ $t("confirm_remove_alias", [alias || ""]) }}</p>
      <DialogFooter>
        <Button variant="outline" @click="model = false">
          {{ $t("cancel") }}
        </Button>
        <Button variant="destructive" :disabled="loading" @click="removeAlias">
          {{ $t("remove") }}
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
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

interface Props {
  alias: string | null;
  genreItemId: string;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();
const emit = defineEmits<{ removed: [] }>();

const { t } = useI18n();
const loading = ref(false);

const removeAlias = async () => {
  if (!props.alias || loading.value) return;

  loading.value = true;
  try {
    await api.removeGenreAlias(props.genreItemId, props.alias);
    model.value = false;
    emit("removed");
  } catch (error) {
    toast.error(t("remove_alias_failed"));
  } finally {
    loading.value = false;
  }
};
</script>
