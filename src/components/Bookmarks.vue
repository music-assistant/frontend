<template>
  <section v-if="bookmarks.length" style="margin-bottom: 10px">
    <Toolbar
      :title="$t('bookmarks')"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <v-divider />
    <Container v-if="expanded">
      <v-list>
        <template v-for="copy in copies" :key="copy.instanceId">
          <!-- a bookmark only fits the copy it was made on, so they are grouped per copy -->
          <v-list-subheader>
            <div class="d-flex align-center ga-2">
              <ProviderIcon :domain="copy.domain" :size="20" />
              {{ copy.name }}
            </div>
          </v-list-subheader>
          <v-list-item
            v-for="bookmark in copy.bookmarks"
            :key="`${bookmark.provider_item_id}-${bookmark.start}`"
            :disabled="!itemIsAvailable(itemDetails)"
            @click="bookmarkClicked(bookmark)"
          >
            <template #prepend>
              <div style="width: 90px">
                <v-chip>{{ formatDuration(bookmark.start) }}</v-chip>
              </div>
            </template>
            <template #title>
              <div>{{ bookmark.name }}</div>
            </template>
            <template v-if="storedOnlyByMusicAssistant(bookmark)" #subtitle>
              {{ $t("bookmark_stored_by_music_assistant") }}
            </template>
            <template v-if="isEditable(bookmark)" #append>
              <v-btn
                icon
                variant="text"
                size="small"
                :title="$t('rename_bookmark')"
                @click.stop="renameClicked(bookmark)"
              >
                <Pencil :size="18" />
              </v-btn>
              <v-btn
                icon
                variant="text"
                size="small"
                :title="$t('delete')"
                @click.stop="removeClicked(bookmark)"
              >
                <Trash2 :size="18" />
              </v-btn>
            </template>
          </v-list-item>
        </template>
      </v-list>
    </Container>
    <BookmarkDialog
      v-model:open="renameDialogOpen"
      :title="$t('rename_bookmark')"
      :initial-name="renamedBookmark?.name ?? ''"
      @save="renameSaved"
    />
  </section>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "@lucide/vue";
import BookmarkDialog from "@/components/BookmarkDialog.vue";
import Container from "@/components/Container.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import Toolbar from "@/components/Toolbar.vue";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaType,
  ProviderFeature,
  type Audiobook,
  type MediaItemBookmark,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface Props {
  itemDetails: Audiobook;
}
const props = defineProps<Props>();

const expanded = ref(true);
const bookmarks = ref<MediaItemBookmark[]>([]);
const renameDialogOpen = ref(false);
const renamedBookmark = ref<MediaItemBookmark>();

const toggleExpand = function () {
  expanded.value = !expanded.value;
};

const toolbarMenuItems = computed(() => {
  return [
    // toggle expand
    {
      label: "tooltip.collapse_expand",
      icon: expanded.value ? ChevronUp : ChevronDown,
      action: toggleExpand,
      overflowAllowed: false,
    },
  ];
});

// the server lists the bookmarks per copy already, ordered by start
const copies = computed(() => {
  const grouped: {
    instanceId: string;
    domain: string;
    name: string;
    bookmarks: MediaItemBookmark[];
  }[] = [];
  for (const bookmark of bookmarks.value) {
    const instanceId = bookmark.provider_instance_id;
    let copy = grouped.find((x) => x.instanceId === instanceId);
    if (!copy) {
      const provider = api.providers[instanceId];
      copy = {
        instanceId,
        domain: provider?.domain ?? instanceId,
        name: provider?.name ?? instanceId,
        bookmarks: [],
      };
      grouped.push(copy);
    }
    copy.bookmarks.push(bookmark);
  }
  return grouped;
});

const providerSupports = function (
  bookmark: MediaItemBookmark,
  feature: ProviderFeature,
) {
  return (
    api.providers[bookmark.provider_instance_id]?.supported_features.includes(
      feature,
    ) ?? false
  );
};

// worth a hint only where the provider keeps bookmarks of its own
const storedOnlyByMusicAssistant = function (bookmark: MediaItemBookmark) {
  return (
    bookmark.stored_by_music_assistant &&
    providerSupports(bookmark, ProviderFeature.AUDIOBOOK_BOOKMARKS)
  );
};

const isEditable = function (bookmark: MediaItemBookmark) {
  return (
    bookmark.stored_by_music_assistant ||
    providerSupports(bookmark, ProviderFeature.AUDIOBOOK_BOOKMARKS_EDIT)
  );
};

const loadBookmarks = async function () {
  bookmarks.value = await api.getAudiobookBookmarks(
    props.itemDetails.item_id,
    props.itemDetails.provider,
  );
};

const bookmarkClicked = function (bookmark: MediaItemBookmark) {
  if (!itemIsAvailable(props.itemDetails)) return;
  // play the copy the bookmark was made on, its position may not fit another one
  api.playMedia(
    `${bookmark.provider_instance_id}://${MediaType.AUDIOBOOK}/${bookmark.provider_item_id}`,
    undefined,
    { start_position: bookmark.start },
  );
};

const renameClicked = function (bookmark: MediaItemBookmark) {
  renamedBookmark.value = bookmark;
  renameDialogOpen.value = true;
};

const renameSaved = async function (name: string) {
  const bookmark = renamedBookmark.value;
  if (!bookmark) return;
  await api.setAudiobookBookmark(
    bookmark.provider_instance_id,
    bookmark.provider_item_id,
    bookmark.start,
    name,
  );
  await loadBookmarks();
};

const removeClicked = function (bookmark: MediaItemBookmark) {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("delete_bookmark"),
    message: $t("delete_bookmark_confirm", { name: bookmark.name }),
    confirmLabel: $t("delete"),
    onConfirm: async () => {
      await api.removeAudiobookBookmark(
        bookmark.provider_instance_id,
        bookmark.provider_item_id,
        bookmark.start,
      );
      await loadBookmarks();
    },
  });
};

watch(
  () => props.itemDetails.uri,
  () => loadBookmarks(),
  { immediate: true },
);

onMounted(() => {
  eventbus.on("bookmarksChanged", loadBookmarks);
});

onBeforeUnmount(() => {
  eventbus.off("bookmarksChanged", loadBookmarks);
});
</script>
