<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4">
        <v-text-field
          v-model="name"
          variant="outlined"
          :label="$t('enter_name')"
          :disabled="loading"
        />
        <v-text-field
          v-model="sortName"
          variant="outlined"
          :label="$t('sort.sort_name')"
          :disabled="loading"
        />
        <v-textarea
          v-model="description"
          variant="outlined"
          rows="3"
          :label="$t('description')"
          :disabled="loading"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="model = false">
          {{ $t("cancel") }}
        </Button>
        <Button :disabled="loading || !name" @click="save">
          {{ $t("save") }}
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
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

export interface Props {
  type: MediaType.GENRE | MediaType.GENRE_ALIAS;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();
const name = ref("");
const sortName = ref("");
const description = ref("");
const loading = ref(false);
const { t } = useI18n();
const dialogTitle = computed(() =>
  props.type === MediaType.GENRE ? t("add_genre") : t("add_alias"),
);

watch(
  () => model.value,
  (active) => {
    if (active != null) store.dialogActive = active;
    if (active === false) {
      name.value = "";
      sortName.value = "";
      description.value = "";
    }
  },
  { immediate: true },
);

const save = async () => {
  if (!name.value) return;
  loading.value = true;
  const item: Record<string, any> = {
    item_id: "0",
    provider: "library",
    name: name.value,
    sort_name: sortName.value || name.value,
    provider_mappings: [],
    favorite: false,
  };
  if (description.value) {
    item.metadata = { description: description.value };
  }
  try {
    if (props.type === MediaType.GENRE) {
      await api.addGenreToLibrary(item, true);
    } else {
      await api.addAliasToLibrary(item, true);
    }
    model.value = false;
  } finally {
    loading.value = false;
  }
};
</script>
