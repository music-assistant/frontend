<template>
  <v-dialog v-model="model" transition="dialog-bottom-transition">
    <v-card>
      <Toolbar :icon="Tag" :title="dialogTitle" />
      <v-divider />
      <div class="dialog-body">
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
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="model = false">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn
            variant="flat"
            color="primary"
            :disabled="loading || !name"
            @click="save"
          >
            {{ $t("save") }}
          </v-btn>
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import Toolbar from "@/components/Toolbar.vue";
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Tag } from "lucide-vue-next";

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
    item_id: "0", // Use "0" for new items (will be replaced by actual DB ID)
    provider: "library", // Always "library" for user-created genres/aliases
    name: name.value,
    sort_name: sortName.value || name.value, // Defaults to name if not provided
    provider_mappings: [], // Required empty set for new items
    favorite: false, // Default to false
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

<style scoped>
.dialog-body {
  padding: 15px;
}
</style>
