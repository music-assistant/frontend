<template>
  <section>
    <AudiobookHero :item="itemDetails" @edit-rows="rowsEditorOpen = true" />
    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <DetailTextRow
          v-if="rowId === 'about' && description"
          :title="$t('description')"
          :text="description"
          :dialog-title="itemDetails.name"
          markdown
          :lines="4"
          @edit-rows="rowsEditorOpen = true"
        />
        <Chapters
          v-else-if="
            rowId === 'chapters' && itemDetails.metadata.chapters?.length
          "
          :key="itemDetails.uri"
          :item-details="itemDetails"
        />
        <DetailAdminCard v-else-if="rowId === 'provider_mappings'">
          <ProviderDetails :item-details="itemDetails" />
        </DetailAdminCard>
      </template>
      <RowsEditor
        v-model:open="rowsEditorOpen"
        :item="itemDetails"
        :registry="audiobookRows"
        :available-ids="availableRows"
        :subtitle="$t('edit_rows_subtitle_audiobook')"
      />
    </template>
    <br />
  </section>
</template>

<script setup lang="ts">
import AudiobookHero from "@/components/audiobook/AudiobookHero.vue";
import {
  AUDIOBOOK_ROWS,
  audiobookRows,
} from "@/components/audiobook/audiobookRows";
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import RowsEditor from "@/components/details/RowsEditor.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import Chapters from "@/components/Chapters.vue";

import { useAudiobookDetails } from "@/composables/useAudiobookDetails";
import { computed, watch, ref } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const { itemDetails } = useAudiobookDetails(() => props);
const rowsEditorOpen = ref(false);
const availableRows = AUDIOBOOK_ROWS.map((row) => row.id);
const visibleRows = computed(() => {
  const { order, hidden } = audiobookRows.resolve(availableRows);
  return order.filter((rowId) => !hidden.has(rowId));
});
const description = computed(
  () =>
    itemDetails.value?.metadata.description ||
    itemDetails.value?.metadata.copyright,
);
watch(
  () => [props.itemId, props.provider],
  () => (rowsEditorOpen.value = false),
);

watch(
  () => itemDetails.value?.uri,
  () => document.querySelector(".content-section")?.scrollTo({ top: 0 }),
);
</script>
