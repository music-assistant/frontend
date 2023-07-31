<template>
  <section>
    <v-toolbar variant="flat" color="transparent" style="height: 50px">
      <template #title>
        {{ $t('browse') }}
        <span v-if="browseItem && browseItem.provider != 'library'"> | {{ getBrowseFolderName(browseItem, $t) }}</span>
        <v-badge v-if="browseItem?.items" color="grey" :content="browseItem?.items.length" inline />
      </template>
    </v-toolbar>
    <v-divider />
    <Container>
      <!-- loading animation -->
      <v-progress-linear v-if="loading" indeterminate />
      <!-- back button -->
      <v-btn v-if="props.path" variant="plain" icon="mdi-arrow-left"
        :to="{ name: 'browse', query: { path: backPath } }" />

      <v-virtual-scroll :height="66" :items="browseItem?.items || []" style="height:100%">
        <template v-slot:default="{ item }">
          <ListviewItem :item="item" :show-library="false" :show-menu="false" :show-provider="false" :is-selected="false"
            @click="onClick" />
        </template>
      </v-virtual-scroll>
    </Container>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ListviewItem from '../components/ListviewItem.vue';
import { MediaType, type BrowseFolder, type MediaItemType } from '../plugins/api/interfaces';
import { useRouter } from 'vue-router';
import { getBrowseFolderName } from '@/helpers/utils';
import api from '../plugins/api';
import Container from '@/components/mods/Container.vue';

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
    const backPath = props.path.substring(0, props.path.lastIndexOf('/') + 1);
    if (backPath.endsWith('://')) {
      return '';
    }
    return backPath;
  }
  return '';
});

const loadData = async function () {
  loading.value = true;
  browseItem.value = await api.browse(props.path);
  loading.value = false;
};

onMounted(() => {
  loadData();
});

watch(
  () => props.path,
  () => {
    loadData();
  },
);

const onClick = function (mediaItem: MediaItemType) {
  if (mediaItem.media_type === MediaType.FOLDER) {
    router.push({
      name: 'browse',
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
