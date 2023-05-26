<template>
  <v-app-bar :elevation="0" class="main-app-bar">
    <template #prepend>
      <v-menu location="bottom end">
        <template #activator="{ props }">
          <ButtonIcon v-bind="props" @click="store.showNavigationMenu = !store.showNavigationMenu">
            <v-icon> mdi-playlist-play </v-icon>
          </ButtonIcon>
        </template>
      </v-menu>
    </template>

    <v-app-bar-title class="main-app-bar-content">
      <h1>{{ heading.subTitle }}</h1>
    </v-app-bar-title>

    <template #append>
      <!-- eslint-disable vue/no-template-shadow -->
      <div>
        <v-tooltip location="top end" origin="end center">
          <template #activator="{ props: tooltip }">
            <v-progress-circular
              v-if="api.syncTasks.value.length > 0 || api.fetchesInProgress.value.length > 0"
              indeterminate
              v-bind="tooltip"
            />
          </template>
          <span v-if="api.syncTasks.value.length > 0">{{ $t('sync_running') }}</span>
          <span v-else>{{ $t('loading') }}</span>
        </v-tooltip>
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <ButtonIcon
              v-if="store.topBarContextMenuItems.length > 0"
              style="height: 50px; height: 38px !important;margin-right: -14px;"
              v-bind="props"
            >
              <v-icon icon="mdi-dots-vertical" />
            </ButtonIcon>
          </template>
          <v-list>
            <ListItem
              v-for="(item, index) in store.topBarContextMenuItems"
              :key="index"
              :title="$t(item.label, item.labelArgs)"
              @click="item.action ? item.action() : ''"
            >
              <template #prepend>
                <v-avatar :icon="item.icon" />
              </template>
            </ListItem>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '@/plugins/store';
import { api } from '@/plugins/api';
import { useI18n } from 'vue-i18n';
import ButtonIcon from '@/components/ButtonIcon.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import { ref } from 'vue';
import ListItem from '@/components/ListItem.vue';

const router = useRouter();
const { t } = useI18n();

interface Heading {
  mainTitle: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  mainLink?: Function;
  subTitle?: string;
}

const heading = computed<Heading>(() => {
  // we create a (two level only) breadcrumb in the title/header
  // based on the route and loaded item

  if (router.currentRoute.value.name == 'home') {
    // home
    return {
      mainTitle: t('mass'),
      subTitle: t('home'),
    };
  }
  if (router.currentRoute.value.path.includes('settings')) {
    // home
    return {
      mainTitle: t('mass'),
      subTitle: t('settings.settings'),
    };
  }

  if (router.currentRoute.value.name != 'home' && !store.topBarTitle) {
    // root page, like settings, albums, artists etc.
    return {
      mainTitle: t('mass'),
      mainLink: () => {
        router.push({ name: 'home' });
      },
      subTitle: t(router.currentRoute.value.name!.toString()),
    };
  }
  if (router.currentRoute.value.name != 'home' && store.topBarTitle) {
    // item details from root level (e.g. artists --> artist)
    if (prevRoute.value && router.currentRoute.value.path.includes(prevRoute.value.path)) {
      // previous route exists, prefer that for the breadcrumb link
      // to keep history like scroll position
      return {
        mainTitle: t(prevRoute.value.name.replace('home', 'mass')),
        mainLink: () => {
          backButton();
        },
        subTitle: store.topBarTitle,
      };
    }
    // extract parent from path
    const parent = router.currentRoute.value.path.split('/')[1];
    return {
      mainTitle: t(parent),
      mainLink: () => {
        router.push(`/${parent}`);
      },
      subTitle: store.topBarTitle,
    };
  }
  if (router.currentRoute.value) {
    return {
      mainTitle: t(router.currentRoute.value.name!.toString()),
    };
  }
  return {
    // fallback if everything else fails...
    mainTitle: t('mass'),
  };
});

const prevRoute = computed(() => {
  if (store.prevRoutes.length > 0) {
    const prev = store.prevRoutes[store.prevRoutes.length - 1];
    return prev;
  }
  return undefined;
});

const backButton = function () {
  const prevRoute = store.prevRoutes.pop();
  if (prevRoute) {
    prevRoute.params['backnav'] = 'true';
    router.replace(prevRoute).then(() => {
      setTimeout(() => {
        window.scrollTo(0, prevRoute.meta.scrollPos || 0);
      }, 400);
    });
  }
};
</script>

<style>
.main-app-bar {
  height: 80px;
  padding-left: 0;
  padding-right: 0;
  background: linear-gradient(rgb(var(--v-theme-surface)) 73.79%, rgba(var(--v-theme-surface), 0) 96%) !important;
}

.search-text-input {
  align-items: center;
  padding: 10px 10px 10px 12px;
}

.main-app-bar > div.v-toolbar__content {
  height: 55px !important;
}

.main-app-bar > div > div.v-toolbar__append {
  flex: none;
}
</style>
