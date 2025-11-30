<script setup lang="ts">
import type { Genre } from "@/plugins/api/interfaces";
import { ImageType } from "@/plugins/api/interfaces";
import { useGenresStore } from "@/stores/genres";
import { store } from "@/plugins/store";
import { eventbus } from "@/plugins/eventbus";
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { getMediaItemImage, getImageURL } from "./MediaItemThumb.vue";
import { useI18n } from "vue-i18n";

const genresStore = useGenresStore();
const {
  createGenre,
  updateGenre,
  addAlias,
  removeAlias,
  deleteGenre,
  mergeGenres,
  searchGenres,
} = genresStore;
const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  genre?: Genre; // If provided, we are editing
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "saved"): void;
}>();

const name = ref("");
const linkedGenres = ref<(string | Genre)[]>([]);
const loading = ref(false);
const image = ref<string | null>(null);
const searchInput = ref("");

const isEdit = computed(() => !!props.genre);
const title = computed(() =>
  isEdit.value ? "Edit Genre" : "Create New Genre",
);

const items = computed(() => {
  const all = [...genresStore.genres.value, ...genresStore.searchResults.value];
  // Filter out the current genre if editing
  const currentId = props.genre?.item_id;
  const filtered = all.filter((g) => g.item_id !== currentId);

  // Deduplicate
  const unique = new Map();
  for (const g of filtered) {
    unique.set(g.item_id, g);
  }
  return Array.from(unique.values());
});

watch(searchInput, (val) => {
  if (val && val.length > 1) {
    searchGenres(val);
  }
});

const imageUrlInput = computed({
  get: () =>
    image.value && !image.value.startsWith("data:") ? image.value : "",
  set: (val) => {
    image.value = val;
  },
});

const displayImage = computed(() => {
  if (!image.value) return "";
  if (image.value.startsWith("data:")) return image.value;
  const imgObj = {
    path: image.value,
    provider: image.value.startsWith("http") ? "http" : "builtin",
    type: ImageType.THUMB,
    remotely_accessible: image.value.startsWith("http"),
  };
  return getImageURL(imgObj);
});

watch(
  () => props.modelValue,
  (val) => {
    store.dialogActive = val;
    if (val) {
      if (props.genre) {
        name.value = props.genre.name;
        linkedGenres.value = props.genre.aliases
          ? [...props.genre.aliases]
          : [];
        const img = getMediaItemImage(props.genre, ImageType.THUMB);
        image.value = img ? img.path : null;
      } else {
        name.value = "";
        linkedGenres.value = [];
        image.value = null;
      }
      searchInput.value = "";
      if (genresStore.genres.value.length === 0) {
        genresStore.loadGenres();
      }
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  store.dialogActive = false;
});

const onSave = async () => {
  if (!name.value) return;
  loading.value = true;
  try {
    let genreToUpdate: Genre | undefined;

    // Separate strings (aliases) and objects (merge candidates)
    const newAliases = linkedGenres.value.filter(
      (x): x is string => typeof x === "string",
    );
    const genresToMerge = linkedGenres.value.filter(
      (x): x is Genre => typeof x === "object",
    );

    if (isEdit.value && props.genre) {
      // Update name
      genreToUpdate = { ...props.genre, name: name.value };
      await updateGenre(genreToUpdate);

      // Handle aliases
      const originalAliases = props.genre.aliases || [];

      const added = newAliases.filter((a) => !originalAliases.includes(a));
      const removed = originalAliases.filter((a) => !newAliases.includes(a));

      const genreId = parseInt(props.genre.item_id);
      for (const alias of added) {
        await addAlias(genreId, alias);
      }
      for (const alias of removed) {
        await removeAlias(genreId, alias);
      }
    } else {
      genreToUpdate = await createGenre(name.value);
      // For new genres, we need to add the aliases after creation
      if (genreToUpdate && newAliases.length > 0) {
        const genreId = parseInt(genreToUpdate.item_id);
        for (const alias of newAliases) {
          await addAlias(genreId, alias);
        }
      }
    }

    // Handle Merges
    if (genresToMerge.length > 0 && genreToUpdate) {
      const sourceIds = genresToMerge.map((g) => parseInt(g.item_id));
      const targetId = parseInt(genreToUpdate.item_id);
      await mergeGenres(sourceIds, targetId);
    }

    // Handle Image
    if (image.value && genreToUpdate) {
      if (!genreToUpdate.metadata) genreToUpdate.metadata = {};
      const isDataUrl = image.value.startsWith("data:");
      genreToUpdate.metadata.images = [
        {
          type: ImageType.THUMB,
          path: image.value,
          provider: isDataUrl ? "builtin" : "http",
          remotely_accessible: !isDataUrl,
        },
      ];
      await updateGenre(genreToUpdate);
    }

    emit("saved");
    emit("update:modelValue", false);
    eventbus.emit("refreshItems", "genres");
  } finally {
    loading.value = false;
  }
};

const onDelete = async () => {
  if (!props.genre) return;
  if (confirm(t("are_you_sure"))) {
    loading.value = true;
    try {
      await deleteGenre(parseInt(props.genre.item_id));
      emit("saved");
      emit("update:modelValue", false);
      eventbus.emit("refreshItems", "genres");
    } finally {
      loading.value = false;
    }
  }
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card @keydown.stop>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="name"
          :label="$t('name')"
          required
          autofocus
          @keyup.enter="onSave"
        />

        <v-combobox
          v-model="linkedGenres"
          v-model:search="searchInput"
          :items="items"
          :loading="genresStore.loading.value"
          item-title="name"
          item-value="item_id"
          label="Linked Genres"
          return-object
          multiple
          chips
          closable-chips
          hide-selected
          clearable
          placeholder="Search for genres or type new alias..."
          class="mb-2"
        >
          <template #selection="{ item, index }">
            <v-chip
              v-if="index < 5"
              closable
              size="small"
              @click:close="linkedGenres.splice(index, 1)"
            >
              {{ typeof item.value === "string" ? item.value : item.title }}
            </v-chip>
            <span
              v-if="index === 5"
              class="text-grey text-caption align-self-center"
            >
              (+{{ linkedGenres.length - 5 }} others)
            </span>
          </template>
        </v-combobox>

        <v-text-field
          v-model="imageUrlInput"
          label="Image URL"
          prepend-icon="mdi-image"
          clearable
          :hint="
            image && image.startsWith('data:') ? 'Image uploaded from file' : ''
          "
          persistent-hint
        />

        <div v-if="displayImage" class="mb-4 d-flex justify-center">
          <v-img :src="displayImage" max-height="200" max-width="200" contain />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="isEdit" color="error" variant="text" @click="onDelete">
          {{ $t("settings.delete") }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="grey"
          variant="text"
          @click="emit('update:modelValue', false)"
        >
          Cancel
        </v-btn>
        <v-btn color="primary" :loading="loading" @click="onSave">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
