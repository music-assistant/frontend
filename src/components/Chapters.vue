<template>
  <section v-if="groups.length" style="margin-bottom: 10px">
    <Toolbar
      :title="$t(titleKey)"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <v-divider />
    <Container v-if="expanded">
      <v-list>
        <!-- each chapter is followed by the bookmarks inside it -->
        <template
          v-for="group in groups"
          :key="group.chapter?.position ?? 'bookmarks'"
        >
          <v-list-item
            v-if="group.chapter"
            :disabled="!itemIsAvailable(itemDetails)"
            @click="chapterClicked(group.chapter)"
          >
            <template #prepend>
              <div style="width: 50px">
                <v-chip>
                  {{ group.chapter.position }}
                </v-chip>
              </div>
            </template>
            <template #title>
              <div>{{ group.chapter.name }}</div>
            </template>
            <template #append>
              <span v-if="group.chapter.end" class="text-caption"
                >{{ formatDuration(group.chapter.end - group.chapter.start) }}
              </span>
            </template>
          </v-list-item>
          <v-list-item
            v-for="bookmark in group.bookmarks"
            :key="`${bookmark.provider_instance_id}-${bookmark.provider_item_id}-${bookmark.start}`"
            :class="{ 'bookmark--in-chapter': group.chapter }"
            :disabled="!itemIsAvailable(itemDetails)"
            @click="bookmarkClicked(bookmark)"
          >
            <!-- a bookmark only fits the copy it was made on, its provider tells which -->
            <template #prepend>
              <div style="width: 50px">
                <ProviderIcon :domain="providerDomain(bookmark)" :size="20" />
              </div>
            </template>
            <!-- no time: the chapters beside it show durations, not positions -->
            <template #title>
              <div class="d-flex align-center ga-2">
                <Bookmark :size="16" class="bookmark-icon" />
                <span class="text-truncate">{{ bookmark.name }}</span>
                <template v-if="isEditable(bookmark)">
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    :title="$t('rename_bookmark')"
                    @click.stop="renameClicked(bookmark)"
                  >
                    <Pencil :size="16" />
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    :title="$t('delete')"
                    @click.stop="removeClicked(bookmark)"
                  >
                    <Trash2 :size="16" />
                  </v-btn>
                </template>
              </div>
            </template>
            <template v-if="storedOnlyByMusicAssistant(bookmark)" #subtitle>
              {{ $t("bookmark_stored_by_music_assistant") }}
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
import { Bookmark, ChevronDown, ChevronUp, Pencil, Trash2 } from "@lucide/vue";
import BookmarkDialog from "@/components/BookmarkDialog.vue";
import Container from "@/components/Container.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import Toolbar from "@/components/Toolbar.vue";
import { BOOKMARK_FEATURES, groupBookmarksByChapter } from "@/helpers/chapters";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaType,
  type Audiobook,
  type MediaItemBookmark,
  type MediaItemChapter,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface Props {
  itemDetails: Audiobook | PodcastEpisode;
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

const groups = computed(() =>
  groupBookmarksByChapter(
    props.itemDetails.metadata?.chapters,
    bookmarks.value,
  ),
);

const titleKey = computed(() => {
  if (!props.itemDetails.metadata?.chapters?.length) return "bookmarks";
  return bookmarks.value.length ? "chapters_and_bookmarks" : "chapters";
});

const chapterClicked = function (chapter: MediaItemChapter) {
  if (!props.itemDetails || !itemIsAvailable(props.itemDetails)) return;
  // an episode is played on its own, so it starts at a position, not a chapter
  api.playMedia(
    props.itemDetails.uri,
    undefined,
    props.itemDetails.media_type === MediaType.PODCAST_EPISODE
      ? { start_position: chapter.start }
      : { start_item: chapter.position.toString() },
  );
};

const providerDomain = function (bookmark: MediaItemBookmark) {
  return (
    api.providers[bookmark.provider_instance_id]?.domain ??
    bookmark.provider_instance_id
  );
};

const providerSupports = function (
  bookmark: MediaItemBookmark,
  access: "read" | "edit",
) {
  const feature = BOOKMARK_FEATURES[props.itemDetails.media_type]?.[access];
  if (!feature) return false;
  return (
    api.providers[bookmark.provider_instance_id]?.supported_features.includes(
      feature,
    ) ?? false
  );
};

// worth a hint only where the provider keeps bookmarks of its own
const storedOnlyByMusicAssistant = function (bookmark: MediaItemBookmark) {
  return (
    bookmark.stored_by_music_assistant && providerSupports(bookmark, "read")
  );
};

const isEditable = function (bookmark: MediaItemBookmark) {
  return (
    bookmark.stored_by_music_assistant || providerSupports(bookmark, "edit")
  );
};

const loadBookmarks = async function () {
  bookmarks.value = await api.getBookmarks(
    props.itemDetails.media_type,
    props.itemDetails.item_id,
    props.itemDetails.provider,
  );
};

const bookmarkClicked = function (bookmark: MediaItemBookmark) {
  if (!itemIsAvailable(props.itemDetails)) return;
  // play the copy the bookmark was made on, its position may not fit another one
  api.playMedia(
    `${bookmark.provider_instance_id}://${props.itemDetails.media_type}/${bookmark.provider_item_id}`,
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
  await api.setBookmark(
    props.itemDetails.media_type,
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
      await api.removeBookmark(
        props.itemDetails.media_type,
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

<style scoped>
.bookmark--in-chapter {
  padding-left: 40px !important;
}

.bookmark-icon {
  flex: 0 0 auto;
  opacity: 0.6;
}
</style>
