<template>
  <!-- core modules -->
  <div style="margin-bottom: 10px">
    <v-toolbar color="transparent">
      <template #title>{{ $t('settings.core_modules') }} </template>
    </v-toolbar>
    <Container>
      <ListItem
        v-for="item in coreConfigs.sort((a, b) =>
          api.providerManifests[a.domain].name!.localeCompare(api.providerManifests[b.domain].name!),
        )"
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
            labelArgs: [],
            action: () => {
              editCoreConfig(item.domain);
            },
            icon: 'mdi-cog',
          },
          {
            label: 'settings.documentation',
            labelArgs: [],
            action: () => {
              openLinkInNewTab(api.providerManifests[item.domain].documentation!);
            },
            icon: 'mdi-bookshelf',
            disabled: !api.providerManifests[item.domain].documentation,
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
    <v-toolbar color="transparent">
      <template #title>{{ $t('settings.server_info') }} </template>
    </v-toolbar>
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
              <a :href="`${api.baseUrl}/log`" target="_blank">{{ $t('settings.download_log') }}</a>
            </td>
          </tr>
        </tbody>
      </v-table>
    </Container>
  </div>
  <!-- client settings -->
  <div style="margin-bottom: 10px">
    <v-toolbar color="transparent" style="height: 55px">
      <template #title> {{ $t('settings.settings') }} | Client</template>
    </v-toolbar>
    <v-divider />
    <Container style="overflow: hidden">
      <v-table style="overflow: hidden">
        <tbody style="overflow: hidden">
          <tr>
            <td>Enable Discord RPC</td>
            <td>
              <v-switch
                v-model="discordRPCEnabled"
                style="height: 56px"
                label="Restart to apply changes"
                @change="discordRpcConfig"
              />
            </td>
          </tr>
          <tr>
            <td>Start squeezelite</td>
            <td>
              <v-switch
                v-model="squeezeliteEnabled"
                style="height: 56px"
                label="Restart to apply changes"
                @change="squeezeliteConfig"
              />
            </td>
          </tr>
          <tr>
            <td>Theme settings</td>
            <td>
              <v-btn-toggle
                v-model="themeSetting"
                style="width: 100%"
                mandatory
                rounded="lg"
                @update:model-value="themeSettingConfig"
              >
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="system">System</v-btn>
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="light">Light</v-btn>
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="dark">Dark</v-btn>
              </v-btn-toggle>
            </td>
          </tr>
          <tr>
            <td>Check for updates</td>
            <td>
              <v-btn @click="checkForUpdates">Check for updates</v-btn>
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
import { useTheme } from 'vuetify';
import ProviderIcon from '@/components/ProviderIcon.vue';
import ListItem from '@/components/mods/ListItem.vue';
import Container from '@/components/mods/Container.vue';
import { useRouter } from 'vue-router';
import { emit } from '@tauri-apps/api/event';

// global refs
const router = useRouter();

// local refs
const coreConfigs = ref<CoreConfig[]>([]);
const totalLibraryArtists = ref(0);
const totalLibraryAlbums = ref(0);
const totalLibraryTracks = ref(0);
const totalLibraryPlaylists = ref(0);
const totalLibraryRadio = ref(0);
const discordRPCEnabled = ref(false);
const squeezeliteEnabled = ref(false);
const themeSetting = ref('light');

const theme = useTheme();

// methods
const discordRpcConfig = () => {
  localStorage.setItem('discordRPCEnabled', discordRPCEnabled.value.toString());
};

const squeezeliteConfig = () => {
  localStorage.setItem('squeezeliteEnabled', squeezeliteEnabled.value.toString());
};

const themeSettingConfig = () => {
  localStorage.setItem('themeSetting', themeSetting.value);
  if (themeSetting.value == 'dark') {
    theme.global.name.value = 'dark';
  } else if (themeSetting.value == 'light') {
    theme.global.name.value = 'light';
  } else {
    theme.global.name.value = localStorage.getItem('systemTheme') || 'light';
  }
};

const editCoreConfig = function (domain: string) {
  router.push(`/settings/editcore/${domain}`);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};

const checkForUpdates = async () => {
  await emit('tauri://update');
};

onMounted(async () => {
  coreConfigs.value = await api.getCoreConfigs();
  totalLibraryArtists.value = (await api.getLibraryArtists(undefined, undefined, 1)).total || 0;
  totalLibraryAlbums.value = (await api.getLibraryAlbums(undefined, undefined, 1)).total || 0;
  totalLibraryTracks.value = (await api.getLibraryTracks(undefined, undefined, 1)).total || 0;
  totalLibraryPlaylists.value = (await api.getLibraryPlaylists(undefined, undefined, 1)).total || 0;
  totalLibraryRadio.value = (await api.getLibraryRadios(undefined, undefined, 1)).total || 0;
  discordRPCEnabled.value = localStorage.getItem('discordRPCEnabled') === 'true' || false;
  squeezeliteEnabled.value = localStorage.getItem('squeezeliteEnabled') === 'true' || false;
  themeSetting.value = localStorage.getItem('themeSetting') || 'system';
});
</script>
