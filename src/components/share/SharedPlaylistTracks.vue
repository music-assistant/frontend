<template>
  <ItemsListing
    itemtype="sharedtracks"
    class="px-4 pt-3 max-md:px-1 max-md:pt-2 [&>.v-divider]:hidden"
    :title="$t('tracks')"
    :load-paged-data="loadPage"
    :show-provider="false"
    :show-provider-filter="false"
    :show-library-only-filter="false"
    :show-favorites-only-filter="false"
    :show-search-button="false"
    :show-refresh-button="false"
    :show-select-button="false"
    forced-view-mode="list"
    track-table
  >
    <template #title>
      <span class="text-[22px] font-bold max-md:text-[19px]">{{
        $t("tracks")
      }}</span>
    </template>
  </ItemsListing>
</template>

<script setup lang="ts">
import ItemsListing from "@/components/ItemsListing.vue";
import type { LoadDataParams } from "@/composables/useItemsListing";
import api from "@/plugins/api";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const props = defineProps<{ payload: string }>();

async function loadPage(params: LoadDataParams): Promise<MediaItemType[]> {
  return api.previewSharedPlaylist(props.payload, params.offset, params.limit);
}
</script>
