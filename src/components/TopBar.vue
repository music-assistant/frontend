<template>
  <v-app-bar
    :class="isMobile() ? 'v-mobile-toolbar' : 'v-toolbar'"
    :color="isMobile() ? undefined : 'primary'"
    elevation="0"
  >
    <template #prepend>
      <v-app-bar-nav-icon
        v-if="
          store.prevRoutes.length > 0 && router.currentRoute.value.path != '/' && router.currentRoute.value.path != '/settings' && router.currentRoute.value.path != '/search'
        "
        :icon="mdiArrowLeft"
        @click="backButton"
      ></v-app-bar-nav-icon>

      <v-app-bar-nav-icon
        v-if="
          ($vuetify.display.width <= 870 || store.alwaysShowMenuButton) &&
          store.prevRoutes.length === 0
        "
        @click="toggleHAMenu"
      ></v-app-bar-nav-icon>
    </template>
    <v-toolbar-title :class="'line-clamp-1'">
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-html="
          truncateString(
            store.topBarTitle || '',
            $vuetify.display.mobile ? 25 : 150
          )
        "
      />
      <!-- eslint-enable vue/no-v-html -->
    </v-toolbar-title>
    <template #append>
      <div style="align-items: right; display: flex">
        <v-menu v-model="dialog" dark :close-on-content-click="false">
          <template #activator="{ props: menu }">
            <v-tooltip location="top end" origin="end center">
              <template #activator="{ props: tooltip }">
                <v-btn
                  v-if="jobsInProgress.length > 0 && store.showBackgroundJobs"
                  icon
                >
                  <v-progress-circular
                    indeterminate
                    v-bind="mergeProps(menu, tooltip)"
                  />
                </v-btn>
              </template>
              <span>{{ $t('jobs_running', [jobsInProgress.length]) }}</span>
            </v-tooltip>
          </template>
          <v-card min-width="300">
            <v-toolbar color="primary" dark>
              <v-icon style="margin-left: 16px" :icon="mdiReload" />
              <v-toolbar-title :text="$t('jobs')" />
            </v-toolbar>
            <v-list>
              <v-list-item
                v-for="(item, index) in api.jobs.value"
                :key="index"
                :title="item.name"
              >
                <template #prepend>
                  <v-avatar :icon="getJobStatusIcon(item.status)" />
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>

        <v-btn v-if="!isPhone()" icon @click="router.push('/search/')">
          <v-icon :icon="mdiMagnify" />
        </v-btn>

        <v-btn
          v-if="!isPhone() && store.showSettings"
          icon
          @click="router.push('/settings/')"
        >
          <v-icon :icon="mdiCogOutline" />
        </v-btn>

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-if="store.topBarContextMenuItems.length > 0"
              v-bind="props"
              icon
            >
              <v-icon :icon="mdiDotsVertical" />
            </v-btn>
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
    <template
      v-if="
        $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1 ||
        store.showTabsNav
      "
      #extension
    >
      <v-sheet v-if="isMobile()" :max-width="$vuetify.display.width">
        <v-slide-group class="chip-slider">
          <v-slide-group-item
            v-for="tab in tabs.filter((word) => {
              if (isPhone()) {
                return word.label != 'home';
              } else {
                return ' ';
              }
            })"
            :key="tab.label"
          >
            <v-chip
              class="ma-1"
              :value="tab.label"
              color="primary"
              variant="outlined"
              @click="$router.push(tab.path)"
            >
              {{ $t(tab.label) }}
            </v-chip>
          </v-slide-group-item>
        </v-slide-group>
      </v-sheet>
      <v-tabs
        v-else-if="!isMobile()"
        show-arrows
        align-tabs="center"
        style="width: 100%"
      >
        <v-tab v-for="tab in tabs" :key="tab.label" :to="tab.path">{{
          $t(tab.label)
        }}</v-tab>
      </v-tabs>
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import {
  mdiArrowLeft,
  mdiDotsVertical,
  mdiProgressClock,
  mdiCancel,
  mdiCheckOutline,
  mdiAlertCircle,
  mdiReload,
  mdiCogOutline,
  mdiMagnify,
} from '@mdi/js';

import { computed, mergeProps, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, JobStatus } from '../plugins/api';
import { store } from '../plugins/store';
import {
  getResponsiveBreakpoints,
  truncateString,
  isMobile,
  isPhone,
} from '../utils';

const router = useRouter();
const dialog = ref(false);

const jobsInProgress = computed(() => {
  return api.jobs.value.filter((x) =>
    [JobStatus.PENDING, JobStatus.RUNNING].includes(x.status)
  );
});

const toggleHAMenu = function () {
  // toggle HA sidebar
  const root = window.parent.document
    .querySelector('home-assistant')
    .shadowRoot.querySelector('home-assistant-main');
  const evt = new Event('hass-toggle-menu', {});
  root.dispatchEvent(evt);
};

const backButton = function () {
  if (store.prevRoutes.length === 0) {
    toggleHAMenu();
  }

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

const tabs = ref([
  {
    label: 'home',
    path: '/',
  },
  {
    label: 'artists',
    path: '/artists',
  },
  {
    label: 'albums',
    path: '/albums',
  },
  {
    label: 'tracks',
    path: '/tracks',
  },
  {
    label: 'playlists',
    path: '/playlists',
  },
  {
    label: 'radios',
    path: '/radios',
  },
  {
    label: 'browse',
    path: '/browse',
  },
]);

const getJobStatusIcon = function (status: JobStatus) {
  if (status == JobStatus.PENDING) return mdiProgressClock;
  if (status == JobStatus.CANCELLED) return mdiCancel;
  if (status == JobStatus.FINISHED) return mdiCheckOutline;
  if (status == JobStatus.ERROR) return mdiAlertCircle;
  return mdiReload;
};
</script>

<style>
.padded-overlay .v-overlay__content {
  padding: 50px;
}

.v-overlay__scrim {
  opacity: 65%;
}

.v-toolbar__content {
  height: var(--header-height, 56px) !important;
}

.v-mobile-toolbar {
  width: calc(100% - 0px) !important;
  padding: 0px 10px 5px 10px !important;
}

.v-mobile-toolbar > .v-toolbar__content {
  --v-theme-overlay-multiplier: var(--v-theme-primary-overlay-multiplier);
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  top: 5px;
  margin-bottom: 5px;
  border-radius: 4px;
  width: calc((100% - 0px) - 0px) !important;
}

.chip-slider {
  padding-left: 0px !important;
  padding-right: 0px !important;
}

.v-sheet {
  background: rgb(
    var(--primary-background-color, var(--v-theme-surface))
  ) !important;
  width: calc((100% - 0px) - 0px) !important;
}
</style>
