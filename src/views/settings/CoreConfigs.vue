<template>
  <!-- core modules -->
  <div style="margin-bottom: 10px">
    <v-toolbar color="transparent" :title="$t('settings.core_modules')" style="height: 55px" />
    <v-divider />
    <Container>
      <ListItem
        v-for="item in coreConfigs.sort((a, b) => api.providerManifests[a.domain].name!.localeCompare(api.providerManifests[b.domain].name!))"
        :key="item.domain"
        v-hold="
          () => {
            editCoreConfig(item.domain);
          }
        "
        class="list-item-main"
        link
        :context-menu-items="[
            {
              label: 'settings.configure',
              labelArgs:[],
              action: () => {
                editCoreConfig(item.domain);
              },
              icon: 'mdi-cog',
            },
            {
              label: 'settings.documentation',
              labelArgs:[],
              action: () => {
                openLinkInNewTab(api.providerManifests[item.domain].documentation!);
              },
              icon: 'mdi-bookshelf',
              disabled: !api.providerManifests[item.domain].documentation
            },
          ]"
        @click="editCoreConfig(item.domain)"
      >
        <template #prepend>
          <provider-icon :domain="item.domain" :size="40" class="listitem-media-thumb" style="margin-left: 10px" />
        </template>

        <!-- title -->
        <template #title>
          <div class="line-clamp-1">{{ api.providerManifests[item.domain].name }}</div>
        </template>

        <!-- subtitle -->
        <template #subtitle
          ><div class="line-clamp-1">{{ api.providerManifests[item.domain].description }}</div>
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
    <v-toolbar color="transparent" :title="$t('settings.server_info')" style="height: 55px" />
    <v-divider />
    <Container>
      <v-table>
        <tbody>
          <tr>
            <td>{{ $t('settings.server_id') }}</td>
            <td>{{ api.serverInfo.value?.server_id }}</td>
          </tr>
          <tr>
            <td>{{ $t('settings.server_version') }}</td>
            <td>{{ api.serverInfo.value?.server_version }}</td>
          </tr>
          <tr v-if="!api.serverInfo.value?.homeassistant_addon">
            <td>{{ $t('settings.server_base_url') }}</td>
            <td>{{ api.serverInfo.value?.base_url }}</td>
          </tr>
          <tr>
            <td>{{ $t('settings.server_as_addon') }}</td>
            <td><v-icon :icon="api.serverInfo.value?.homeassistant_addon ? 'mdi-check' : 'mdi-close'" /></td>
          </tr>
          <tr>
            <td>{{ $t('settings.artists_in_library') }}</td>
            <td>{{ totalLibraryArtists }}</td>
          </tr>
          <tr>
            <td>{{ $t('settings.albums_in_library') }}</td>
            <td>{{ totalLibraryAlbums }}</td>
          </tr>
          <tr>
            <td>{{ $t('settings.tracks_in_library') }}</td>
            <td>{{ totalLibraryTracks }}</td>
          </tr>
          <tr>
            <td>{{ $t('settings.playlists_in_library') }}</td>
            <td>{{ totalLibraryPlaylists }}</td>
          </tr>
          <tr>
            <td>{{ $t('settings.radio_in_library') }}</td>
            <td>{{ totalLibraryRadio }}</td>
          </tr>
          <tr>
            <td>{{ $t('settings.server_logging') }}</td>
            <td>
              <a href="/log" target="_blank">{{ $t('settings.download_log') }}</a>
            </td>
          </tr>
        </tbody>
      </v-table>
    </Container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/plugins/api';
import { CoreConfig } from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import ListItem from '@/components/mods/ListItem.vue';
import Container from '@/components/mods/Container.vue';
import { useRouter } from 'vue-router';

// global refs
const router = useRouter();

// local refs
const coreConfigs = ref<CoreConfig[]>([]);
const totalLibraryArtists = ref(0);
const totalLibraryAlbums = ref(0);
const totalLibraryTracks = ref(0);
const totalLibraryPlaylists = ref(0);
const totalLibraryRadio = ref(0);

// methods
const editCoreConfig = function (domain: string) {
  router.push(`/settings/editcore/${domain}`);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};

onMounted(async () => {
  coreConfigs.value = await api.getCoreConfigs();
  totalLibraryArtists.value = (await api.getLibraryArtists(undefined, undefined, 1)).total || 0;
  totalLibraryAlbums.value = (await api.getLibraryAlbums(undefined, undefined, 1)).total || 0;
  totalLibraryTracks.value = (await api.getLibraryTracks(undefined, undefined, 1)).total || 0;
  totalLibraryPlaylists.value = (await api.getLibraryPlaylists(undefined, undefined, 1)).total || 0;
  totalLibraryRadio.value = (await api.getLibraryRadios(undefined, undefined, 1)).total || 0;
});
</script>
