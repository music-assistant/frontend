<template>
  <section class="flex min-h-full flex-col">
    <ItemsListing
      :key="path || 'root'"
      fill-height
      itemtype="browse"
      :show-provider="false"
      :show-library="false"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :show-select-button="!isRoot && !hasOnlyFolders"
      :sort-listing="ListingType.BROWSE"
      :load-paged-data="loadItems"
      :path="path"
      :allow-key-hooks="true"
      :icon="Folder"
    >
      <template #title>
        <ToolbarHeading
          :title="t('browse')"
          :to="isRoot ? undefined : { name: 'browse' }"
          :items="breadcrumbItems"
        />
      </template>
      <template v-if="currentFolder?.is_playable" #header>
        <div class="flex items-center gap-2 px-4 py-3">
          <DetailHeroPlayButton :item="currentFolder" />
          <Button
            variant="outline"
            :disabled="!store.activePlayer"
            @click="api.playMedia(currentFolder, undefined, { shuffle: true })"
          >
            <Shuffle />
            {{ t("shuffle") }}
          </Button>
        </div>
      </template>
    </ItemsListing>
  </section>
</template>

<script lang="ts">
import type { BrowseFolder } from "@/plugins/api/interfaces";

// the folders listed so far, by path: a folder's own details (whether it can be
// played) only come with the listing of its parent
const knownFolders = new Map<string, BrowseFolder>();
</script>

<script setup lang="ts">
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import ToolbarHeading, {
  type ToolbarHeadingItem,
} from "@/components/ToolbarHeading.vue";
import { Button } from "@/components/ui/button";
import {
  browsePathLevels,
  parentBrowsePath,
  type BrowsePathLevel,
} from "@/helpers/browse_path";
import api from "@/plugins/api";
import {
  ListingType,
  MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Folder, Shuffle } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

export interface Props {
  path?: string;
}

const props = defineProps<Props>();
const { t } = useI18n();
const hasOnlyFolders = ref(false);
const currentFolder = ref<BrowseFolder>();

const isRoot = computed(() => !props.path || props.path === "root");

const breadcrumbItems = computed((): ToolbarHeadingItem[] => {
  const path = props.path;
  if (isRoot.value || !path) return [];

  const levels = browsePathLevels(path);
  return levels.map((level, index) => ({
    title: levelTitle(level),
    disabled: index === levels.length - 1,
    to: browseRoute(level.path),
  }));
});

// only a Discover row is looked up by name; every other level shows the path
// segment it came from, as before
function levelTitle(level: BrowsePathLevel): string {
  if (level.kind === "scheme") return t("discover");
  if (level.kind === "provider") return api.getProviderName(level.segment);
  if (level.kind === "row") return folderName(level.path) ?? level.segment;
  return level.segment;
}

watch(
  () => props.path,
  async (path) => {
    currentFolder.value = undefined;
    hasOnlyFolders.value = false;
    if (isRoot.value || !path) return;
    // opened without passing through the parent listing (a reload or a link)
    const folder = knownFolders.get(path) ?? (await findInParentListing(path));
    // the user may have moved on while the parent listing loaded
    if (path === props.path) currentFolder.value = folder;
  },
  { immediate: true },
);

const loadItems = async function (params: LoadDataParams) {
  const path = props.path;
  const items: Array<MediaItemType> = await api.browse(
    path,
    store.activePlayerId,
    undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
  );
  if (path !== props.path) return items;
  rememberFolders(items);
  const pageHasOnlyFolders = items.every(
    (item) => item.media_type === MediaType.FOLDER,
  );
  hasOnlyFolders.value =
    params.offset === 0
      ? pageHasOnlyFolders
      : hasOnlyFolders.value && pageHasOnlyFolders;
  return items;
};

// the name of a folder listed so far; reads the current folder reactively so
// the breadcrumbs pick up its name once a deep link has looked it up
const folderName = (path: string): string | undefined =>
  currentFolder.value?.path === path
    ? currentFolder.value.name
    : knownFolders.get(path)?.name;

const browseRoute = (path: string) => ({
  name: "browse",
  query: { path },
});

function rememberFolders(items: MediaItemType[]) {
  for (const item of items) {
    // the ".." entry carries the parent's path but none of its details
    if (item.media_type !== MediaType.FOLDER || item.name === "..") continue;
    const folder = item as BrowseFolder;
    knownFolders.set(folder.path, folder);
  }
}

async function findInParentListing(
  path: string,
): Promise<BrowseFolder | undefined> {
  try {
    rememberFolders(
      await api.browse(
        parentBrowsePath(path),
        store.activePlayerId,
        { suppressGlobalError: true },
        undefined,
        0,
      ),
    );
  } catch {
    return undefined;
  }
  return knownFolders.get(path);
}
</script>
