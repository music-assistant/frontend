<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from "vue";
import { useGenresStore } from "@/stores/genres";
import { store } from "@/plugins/store";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import type { Genre } from "@/plugins/api/interfaces";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  modelValue: boolean;
  sourceGenres: Genre[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "saved"): void;
}>();

const { t } = useI18n();
const genresStore = useGenresStore();
const targetGenre = ref<Genre | string | null>(null);
const loading = ref(false);
const searchInput = ref("");
const combobox = ref<any>(null);

const sourceGenreNames = computed(() =>
  props.sourceGenres.map((g) => g.name).join(", "),
);

const items = computed(() => {
  const all = [...genresStore.genres.value, ...genresStore.searchResults.value];
  const sourceIds = props.sourceGenres.map((g) => g.item_id);
  const filtered = all.filter((g) => !sourceIds.includes(g.item_id));
  const unique = new Map();
  for (const g of filtered) {
    unique.set(g.item_id, g);
  }
  return Array.from(unique.values());
});

watch(
  () => props.modelValue,
  (val) => {
    store.dialogActive = val;
    if (val) {
      targetGenre.value = null;
      searchInput.value = "";
      if (genresStore.genres.value.length === 0) {
        genresStore.loadGenres();
      }
      setTimeout(() => {
        combobox.value?.focus();
      }, 100);
    }
  },
);

onBeforeUnmount(() => {
  store.dialogActive = false;
});

watch(searchInput, (val) => {
  if (val && val.length > 1) {
    genresStore.searchGenres(val);
  }
});

const onSave = async () => {
  if (!targetGenre.value) return;
  loading.value = true;
  try {
    const sourceIds = props.sourceGenres.map((g) => parseInt(g.item_id));
    let targetId: number;

    if (typeof targetGenre.value === "string") {
      const newGenre = await genresStore.createGenre(targetGenre.value);
      targetId = parseInt(newGenre.item_id);
    } else {
      targetId = parseInt(targetGenre.value.item_id);
    }

    await genresStore.mergeGenres(sourceIds, targetId);
    emit("saved");
    emit("update:modelValue", false);
    eventbus.emit("clearSelection");
    eventbus.emit("refreshItems", "genres");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ $t("genres.link_genres") }}</v-card-title>
      <v-card-text>
        <v-alert v-if="!authManager.isAdmin()" type="warning" class="mb-4">
          {{ $t("admin_required") }}
        </v-alert>
        <div class="mb-4">
          {{ $t("genres.link_genres_description", [sourceGenreNames]) }}
        </div>
        <v-combobox
          ref="combobox"
          v-model="targetGenre"
          v-model:search="searchInput"
          :items="items"
          :loading="genresStore.loading.value"
          item-title="name"
          item-value="item_id"
          :label="$t('genres.target_genre')"
          return-object
          hide-no-data
          hide-selected
          clearable
          autofocus
          :placeholder="$t('genres.search_or_enter_new_genre')"
          :disabled="!authManager.isAdmin()"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="grey"
          variant="text"
          @click="emit('update:modelValue', false)"
        >
          {{ $t("cancel") }}
        </v-btn>
        <v-btn
          color="primary"
          :disabled="!targetGenre || !authManager.isAdmin()"
          :loading="loading"
          @click="onSave"
        >
          {{ $t("genres.link") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
