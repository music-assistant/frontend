<template>
  <ReleaseShelf
    :title="$t('discography')"
    :meta="isPhone ? undefined : $t('discography_hint')"
    :hide-title="!showHeading"
    :items="shelfItems"
    :view-all-to="viewAllTo"
    :view-all-name="typeNames"
    :item-count="itemCount"
    :parent-item="artist"
    @edit-rows="emit('edit-rows')"
  >
    <template #label>
      <div class="flex items-center gap-[10px]">
        <DiscographyTypePicker
          :model-value="types"
          @toggle="(type) => toggleDiscographyType(rowId, type)"
        />
      </div>
    </template>
  </ReleaseShelf>
</template>

<script setup lang="ts">
import {
  DISCOGRAPHY_TYPES_QUERY,
  discographyTypes,
  toggleDiscographyType,
  type DiscographyRowId,
} from "@/components/artist/discographyRows";
import DiscographyTypePicker from "@/components/artist/DiscographyTypePicker.vue";
import ReleaseShelf from "@/components/details/ReleaseShelf.vue";
import type { Album, Artist } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface Props {
  rowId: DiscographyRowId;
  // a library artist, the only kind with a discography
  artist: Artist;
  // undefined while the row is still loading
  items?: Album[];
  itemCount?: number;
  // off for a row right below another discography row, which already has it
  showHeading?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  items: undefined,
  itemCount: undefined,
  showHeading: true,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

// a prolific artist's discography runs to hundreds of releases: the shelf
// shows the newest, "View all" has them all
const SHELF_LIMIT = 50;

const isPhone = computed(() => isPhoneSizedScreen());

const types = computed(() => discographyTypes(props.rowId));

const shelfItems = computed(() => props.items?.slice(0, SHELF_LIMIT));

// e.g. "Albums, Live"
const typeNames = computed(() =>
  types.value.map((type) => $t(`album_type_plural.${type}`)).join(", "),
);

// the full listing, starting on this row's types
const viewAllTo = computed<RouteLocationRaw>(() => ({
  name: "artistlisting",
  params: {
    provider: props.artist.provider,
    itemId: props.artist.item_id,
    listing: "discography",
  },
  query: { [DISCOGRAPHY_TYPES_QUERY]: types.value.join(",") },
}));
</script>
