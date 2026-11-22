<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="music" />
    <SettingsPageLinks section="music" />
    <CommunityMovedTypeNotice :type="ProviderType.MUSIC" />
    <ProviderList :type="ProviderType.MUSIC" :inputs="inputs" />
  </div>
</template>

<script setup lang="ts">
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import { getDeviceInputs } from "@/helpers/live_sources";
import { api } from "@/plugins/api";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { computed } from "vue";

/**
 * The Music hub: the tiles leading to the pages below it, the music sources and
 * the inputs of devices.
 */

// an input is listed for whoever can open the settings of its player
const inputs = computed(() =>
  authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE)
    ? getDeviceInputs(api.players)
    : [],
);
</script>
