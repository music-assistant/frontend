<template>
  <!-- the library badge copies the item's library URI when clicked -->
  <button
    v-if="domain === 'library'"
    type="button"
    class="item-source-badge inline-flex flex-none items-center justify-center hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :title="$t('in_library')"
    :aria-label="$t('in_library')"
    @click="copyUri"
  >
    <ProviderIcon domain="library" :size="size" />
  </button>
  <span
    v-else-if="!libraryOnly"
    class="item-source-badge inline-flex flex-none items-center justify-center"
    role="img"
    :title="providerName"
    :aria-label="providerName"
  >
    <ProviderIcon :domain="domain" :size="size" />
  </span>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { getProviderIconDomain } from "@/plugins/api/helpers";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import { toast } from "vue-sonner";

export interface Props {
  item: MediaItemType;
  size: number;
  // show nothing for an item outside the library, where its sources are listed elsewhere
  libraryOnly?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  libraryOnly: false,
});

const domain = computed(() => getProviderIconDomain(props.item));

const providerName = computed(
  () => api.getProviderManifest(domain.value)?.name ?? domain.value,
);

const copyUri = async function () {
  // a provider item that was just liked shows as in the library before the page
  // swaps in the library item
  const libraryItem =
    props.item.provider === "library"
      ? props.item
      : await api.getLibraryItem(
          props.item.media_type,
          props.item.item_id,
          props.item.provider,
        );
  if (libraryItem && (await copyToClipboard(libraryItem.uri))) {
    toast.success($t("uri_copied"));
  } else {
    toast.error($t("uri_copy_failed"));
  }
};
</script>
