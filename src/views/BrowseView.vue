<template>
  <section>
    <ItemsListing
      itemtype="browse"
      :show-provider="false"
      :show-library="false"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :show-select-button="!isRoot && !hasOnlyFolders"
      :load-items="loadItems"
      :sort-keys="['original', 'name', 'name_desc']"
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
          <DetailHeroPlayButton
            class="min-w-0"
            shrink-label
            :item="currentFolder"
          />
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
import api from "@/plugins/api";
import { MediaItemType, MediaType } from "@/plugins/api/interfaces";
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

  // a browse path reads as "<provider>://<folder>/<folder>", where the provider
  // prefix is a level of its own that lists that provider's top-level folders
  const [providerPart, folderPart] = path.includes("://")
    ? path.split("://")
    : ["", path];
  const prefix = providerPart ? `${providerPart}://` : "";
  const folders = folderPart.split("/").filter((folder) => folder.length > 0);

  const items: ToolbarHeadingItem[] = [];
  if (providerPart) {
    items.push({
      title: api.getProviderName(providerPart),
      disabled: folders.length === 0,
      to: browseRoute(prefix),
    });
  }
  folders.forEach((folder, index) => {
    items.push({
      title: folder,
      disabled: index === folders.length - 1,
      to: browseRoute(prefix + folders.slice(0, index + 1).join("/")),
    });
  });
  return items;
});

watch(
  () => props.path,
  async (path) => {
    currentFolder.value = undefined;
    if (isRoot.value || !path) return;
    // opened without passing through the parent listing (a reload or a link)
    const folder = knownFolders.get(path) ?? (await findInParentListing(path));
    // the user may have moved on while the parent listing loaded
    if (path === props.path) currentFolder.value = folder;
  },
  { immediate: true },
);

const loadItems = async function (params: LoadDataParams) {
  const items: Array<MediaItemType> = await api.browse(
    props.path,
    store.activePlayerId,
  );
  rememberFolders(items);
  hasOnlyFolders.value = items.every(
    (item) => item.media_type === MediaType.FOLDER,
  );
  return items;
};

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
      await api.browse(parentBrowsePath(path), store.activePlayerId, {
        suppressGlobalError: true,
      }),
    );
  } catch {
    return undefined;
  }
  return knownFolders.get(path);
}

function parentBrowsePath(path: string): string {
  const separatorIndex = path.indexOf("://");
  const prefixLength = separatorIndex < 0 ? 0 : separatorIndex + 3;
  const subPath = path.slice(prefixLength);
  // a provider's own level is listed at the browse root
  if (!subPath) return "root";
  return (
    path.slice(0, prefixLength) + subPath.split("/").slice(0, -1).join("/")
  );
}
</script>
