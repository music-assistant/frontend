<template>
  <section v-if="titleKey" style="margin-bottom: 10px">
    <Toolbar
      :title="$t(titleKey)"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <v-divider />
    <!-- a single tab says no more than the header -->
    <div v-if="expanded && tabs.length > 1" class="chapter-tabs">
      <Tabs
        :model-value="shownTab"
        @update:model-value="(v) => (activeTab = v as ChapterTab)"
      >
        <TabsList variant="line">
          <TabsTrigger v-for="tab in tabs" :key="tab.id" :value="tab.id">
            {{ $t(tab.labelKey) }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    <Container v-if="expanded">
      <v-list>
        <template v-for="row in rows" :key="row.key">
          <v-list-item
            v-if="row.chapter"
            :disabled="!itemIsAvailable(itemDetails)"
            @click="chapterClicked(row.chapter)"
          >
            <template #prepend>
              <div style="width: 50px">
                <v-chip>
                  {{ row.chapter.position }}
                </v-chip>
              </div>
            </template>
            <template #title>
              <div>{{ row.chapter.name }}</div>
            </template>
            <template #append>
              <span v-if="row.chapter.end" class="text-caption"
                >{{ formatDuration(row.chapter.end - row.chapter.start) }}
              </span>
            </template>
          </v-list-item>
          <v-list-item
            v-else-if="row.bookmark"
            :class="{ 'bookmark--in-chapter': row.inChapter }"
            :disabled="!itemIsAvailable(itemDetails)"
            @click="bookmarkClicked(row.bookmark)"
          >
            <!-- where the bookmark is kept: its provider, or Music Assistant -->
            <template #prepend>
              <div style="width: 50px">
                <img
                  v-if="row.bookmark.stored_by_music_assistant"
                  src="@/assets/icon.svg"
                  alt="Music Assistant"
                  title="Music Assistant"
                  width="20"
                  height="20"
                />
                <ProviderIcon
                  v-else
                  :domain="providerDomain(row.bookmark)"
                  :size="20"
                />
              </div>
            </template>
            <template #title>
              <div class="d-flex align-center ga-2">
                <span class="text-truncate">{{ row.bookmark.name }}</span>
                <template v-if="isEditable(row.bookmark)">
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    :title="$t('rename_bookmark')"
                    @click.stop="renameClicked(row.bookmark)"
                  >
                    <Pencil :size="16" />
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    :title="$t('delete')"
                    @click.stop="removeClicked(row.bookmark)"
                  >
                    <Trash2 :size="16" />
                  </v-btn>
                </template>
              </div>
            </template>
            <!-- a position only where no chapter durations share the column -->
            <template v-if="shownTab === 'bookmarks'" #append>
              <span class="text-caption">{{
                formatDuration(row.bookmark.start)
              }}</span>
            </template>
          </v-list-item>
        </template>
      </v-list>
    </Container>
    <BookmarkDialog
      v-model:open="renameDialogOpen"
      :title="$t('rename_bookmark')"
      :initial-name="renamedBookmark?.name ?? ''"
      :stored-in="renamedBookmark ? storeName(renamedBookmark) : ''"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { providerEditsBookmarks } from "@/helpers/bookmarks";
import { groupBookmarksByChapter } from "@/helpers/chapters";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaType,
  type Audiobook,
  type MediaItemBookmark,
  type MediaItemChapter,
  type PodcastEpisode,
  EventType,
  type BookmarksUpdate,
  type EventMessage,
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

type ChapterTab = "chapters" | "bookmarks" | "all";

// a tab per kind the item has, and the combined one when it has both
const tabs = computed(() => {
  const hasChapters = !!props.itemDetails.metadata?.chapters?.length;
  const hasBookmarks = bookmarks.value.length > 0;
  const result: { id: ChapterTab; labelKey: string }[] = [];
  if (hasChapters) result.push({ id: "chapters", labelKey: "chapters" });
  if (hasBookmarks) result.push({ id: "bookmarks", labelKey: "bookmarks" });
  if (hasChapters && hasBookmarks) {
    result.push({ id: "all", labelKey: "chapters_and_bookmarks_tab" });
  }
  return result;
});

// a single kind names the list after itself, both kinds after the two of them
const titleKey = computed(() =>
  tabs.value.length > 1 ? "chapters_and_bookmarks" : tabs.value[0]?.labelKey,
);

const activeTab = ref<ChapterTab>("chapters");

// the picked tab while the item has it, the first one otherwise
const shownTab = computed(() =>
  tabs.value.some((x) => x.id === activeTab.value)
    ? activeTab.value
    : tabs.value[0]?.id,
);

interface ChapterRow {
  key: string;
  chapter?: MediaItemChapter;
  bookmark?: MediaItemBookmark;
  inChapter?: boolean;
}

const bookmarkKey = (bookmark: MediaItemBookmark) =>
  `${bookmark.provider_instance_id}-${bookmark.provider_item_id}-${bookmark.start}`;

const rows = computed<ChapterRow[]>(() => {
  const tab = shownTab.value;
  if (tab === "chapters") {
    return (props.itemDetails.metadata?.chapters ?? []).map((chapter) => ({
      key: `chapter-${chapter.position}`,
      chapter,
    }));
  }
  if (tab === "bookmarks") {
    return [...bookmarks.value]
      .sort((a, b) => a.start - b.start)
      .map((bookmark) => ({ key: bookmarkKey(bookmark), bookmark }));
  }
  // each chapter is followed by the bookmarks inside it
  return groupBookmarksByChapter(
    props.itemDetails.metadata?.chapters,
    bookmarks.value,
  ).flatMap((group) => [
    ...(group.chapter
      ? [{ key: `chapter-${group.chapter.position}`, chapter: group.chapter }]
      : []),
    ...group.bookmarks.map((bookmark) => ({
      key: bookmarkKey(bookmark),
      bookmark,
      inChapter: !!group.chapter,
    })),
  ]);
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

const storeName = function (bookmark: MediaItemBookmark) {
  return bookmark.stored_by_music_assistant
    ? "Music Assistant"
    : (api.providers[bookmark.provider_instance_id]?.name ??
        bookmark.provider_instance_id);
};

const isEditable = (bookmark: MediaItemBookmark) =>
  bookmark.stored_by_music_assistant ||
  providerEditsBookmarks(
    bookmark.provider_instance_id,
    props.itemDetails.media_type,
  );

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
    },
  });
};

watch(
  () => props.itemDetails.uri,
  () => loadBookmarks(),
  { immediate: true },
);

// a change made here, in the player or on another device, to any copy of the item
onMounted(() => {
  const unsub = api.subscribe(
    EventType.BOOKMARKS_UPDATED,
    (evt: EventMessage) => {
      const update = evt.data as BookmarksUpdate;
      const item = props.itemDetails;
      if (
        update.media_type === item.media_type &&
        ((update.provider_instance_id === item.provider &&
          update.provider_item_id === item.item_id) ||
          item.provider_mappings.some(
            (x) =>
              x.provider_instance === update.provider_instance_id &&
              x.item_id === update.provider_item_id,
          ))
      ) {
        loadBookmarks();
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>

<style scoped>
.bookmark--in-chapter {
  padding-left: 40px !important;
}

/* as the tabs of the item listings */
.chapter-tabs {
  padding: 10px 16px 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
