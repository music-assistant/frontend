<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsHubHeader v-if="isSettingsHub(page)" :name="page" />
    <SettingsPageLinks :section="page" />
    <CommunityMovedTypeNotice :types="listTypes" />
    <ProviderLists :types="listTypes" />
  </div>
</template>

<script setup lang="ts">
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderLists from "@/components/settings/providers/ProviderLists.vue";
import SettingsHubHeader from "@/components/settings/SettingsHubHeader.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import {
  isSettingsHub,
  pageProviderLists,
  providerListName,
} from "@/helpers/settings_sections";
import type { ProviderType } from "@/plugins/api/interfaces";
import { computed } from "vue";

/**
 * The page listing the providers of one type, with the tiles leading to the
 * pages below it.
 */
const props = defineProps<{
  type: ProviderType;
}>();

// the key of the page in the settings menu
const page = computed(() => providerListName(props.type));
const listTypes = computed(() => pageProviderLists(props.type));
</script>
