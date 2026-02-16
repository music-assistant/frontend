<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("add_alias") }}</DialogTitle>
      </DialogHeader>
      <Input v-model="newAliasName" :placeholder="$t('add_alias')" />
      <DialogFooter>
        <Button variant="outline" @click="model = false">
          {{ $t("cancel") }}
        </Button>
        <Button :disabled="!newAliasName || loading" @click="createAndLink">
          {{ $t("add_alias") }}
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
import { Input } from "@/components/ui/input";
import { api } from "@/plugins/api";
import { GenreAlias } from "@/plugins/api/interfaces";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

interface Props {
  genreItemId: string;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();
const emit = defineEmits<{ created: [] }>();

const { t } = useI18n();
const newAliasName = ref("");
const loading = ref(false);

const createAndLink = async () => {
  if (!newAliasName.value || loading.value) return;

  loading.value = true;
  try {
    const created = await api.addAliasToLibrary(
      {
        item_id: "0",
        provider: "library",
        name: newAliasName.value,
        sort_name: newAliasName.value,
        provider_mappings: [],
        favorite: false,
      } as Partial<GenreAlias> as GenreAlias,
      true,
    );
    await api.addAliasToGenre(props.genreItemId, created.item_id);
    newAliasName.value = "";
    model.value = false;
    emit("created");
  } catch (error) {
    toast.error(t("add_alias_failed"));
  } finally {
    loading.value = false;
  }
};
</script>
