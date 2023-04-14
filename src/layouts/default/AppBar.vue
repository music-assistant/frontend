<template>
  <v-app-bar
    density="compact"
    style="height: 56px"
    :elevation="2"
  >
    <template #prepend>
      <v-menu location="bottom end">
        <template #activator="{}">
          <v-btn
            icon="mdi-playlist-play"
            variant="plain"
            @click="store.showNavigationMenu = !store.showNavigationMenu"
          > 
            <v-icon>
              mdi-playlist-play
            </v-icon>
          </v-btn>
        </template>
      </v-menu>
    </template>

    <v-app-bar-title>
      <span
        style="cursor: pointer"
        @click="heading.mainLink"
      >{{
        heading.mainTitle
      }}</span>
      <span
        v-if="heading.subTitle"
        style="opacity: 0.5"
      >
        | {{ heading.subTitle }}</span>
    </v-app-bar-title>


    <template #append>
      <div class="listitem-actions">
        <v-tooltip
          location="top end"
          origin="end center"
        >
          <template #activator="{ props: tooltip }">
            <v-progress-circular
              v-if="api.syncTasks.value.length > 0 || api.fetchesInProgress.value.length > 0"
              indeterminate
              v-bind="tooltip"
            />
          </template>
          <span v-if="api.syncTasks.value.length > 0">{{
            $t("sync_running")
          }}</span>
          <span v-else>{{
            $t("loading")
          }}</span>
        </v-tooltip>

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-if="store.topBarContextMenuItems.length > 0"
              icon="mdi-dots-vertical"
              v-bind="props"
              variant="plain"
            />
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
import { computed } from "vue";
import { useRouter } from "vue-router";
import { store } from "@/plugins/store";
import { api } from "@/plugins/api";
import { useI18n } from "vue-i18n";

const router = useRouter();
const { t } = useI18n();

interface Heading {
  mainTitle: string;
  mainLink?: Function;
  subTitle?: string;
}

const heading = computed<Heading>(() => {
  // we create a (two level only) breadcrumb in the title/header
  // based on the route and loaded item

  if (router.currentRoute.value.name == "home") {
    // home
    return {
      mainTitle: t("mass"),
      subTitle: t("home"),
    };
  }
  if (router.currentRoute.value.path.includes("settings")) {
    // home
    return {
      mainTitle: t("mass"),
      subTitle: t("settings.settings"),
    };
  }

  if (router.currentRoute.value.name != "home" && !store.topBarTitle) {
    // root page, like settings, albums, artists etc.
    return {
      mainTitle: t("mass"),
      mainLink: () => {router.push({ name: 'home' })},
      subTitle: t(router.currentRoute.value.name!.toString()),
    };
  }
  if (router.currentRoute.value.name != "home" && store.topBarTitle) {
    // item details from root level (e.g. artists --> artist)
    if (prevRoute.value && router.currentRoute.value.path.includes(prevRoute.value.path)) {
      // previous route exists, prefer that for the breadcrumb link
      // to keep history like scroll position
      return {
        mainTitle: t(prevRoute.value.name.replace('home', 'mass')),
        mainLink: () => {backButton()},
        subTitle: store.topBarTitle,
      };
    }
    // extract parent from path
    const parent = router.currentRoute.value.path.split('/')[1]
    return {
      mainTitle: t(parent),
      mainLink: () => {router.push(`/${parent}`)},
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
    mainTitle: t("mass"),
  };
});

const prevRoute = computed(() => {
  if (store.prevRoutes.length > 0) {
    const prev = store.prevRoutes[store.prevRoutes.length - 1];
    return prev;
  }
  return undefined;
})


const backButton = function () {
  const prevRoute = store.prevRoutes.pop();
  if (prevRoute) {
    prevRoute.params["backnav"] = "true";
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
</style>
