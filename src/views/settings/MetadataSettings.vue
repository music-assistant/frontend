<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="metadata" />
    <CommunityMovedTypeNotice :type="ProviderType.METADATA" />
    <ProviderList :type="ProviderType.METADATA" />
    <SettingsPageForm page="metadata" />
  </div>
</template>

<script setup lang="ts">
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { ProviderType } from "@/plugins/api/interfaces";

/**
 * The metadata on one page: the metadata sources, and below them the settings
 * of the metadata.
 */
</script>
