<template>
  <!-- show section per providertype -->
  <div
    v-for="provType in ProviderType"
    :key="provType"
    style="margin-bottom: 10px"
  >
    <v-toolbar color="transparent" density="compact" class="titlebar">
      <template #title> {{ $t(`settings.${provType}providers`) }} </template>
      <template #append>
        <!-- ADD provider button + contextmenu -->
        <v-menu
          v-if="availableProviders.filter((x) => x.type == provType).length"
          scrim
        >
          <template #activator="{ props }">
            <v-btn v-bind="props" color="accent" variant="outlined">
              {{ $t('settings.add_new_provider_button', [provType]) }}
            </v-btn>
          </template>

          <v-card density="compact">
            <v-list-item
              v-for="provider in availableProviders.filter(
                (x) => x.type == provType,
              )"
              :key="provider.domain"
              style="padding-top: 0; padding-bottom: 0; margin-bottom: 0"
              :title="provider.name"
              @click="addProvider(provider)"
            >
              <template #prepend>
                <provider-icon
                  :domain="provider.domain"
                  :size="26"
                  class="media-thumb"
                  style="margin-left: 10px"
                />
              </template>
            </v-list-item>
          </v-card>
        </v-menu>
      </template>
    </v-toolbar>

    <!-- show alert if no music provider configured-->
    <v-alert
      v-if="
        provType == ProviderType.MUSIC &&
        providerConfigs.filter(
          (x) =>
            x.type == ProviderType.MUSIC &&
            x.domain in api.providerManifests &&
            !api.providerManifests[x.domain].hidden &&
            x.domain !== 'builtin',
        ).length == 0
      "
      border="top"
      border-color="warning"
      style="margin: 20px"
      icon="mdi-alert-box-outline"
    >
      <b>{{ $t('settings.no_music_providers_detail') }}</b>
      <br />
      {{ $t('settings.no_music_providers_detail') }}
    </v-alert>

    <!-- show alert if no player provider configured-->
    <v-alert
      v-if="
        provType == ProviderType.PLAYER &&
        providerConfigs.filter(
          (x) =>
            x.type == ProviderType.PLAYER &&
            x.domain in api.providerManifests &&
            !api.providerManifests[x.domain].hidden,
        ).length == 0
      "
      border="top"
      border-color="warning"
      style="margin: 20px"
      icon="mdi-alert-box-outline"
    >
      <b>{{ $t('settings.no_player_providers_detail') }}</b>
      <br />
      {{ $t('settings.no_player_providers_detail') }}
    </v-alert>

    <Container>
      <ListItem
        v-for="item in providerConfigs.filter((x) => x.type == provType)"
        :key="item.instance_id"
        show-menu-btn
        link
        @menu="(evt: Event) => onMenu(evt, item)"
        @click="editProvider(item.instance_id)"
      >
        <template #prepend>
          <provider-icon
            :domain="item.domain"
            :size="40"
            class="listitem-media-thumb"
          />
        </template>

        <!-- title -->
        <template #title>
          <div class="line-clamp-1">
            {{ item.name || api.providerManifests[item.domain].name }}
          </div>
        </template>

        <!-- subtitle -->
        <template #subtitle>
          <div class="line-clamp-1">
            {{ api.providerManifests[item.domain].description }}
          </div>
        </template>
        <!-- actions -->
        <template #append>
          <!-- sync running -->
          <Button
            v-if="
              api.syncTasks.value.filter(
                (x) => x.provider_instance == item.instance_id,
              ).length > 0
            "
            icon
            :title="$t('settings.sync_running')"
          >
            <v-icon color="grey"> mdi-sync </v-icon>
          </Button>

          <!-- provider disabled -->
          <Button
            v-if="!item.enabled"
            icon
            :title="$t('settings.provider_disabled')"
          >
            <v-icon color="grey"> mdi-cancel </v-icon>
          </Button>

          <!-- provider has errors -->
          <Button v-else-if="item.last_error" icon :title="item.last_error">
            <v-icon color="red"> mdi-alert-circle </v-icon>
          </Button>

          <!-- loading (provider not yet available) -->
          <Button
            v-else-if="!api.providers[item.instance_id]?.available"
            icon
            :title="$t('settings.not_loaded')"
          >
            <v-icon icon="mdi-timer-sand" />
          </Button>
        </template>
      </ListItem>
    </Container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue';
