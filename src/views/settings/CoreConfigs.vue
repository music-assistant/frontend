<template>
  <!-- core modules -->
  <div style="margin-bottom: 10px">
    <v-toolbar color="transparent">
      <template #title>{{ $t("settings.core_modules") }} </template>
    </v-toolbar>
    <Container>
      <ListItem
        v-for="item in coreConfigs.sort((a, b) =>
          api.providerManifests[a.domain].name!.localeCompare(
            api.providerManifests[b.domain].name!,
          ),
        )"
        :key="item.domain"
        show-menu-btn
        class="list-item-main"
        link
        @menu="(evt: Event) => onMenu(evt, item)"
        @click="editCoreConfig(item.domain)"
      >
        <template #prepend>
          <provider-icon
            :domain="item.domain"
            :size="40"
            class="listitem-media-thumb"
            style="margin-left: 10px"
          />
        </template>

        <!-- title -->
        <template #title>
          <div class="line-clamp-1">
            {{ api.providerManifests[item.domain].name }}
          </div>
        </template>

        <!-- subtitle -->
        <template #subtitle
          ><div class="line-clamp-1">
            {{ api.providerManifests[item.domain].description }}
          </div>
        </template>

        <!-- actions -->
        <template #append>
          <Button v-if="item.last_error" icon :title="item.last_error">
            <v-icon color="red"> mdi-alert-circle </v-icon>
          </Button>
        </template>
      </ListItem>
    </Container>
  </div>
  <!-- server information -->
  <div style="margin-bottom: 10px">
    <v-toolbar color="transparent">
      <template #title>{{ $t("settings.server_info") }} </template>
    </v-toolbar>
    <Container>
      <v-table>
        <tbody>
          <tr>
            <td>{{ $t("settings.server_id") }}</td>
            <td>{{ api.serverInfo.value?.server_id }}</td>
          </tr>
          <tr>
            <td>{{ $t("settings.server_version") }}</td>
            <td>{{ api.serverInfo.value?.server_version }}</td>
          </tr>
          <tr v-if="!api.serverInfo.value?.homeassistant_addon">
            <td>{{ $t("settings.server_base_url") }}</td>
            <td>{{ api.serverInfo.value?.base_url }}</td>
          </tr>
          <tr>
            <td>{{ $t("settings.server_as_addon") }}</td>
            <td>
              <v-icon
                :icon="
                  api.serverInfo.value?.homeassistant_addon
                    ? 'mdi-check'
                    : 'mdi-close'
                "
              />
            </td>
          </tr>
          <tr>
            <td>{{ $t("settings.artists_in_library") }}</td>
            <td>{{ store.libraryArtistsCount }}</td>
          </tr>
          <tr>
            <td>{{ $t("settings.albums_in_library") }}</td>
            <td>{{ store.libraryAlbumsCount }}</td>
          </tr>
          <tr>
            <td>{{ $t("settings.tracks_in_library") }}</td>
            <td>{{ store.libraryTracksCount }}</td>
          </tr>
          <tr>
            <td>{{ $t("settings.playlists_in_library") }}</td>
            <td>{{ store.libraryPlaylistsCount }}</td>
          </tr>
          <tr>
            <td>{{ $t("settings.radio_in_library") }}</td>
            <td>{{ store.libraryRadiosCount }}</td>
          </tr>
          <tr>
            <td>{{ $t("settings.server_logging") }}</td>
            <td>
              <a :href="`${api.baseUrl}/music-assistant.log`" target="_blank">{{
                $t("settings.download_log")
              }}</a>
            </td>
          </tr>
        </tbody>
      </v-table>
    </Container>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { CoreConfig } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();

// local refs
const coreConfigs = ref<CoreConfig[]>([]);

// methods
const editCoreConfig = function (domain: string) {
  router.push(`/settings/editcore/${domain}`);
};

const onMenu = function (evt: Event, item: CoreConfig) {
  const menuItems = [
    {
      label: "settings.configure",
      labelArgs: [],
      action: () => {
        editCoreConfig(item.domain);
      },
      icon: "mdi-cog",
    },
    {
      label: "settings.documentation",
      labelArgs: [],
      action: () => {
        openLinkInNewTab(api.providerManifests[item.domain].documentation!);
      },
      icon: "mdi-bookshelf",
      disabled: !api.providerManifests[item.domain].documentation,
    },
  ];
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

onMounted(async () => {
  coreConfigs.value = await api.getCoreConfigs();
  // refresh/read the library counts
  store.libraryArtistsCount = await api.getLibraryArtistsCount();
  store.libraryAlbumsCount = await api.getLibraryAlbumsCount();
  store.libraryTracksCount = await api.getLibraryTracksCount();
  store.libraryPlaylistsCount = await api.getLibraryPlaylistsCount();
  store.libraryRadiosCount = await api.getLibraryRadiosCount();
});
</script>
