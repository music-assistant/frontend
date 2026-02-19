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
        <Button :disabled="!newAliasName || loading" @click="addAlias">
          {{ $t("add") }}
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

const addAlias = async () => {
  if (!newAliasName.value || loading.value) return;

  loading.value = true;
  try {
    await api.addGenreAlias(props.genreItemId, newAliasName.value);
    toast.success(t("alias_added_successfully"));
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
