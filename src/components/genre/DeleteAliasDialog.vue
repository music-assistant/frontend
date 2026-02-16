<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("delete_alias") }}</DialogTitle>
      </DialogHeader>
      <p>
        {{
          $t("confirm_delete_alias", [
            alias?.name || "",
            (alias?.genres || []).length,
          ])
        }}
      </p>
      <DialogFooter>
        <Button variant="outline" @click="model = false">
          {{ $t("cancel") }}
        </Button>
        <Button variant="destructive" :disabled="loading" @click="deleteAlias">
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
import { GenreAlias } from "@/plugins/api/interfaces";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

interface Props {
  alias: GenreAlias | null;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();
const emit = defineEmits<{ deleted: [] }>();

const { t } = useI18n();
const loading = ref(false);

const deleteAlias = async () => {
  if (!props.alias || loading.value) return;

  loading.value = true;
  try {
    await api.removeAliasFromLibrary(props.alias.item_id);
    model.value = false;
    emit("deleted");
  } catch (error) {
    toast.error(t("delete_alias_failed"));
  } finally {
    loading.value = false;
  }
};
</script>
