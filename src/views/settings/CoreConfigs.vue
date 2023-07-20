<template>
  <Container>
    <v-card style="margin-bottom: 10px">
      <v-toolbar color="transparent" :title="$t('settings.core_modules')" style="height: 55px"> </v-toolbar>
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
          @click="editCoreConfig(item.domain)"
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
    </v-card>
  </Container>
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
console.log(coreConfigs);

// methods
const editCoreConfig = function (domain: string) {
  router.push(`/settings/editcore/${domain}`);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};

onMounted(async () => {
  coreConfigs.value = await api.getCoreConfigs();
});
</script>
