<template>
  <section>
    <ItemsListing
      itemtype="browse"
      :show-provider="false"
      :show-library="false"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :load-items="loadItems"
      :sort-keys="['original', 'name', 'name_desc']"
      :title="header"
      :path="path"
      :allow-key-hooks="true"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type MediaItemType } from '@/plugins/api/interfaces';
import { useRouter } from 'vue-router';
import { getBreakpointValue } from '@/plugins/breakpoint';
import api from '@/plugins/api';
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';

export interface Props {
  path?: string;
}
const props = defineProps<Props>();

const { t } = useI18n();
const router = useRouter();

const header = computed(() => {
  if (!props.path || props.path == 'root') return t('browse');
  if (getBreakpointValue('bp6')) return t('browse') + ' | ' + props.path;
  if (getBreakpointValue('bp3')) return props.path;
  return t('browse');
});

const loadItems = async function (params: LoadDataParams) {
  const browseItems: MediaItemType[] = [];
  await api.browse(props.path, (data: MediaItemType[]) => {
    browseItems.push(...data);
  });
  return browseItems;
};
</script>
