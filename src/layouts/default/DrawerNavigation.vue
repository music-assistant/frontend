<template>
  <v-navigation-drawer app :rail="!showNavigationMenu" :width="280" permanent>
    <v-list-item style="height: 55px" :active="false">
      <template #prepend>
        <img class="logo_icon" size="40" src="@/assets/icon.png" />
      </template>
      <template #title>
        <div class="logo_text">Music Assistant</div>
      </template>
    </v-list-item>
    <v-divider />

    <!-- menu items -->
    <v-list lines="one" density="compact" nav>
      <v-list-item
        v-for="menuItem of menuItems.filter((item) => !item.hidden)"
        :key="menuItem.path"
        nav
        density="compact"
        :height="15"
        :title="$t(menuItem.label)"
        :prepend-icon="menuItem.icon"
        :to="menuItem.path"
      />
    </v-list>

    <!-- Add divider if there are shortcuts -->
    <v-divider v-if="shortcuts.length > 0" class="my-2" />

    <!-- shortcuts section -->
    <v-list v-if="shortcuts.length > 0" lines="one" density="compact" nav>
    <v-list-subheader v-if="showNavigationMenu" class="font-weight-bold">{{ $t('shortcuts') }}</v-list-subheader>
      <template v-for="type in mediaTypes" :key="type">
        <template v-if="getShortcutsByType(type).length > 0">
          <v-list-subheader v-if="showNavigationMenu" class="text-caption">
            {{ $t(type.toLowerCase()) }}
          </v-list-subheader>
          <v-list-item
            v-for="shortcut in getShortcutsByType(type)"
            :key="shortcut.id"
            nav
            density="compact"
            :height="15"
            :title="showNavigationMenu ? shortcut.name : ''"
            @click="handleShortcutClick(shortcut)"
          >
            <template #prepend>
              <div class="shortcut-thumb">
                <MediaItemThumb
                  :item="shortcut"
                  :size="24"
                  :rounded="true"
                  :thumbnail="true"
                />
              </div>
            </template>
          </v-list-item>
        </template>
      </template>
    </v-list>
    <!-- button at bottom to collapse/expand the navigation drawer-->
    <Button
      nav
      :height="15"
      :width="40"
      style="position: relative; float: right; right: 10px; top: 20px"
      :ripple="false"
      :icon="showNavigationMenu ? 'mdi-chevron-left' : 'mdi-chevron-right'"
      :title="$t('tooltip.show_menu')"
      @click="showNavigationMenu = !showNavigationMenu"
    />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "@/components/mods/Button.vue";
import { store } from "@/plugins/store";
import { shortcuts, type Shortcut } from "@/helpers/shortcuts";
import { DEFAULT_MENU_ITEMS } from "@/constants";
import { MediaType } from "@/plugins/api/interfaces";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import api from "@/plugins/api";
import router from "@/plugins/router";

const showNavigationMenu = ref<boolean>(
  localStorage.getItem("show_navigation_menu") === "true",
);
const menuItems = getMenuItems();

// Define media types for grouping
const mediaTypes = [
  MediaType.TRACK,
  MediaType.ALBUM,
  MediaType.ARTIST,
  MediaType.PLAYLIST,
  MediaType.RADIO,
  MediaType.PODCAST,
  MediaType.AUDIOBOOK
];

// Group shortcuts by media type
const getShortcutsByType = (type: MediaType) => {
  return shortcuts.filter(shortcut => shortcut.itemType === type);
};

const handleShortcutClick = async (shortcut: Shortcut) => {
  if (shortcut.itemType === MediaType.TRACK) {
    // Play the track directly
    await api.playMedia([shortcut.uri]);
  } else {
    // Navigate to item details
    router.push({
      name: shortcut.itemType,
      params: {
        itemId: shortcut.itemId,
        provider: shortcut.provider
      }
    });
  }
};

watch(
  () => showNavigationMenu.value,
  (newVal) => {
    localStorage.setItem("show_navigation_menu", newVal.toString());
  },
);
</script>

<script lang="ts">
export interface MenuItem {
  label: string;
  icon: string;
  path: string;
  isLibraryNode: boolean;
  hidden?: boolean;
}

export const getMenuItems = function () {
  const storedMenuConf = localStorage.getItem("frontend.settings.menu_items");
  const enabledItems: string[] = storedMenuConf
    ? storedMenuConf.split(",")
    : DEFAULT_MENU_ITEMS;
  const items: MenuItem[] = [];
  // we loop through the enabled items list so we can respect the order
  for (const enabledMenuItemStr of enabledItems) {
    if (enabledMenuItemStr === "home") {
      items.push({
        label: "home",
        icon: "mdi-home-outline",
        path: "/home",
        isLibraryNode: false,
      });
    }
    if (enabledMenuItemStr === "search") {
      items.push({
        label: "search",
        icon: "mdi-magnify",
        path: "/search",
        isLibraryNode: false,
      });
    }
    if (enabledMenuItemStr === "artists") {
      items.push({
        label: "artists",
        icon: "mdi-account-outline",
        path: "/artists",
        isLibraryNode: true,
        hidden: store.libraryArtistsCount === 0,
      });
    }
    if (enabledMenuItemStr === "albums") {
      items.push({
        label: "albums",
        icon: "mdi-album",
        path: "/albums",
        isLibraryNode: true,
        hidden: store.libraryAlbumsCount === 0,
      });
    }
    if (enabledMenuItemStr === "tracks") {
      items.push({
        label: "tracks",
        icon: "mdi-music-note",
        path: "/tracks",
        isLibraryNode: true,
        hidden: store.libraryTracksCount === 0,
      });
    }
    if (enabledMenuItemStr === "playlists") {
      items.push({
        label: "playlists",
        icon: "mdi-playlist-play",
        path: "/playlists",
        isLibraryNode: true,
        hidden: store.libraryPlaylistsCount === 0,
      });
    }
    if (enabledMenuItemStr === "podcasts") {
      items.push({
        label: "podcasts",
        icon: "mdi-podcast",
        path: "/podcasts",
        isLibraryNode: true,
        hidden: store.libraryPodcastsCount === 0,
      });
    }
    if (enabledMenuItemStr === "audiobooks") {
      items.push({
        label: "audiobooks",
        icon: "mdi-book-play-outline",
        path: "/audiobooks",
        isLibraryNode: true,
        hidden: store.libraryAudiobooksCount === 0,
      });
    }
    if (enabledMenuItemStr === "radios") {
      items.push({
        label: "radios",
        icon: "mdi-access-point",
        path: "/radios",
        isLibraryNode: true,
        hidden: store.libraryRadiosCount === 0,
      });
    }
    if (enabledMenuItemStr === "browse") {
      items.push({
        label: "browse",
        icon: "mdi-folder-outline",
        path: "/browse",
        isLibraryNode: true,
      });
    }
    if (enabledMenuItemStr === "settings") {
      items.push({
        label: "settings.settings",
        icon: "mdi-cog-outline",
        path: "/settings",
        isLibraryNode: true,
      });
    }
  }
  return items;
};
</script>

<style scoped>
.logo_text {
  margin-left: 0px;
  font-family: "JetBrains Mono Medium";
  font-size: larger;
  font-weight: 500;
}

.logo_icon {
  margin-left: -8px;
  border-radius: 4px;
  width: 38px;
}

.v-list-item :deep(.v-list-item__prepend) {
  width: 40px;
}

.shortcut-thumb {
  margin-left: 0;
}
</style>
