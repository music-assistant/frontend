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
      <div v-if="false" style="max-height: 38px">
        <div
          class="search-text-input"
          style="display: inline-flex; vertical-align: middle; min-width: 250px; max-height: 30px"
        >
          <v-text-field
            density="compact"
            variant="underlined"
            :label="$t('search')"
            append-inner-icon="mdi-magnify"
            hide-details
          ></v-text-field>
        </div>
        <v-tooltip location="bottom" close-on-content-click>
          <template #activator="{ props }">
            <ButtonIcon v-bind="props">
              <v-icon icon="mdi-heart-outline" />
            </ButtonIcon>
          </template>
          <span>None</span>
        </v-tooltip>
        <v-tooltip location="bottom" close-on-content-click>
          <template #activator="{ props }">
            <ButtonIcon v-bind="props">
              <v-icon icon="mdi-account-outline" />
            </ButtonIcon>
          </template>
          <span>None</span>
        </v-tooltip>
        <v-tooltip location="bottom" close-on-content-click>
          <template #activator="{ props }">
            <ButtonIcon v-bind="props">
              <v-icon icon="mdi-refresh" />
            </ButtonIcon>
          </template>
          <span>None</span>
        </v-tooltip>
        <v-tooltip location="bottom" close-on-content-click>
          <template #activator="{ props }">
            <ButtonIcon v-bind="props">
              <v-icon icon="mdi-sort" />
            </ButtonIcon>
          </template>
          <span>None</span>
        </v-tooltip>
        <v-tooltip location="bottom" close-on-content-click>
          <template #activator="{ props }">
            <ButtonIcon v-bind="props">
              <v-icon icon="mdi-grid" />
            </ButtonIcon>
          </template>
          <span>None</span>
        </v-tooltip>
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
              style="height: 50px; height: 38px !important"
              v-bind="props"
            >
              <v-icon icon="mdi-dots-vertical" />
            </ButtonIcon>
          </template>

          <v-list>
            <v-list-item
              v-for="(item, index) in store.topBarContextMenuItems"
              :key="index"
              :title="$t(item.label, item.labelArgs)"
              @click="item.action ? item.action() : ''"
            >
              <template #prepend>
                <v-avatar :icon="item.icon" />
              </template>
            </v-list-item>
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
.padded-overlay .v-overlay__content {
  padding: 50px;
}
.v-overlay__scrim {
  opacity: 65%;
}
div.v-toolbar__append {
  /* align appbar contextmenu as far right as possible, in line with listitems */
  margin-inline-end: 2px;
}
.main-app-bar {
  height: 80px;
  padding-left: 0;
  padding-right: 0;
  background: linear-gradient(rgb(var(--v-theme-surface)) 73.79%, rgba(var(--v-theme-surface), 0) 96%) !important;
}

.main-app-bar > div {
  align-items: start;
  padding-top: 10px;
}

.search-text-input {
  align-items: center;
  padding: 10px 10px 10px 12px;
}

.main-app-bar > div > div.v-toolbar__prepend {
  height: 38px !important;
}
</style>
