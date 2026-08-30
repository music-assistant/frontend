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
    </ItemsListing>
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import ToolbarHeading, {
  type ToolbarHeadingItem,
} from "@/components/ToolbarHeading.vue";
import api from "@/plugins/api";
import { MediaItemType, MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Folder } from "@lucide/vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

export interface Props {
  path?: string;
}

const props = defineProps<Props>();
const { t } = useI18n();
const hasOnlyFolders = ref(false);

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

const loadItems = async function (params: LoadDataParams) {
  const items: Array<MediaItemType> = await api.browse(
    props.path,
    store.activePlayerId,
  );
  hasOnlyFolders.value = items.every(
    (item) => item.media_type === MediaType.FOLDER,
  );
  return items;
};

const browseRoute = (path: string) => ({
  name: "browse",
  query: { path },
});
</script>
