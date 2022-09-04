<template>
  <v-app-bar
    :color="store.topBarColor"
    elevation="0"
    :height="store.topBarHeight"
  >
    <template #prepend>
      <v-app-bar-nav-icon
        v-if="
          store.prevRoutes.length > 0 && router.currentRoute.value.path != '/'
        "
        :icon="mdiArrowLeft"
        :color="store.topBarTextColor"
        @click="backButton"
      ></v-app-bar-nav-icon>

      <v-app-bar-nav-icon
        v-if="
          ($vuetify.display.mobile || store.alwaysShowMenuButton) &&
          store.prevRoutes.length === 0
        "
        :color="store.topBarTextColor"
        @click="toggleHAMenu"
      ></v-app-bar-nav-icon>
    </template>

    <v-toolbar-title
      :class="'line-clamp-1'"
      :style="`color: ${store.topBarTextColor}`"
      v-html="truncateString(store.topBarTitle || '', 70)"
    />
    <template #append>
      <div style="align-items: right; display: flex">
        <v-menu v-model="dialog" dark :close-on-content-click="false">
          <template #activator="{ props: menu }">
            <v-tooltip location="top end" origin="end center">
              <template #activator="{ props: tooltip }">
                <v-btn v-if="jobsInProgress.length > 0" icon>
                  <v-progress-circular
                    indeterminate
                    :color="store.topBarTextColor"
                    v-bind="mergeProps(menu, tooltip)"
                  />
                </v-btn>
              </template>
              <span>{{ $t('jobs_running', [jobsInProgress.length]) }}</span>
            </v-tooltip>
          </template>
          <v-card min-width="300">
            <v-toolbar dark :color="store.topBarColor">
              <v-icon
                :color="store.topBarTextColor"
                style="margin-left: 16px"
                :icon="mdiReload"
              />
              <v-toolbar-title
                :style="`color: ${store.topBarTextColor}`"
                :text="$t('jobs')"
              />
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

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-if="store.topBarContextMenuItems.length > 0" icon>
              <v-icon
                :color="store.topBarTextColor"
                :icon="mdiDotsVertical"
                v-bind="props"
              />
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
    <template #extension>
      <v-tabs
        v-model="tabs"
        :background-color="store.topBarColor"
        :style="`color: ${store.topBarTextColor} !important`"
        dark
        show-arrows
        centered
        style="width: 100%"
      >
        <v-tab to="/">Home</v-tab>
        <v-tab to="/artists">Artists</v-tab>
        <v-tab to="/albums">Albums</v-tab>
        <v-tab to="/tracks">Tracks</v-tab>
        <v-tab to="/playlists">Playlists</v-tab>
        <v-tab to="/radios">Radio</v-tab>
        <v-tab to="/browse">Browse</v-tab>
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
  mdiClose,
  mdiMenu,
} from '@mdi/js';

import { computed, mergeProps, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../plugins/api';
import { JobStatus } from '../plugins/api';
import { store } from '../plugins/store';
import { truncateString } from '../utils';

const router = useRouter();
const dialog = ref(false);
const tabs = ref(null);

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
</style>