import { api } from '@/plugins/api';
import {
  EventType,
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { useRouter } from 'vue-router';
import Button from '@/components/mods/Button.vue';
import ListItem from '@/components/mods/ListItem.vue';
import Alert from '@/components/mods/Alert.vue';
import Container from '@/components/mods/Container.vue';
import { $t } from '@/plugins/i18n';
import { eventbus } from '@/plugins/eventbus';

// global refs
const router = useRouter();

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);

// computed properties
const availableProviders = computed(() => {
  // providers available for setup
  // filter out hidden providers
  // filter out providers that are already setup (and multi instance not allowed)
  return Object.values(api.providerManifests)
    .filter(
      (x) =>
        !x.hidden &&
        // provider is either multi instance or does not exist at all
        (x.multi_instance ||
          !providerConfigs.value.find((y) => y.domain == x.domain)),
    )
    .sort((a, b) =>
      (a.name || api.providerManifests[a.domain].name).toUpperCase() >
      (b.name || api.providerManifests[b.domain].name).toUpperCase()
        ? 1
        : -1,
    );
});

// listen for item updates to refresh items when that happens
const unsub = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
  loadItems();
});
onBeforeUnmount(unsub);

// methods
const loadItems = async function () {
  providerConfigs.value = await api.getProviderConfigs();
};

const removeProvider = function (providerInstanceId: string) {
  api.removeProviderConfig(providerInstanceId);
  providerConfigs.value = providerConfigs.value.filter(
    (x) => x.instance_id != providerInstanceId,
  );
};

const editProvider = function (providerInstanceId: string) {
  router.push(`/settings/editprovider/${providerInstanceId}`);
};

const addProvider = function (provider: ProviderManifest) {
  if (provider.depends_on) {
    if (!api.getProvider(provider.depends_on)) {
      // this provider depends on another provider that is not yet setup
      const depProvName = api.getProviderName(provider.depends_on);
      if (
        confirm(
          $t('settings.provider_depends_on_confirm', [
            provider.name,
            depProvName,
          ]),
        )
      ) {
        router.push(`/settings/addprovider/${provider.depends_on}`);
      }
      return;
    }
  }
  router.push(`/settings/addprovider/${provider.domain}`);
};

const toggleEnabled = function (config: ProviderConfig) {
  config.enabled = !config.enabled;
  api.saveProviderConfig(
    config.domain,
    {
      enabled: config.enabled,
    },
    config.instance_id,
  );
};

const reloadProvider = function (providerInstanceId: string) {
  api
    .getData('config/providers/reload', {
      instance_id: providerInstanceId,
    })
    .catch((err) => alert(err));
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};

const onMenu = function (evt: Event, item: ProviderConfig) {
  const menuItems = [
    {
      label: 'settings.configure',
      labelArgs: [],
      action: () => {
        editProvider(item.instance_id);
      },
      icon: 'mdi-cog',
    },
    {
      label: item.enabled ? 'settings.disable' : 'settings.enable',
      labelArgs: [],
      action: () => {
        toggleEnabled(item);
      },
      icon: 'mdi-cancel',
      disabled: api.providerManifests[item.domain].builtin,
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
    {
      label: 'settings.sync',
      labelArgs: [],
      action: () => {
        api.startSync(undefined, [item.instance_id]);
      },
      icon: 'mdi-sync',
      hide:
        !api.providers[item.instance_id]?.available ||
        item.type != ProviderType.MUSIC,
    },
    {
      label: 'settings.delete',
      labelArgs: [],
      action: () => {
        removeProvider(item.instance_id);
      },
      icon: 'mdi-delete',
      hide:
        api.providerManifests[item.domain].builtin ||
        (api.providerManifests[item.domain].load_by_default &&
          item.domain == item.instance_id),
    },
    {
      label: 'settings.reload',
      labelArgs: [],
      action: () => {
        reloadProvider(item.instance_id);
      },
      icon: 'mdi-refresh',
    },
  ];
  eventbus.emit('contextmenu', {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

// watchers
watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);
</script>

<style scoped>
.titlebar {
  padding: 10px 10px;
}
.titlebar.v-toolbar {
  height: 55px;
  font-family: 'JetBrains Mono Medium';
}
</style>
