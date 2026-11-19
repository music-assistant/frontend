<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsHubHeader name="music" />
    <SettingsPageLinks section="music" />
    <CommunityMovedTypeNotice :types="listTypes" />
    <ProviderLists :types="listTypes" />
  </div>
</template>

<script setup lang="ts">
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderLists from "@/components/settings/providers/ProviderLists.vue";
import SettingsHubHeader from "@/components/settings/SettingsHubHeader.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import { managesAllSources } from "@/helpers/provider_permissions";
import { pageProviderLists } from "@/helpers/settings_sections";
import { ProviderType } from "@/plugins/api/interfaces";
import { computed } from "vue";

/**
 * The Music hub: the tiles leading to the pages below it, the music sources and
 * the audio sources.
 */

// a member only lists its music sources
const listTypes = computed(() =>
  managesAllSources()
    ? pageProviderLists(ProviderType.MUSIC)
    : [ProviderType.MUSIC],
);
</script>
