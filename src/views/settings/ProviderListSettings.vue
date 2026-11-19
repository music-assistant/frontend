<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader :page="page" />
    <SettingsPageLinks :section="page" />
    <CommunityMovedTypeNotice :types="listTypes" />
    <ProviderLists :types="listTypes" />
  </div>
</template>

<script setup lang="ts">
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderLists from "@/components/settings/providers/ProviderLists.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import { providerListName } from "@/helpers/settings_sections";
import type { ProviderType } from "@/plugins/api/interfaces";
import { computed } from "vue";

/**
 * The page listing the providers of one type, with the tiles leading to the
 * pages below it.
 */
const props = defineProps<{
  type: ProviderType;
}>();

// the key of the page in the settings menu, which lists every provider type
const page = computed(() => providerListName(props.type)!);
const listTypes = computed(() => [props.type]);
</script>
