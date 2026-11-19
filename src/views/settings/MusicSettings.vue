<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="music" />
    <SettingsPageLinks section="music" />
    <CommunityMovedTypeNotice :type="ProviderType.MUSIC" />
    <ProviderList :type="ProviderType.MUSIC" />
  </div>
</template>

<script setup lang="ts">
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import { ProviderType } from "@/plugins/api/interfaces";

/**
 * The Music hub: the tiles leading to the pages below it and the music sources.
 */
</script>
