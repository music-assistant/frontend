<template>
  <section>
    <div
      style="
        padding-left: 15px;
        padding-right: 15px;
        padding-top: 5px;
        padding-bottom: 20px;
      "
    >
      <!-- loading animation -->
      <v-progress-linear
        v-if="loading"
        indeterminate
      />

      <!-- back button -->
      <v-btn
        v-if="props.path"
        variant="plain"
        icon="mdi-arrow-left"
        :to="{ name: 'browse', query: { path: backPath } }"
      />

      <RecycleScroller
        v-slot="{ item }"
        :items="browseItem?.items || []"
        :item-size="66"
        key-field="uri"
        page-mode
      >
        <ListviewItem
          :item="item"
          :show-library="false"
          :show-menu="false"
          :show-providers="false"
          :is-selected="false"
          @click="onClick"
        />
      </RecycleScroller>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { RecycleScroller } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import ListviewItem from "../components/ListviewItem.vue";
import {
  MediaType,
  type BrowseFolder,
  type MediaItemType,
} from "../plugins/api/interfaces";
import { store } from "../plugins/store";
import { useRouter } from "vue-router";
import { getBrowseFolderName } from "../utils";
import api from "../plugins/api";

export interface Props {
  path?: string;
}
const props = defineProps<Props>();

const { t } = useI18n();
const router = useRouter();

const browseItem = ref<BrowseFolder>();
const loading = ref(false);

const backPath = computed(() => {
  if (props.path) {
    const backPath = props.path.substring(0, props.path.lastIndexOf("/") + 1);
    if (backPath.endsWith('://')) {
      return "";
    }
    return backPath;
  }
  return "";
});

const loadData = async function () {
  loading.value = true;
  browseItem.value = await api.browse(props.path);

  // set header title to browse title
  if (!browseItem.value || !props.path) {
    store.topBarTitle = undefined;
  } else {
    store.topBarTitle = getBrowseFolderName(browseItem.value, t);
  }
  loading.value = false;
};

onMounted(() => {
  loadData();
});

watch(
  () => props.path,
  () => {
    loadData();
  }
);

const onClick = function (mediaItem: MediaItemType) {
  if (mediaItem.media_type === MediaType.FOLDER) {
    router.push({
      name: "browse",
      query: { path: (mediaItem as BrowseFolder).path },
    });
  } else {
    router.push({
      name: mediaItem.media_type,
      params: { itemId: mediaItem.item_id, provider: mediaItem.provider },
    });
  }
};
</script>
