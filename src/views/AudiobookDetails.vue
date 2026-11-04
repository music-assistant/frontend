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

import {
  EventType,
  MediaType,
  type Audiobook,
  type EventMessage,
  type PlaylogUpdate,
} from "@/plugins/api/interfaces";
import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed, onScopeDispose, watch, ref } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Audiobook>();
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
let loadRequest = 0;
let playState:
  Pick<Audiobook, "uri" | "fully_played" | "resume_position_ms"> | undefined;

const loadItemDetails = async function () {
  const request = ++loadRequest;
  const { itemId, provider } = props;
  itemDetails.value = undefined;
  rowsEditorOpen.value = false;
  playState = undefined;
  const audiobook = await api.getAudiobook(itemId, provider);
  if (request !== loadRequest) return;
  applyAudiobookResponse(audiobook);
};

watch(
  () => [props.itemId, props.provider],
  ([itemId]) => {
    if (itemId) loadItemDetails();
  },
  { immediate: true },
);

useDetailItemUpdates(itemDetails, { onUpdate: applyPlayState });

const unsubPlaylog = api.subscribe(
  EventType.PLAYLOG_UPDATED,
  (evt: EventMessage) => {
    const update = evt.data as PlaylogUpdate | undefined;
    if (!update || update.media_type !== MediaType.AUDIOBOOK) return;
    if (update.userid && update.userid !== store.currentUser?.user_id) return;
    const routeUri = `${props.provider}://${MediaType.AUDIOBOOK}/${props.itemId}`;
    if (update.uri !== itemDetails.value?.uri && update.uri !== routeUri)
      return;
    playState = {
      uri: update.uri,
      fully_played: update.fully_played,
      resume_position_ms: update.seconds_played * 1000,
    };
    applyPlayState();
  },
);
onScopeDispose(() => {
  ++loadRequest;
  unsubPlaylog();
});

watch(
  () => itemDetails.value?.uri,
  () => document.querySelector(".content-section")?.scrollTo({ top: 0 }),
);

function applyAudiobookResponse(audiobook: Audiobook) {
  itemDetails.value = audiobook;
  if (playState?.uri !== audiobook.uri) {
    playState = {
      uri: audiobook.uri,
      fully_played: audiobook.fully_played,
      resume_position_ms: audiobook.resume_position_ms,
    };
  }
  applyPlayState();
}

function applyPlayState() {
  const audiobook = itemDetails.value;
  if (!audiobook || playState?.uri !== audiobook.uri) return;
  itemDetails.value = {
    ...audiobook,
    fully_played: playState.fully_played,
    resume_position_ms: playState.resume_position_ms,
  };
}
</script>
