<template>
  <v-bottom-navigation
    :height="height"
    grow
    elevation="15"
    style="border-top: 1px solid #20202035"
    role="navigation"
  >
    <!-- Full menu for larger screens -->
    <template v-if="getBreakpointValue('tablet')">
      <v-btn
        v-for="menuItem of menuItems"
        :key="menuItem.label"
        :to="menuItem.path"
        :aria-label="$t(menuItem.label)"
        tabindex="0"
      >
        <v-icon size="xx-large">{{ menuItem.icon }}</v-icon>
        <span class="menuButton">{{ $t(menuItem.label) }}</span>
      </v-btn>

      <!-- Shortcuts Menu -->
      <v-menu v-if="shortcuts.length > 0">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            aria-haspopup="true"
            aria-label="Open shortcuts menu"
          >
            <v-icon size="xx-large">mdi-bookmark-multiple</v-icon>
            <span class="menuButton">{{ $t("shortcuts") }}</span>
          </v-btn>
        </template>

        <v-list>
          <template v-for="type in mediaTypes" :key="type">
            <v-list-subheader v-if="getShortcutsByType(type).length > 0">
              {{ $t(type.toLowerCase()) }}
            </v-list-subheader>
            <v-list-item
              v-for="shortcut in getShortcutsByType(type)"
              :key="shortcut.id"
              @click="handleShortcutClick(shortcut)"
            >
              <template #prepend>
                <MediaItemThumb
                  :item="shortcut"
                  :size="32"
                  :rounded="true"
                  :thumbnail="true"
                />
              </template>
              <template #title>
                <span class="shortcut-title">{{ shortcut.name }}</span>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-menu>
    </template>

    <!-- Compact menu for smaller screens -->
    <template v-else>
      <v-btn
        v-for="menuItem of menuItems.filter((x) => !x.isLibraryNode)"
        :key="menuItem.label"
        :to="menuItem.path"
        :aria-label="$t(menuItem.label)"
        tabindex="0"
      >
        <v-icon size="xx-large">{{ menuItem.icon }}</v-icon>
        <span class="menuButton">{{ $t(menuItem.label) }}</span>
      </v-btn>

      <!-- Library Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            aria-haspopup="true"
            :aria-expanded="isLibraryOpen.toString()"
            aria-label="Open library menu"
          >
            <v-icon size="xx-large">mdi-bookshelf</v-icon>
            <span class="menuButton">{{ $t("library") }}</span>
          </v-btn>
        </template>

        <v-list>
          <v-list-item
            v-for="menuItem of menuItems.filter((x) => x.isLibraryNode)"
            :key="menuItem.label"
            :title="$t(menuItem.label)"
            :prepend-icon="menuItem.icon"
            :to="menuItem.path"
          />
        </v-list>
      </v-menu>

      <!-- Shortcuts Menu -->
      <v-menu v-if="shortcuts.length > 0">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            aria-haspopup="true"
            :aria-expanded="isShortcutsOpen.toString()"
            aria-label="Open shortcuts menu"
          >
            <v-icon size="xx-large">mdi-bookmark-multiple</v-icon>
            <span class="menuButton">{{ $t("shortcuts") }}</span>
          </v-btn>
        </template>

        <v-list>
          <template v-for="type in mediaTypes" :key="type">
            <v-list-subheader v-if="getShortcutsByType(type).length > 0">
              {{ $t(type.toLowerCase()) }}
            </v-list-subheader>
            <v-list-item
              v-for="shortcut in getShortcutsByType(type)"
              :key="shortcut.id"
              @click="handleShortcutClick(shortcut)"
            >
              <template #prepend>
                <MediaItemThumb
                  :item="shortcut"
                  :size="32"
                  :rounded="true"
                  :thumbnail="true"
                />
              </template>
              <template #title>
                <span class="shortcut-title">{{ shortcut.name }}</span>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-menu>
    </template>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getMenuItems } from "./DrawerNavigation.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store, AlertType } from "@/plugins/store";
import { shortcuts, type Shortcut } from "@/helpers/shortcuts";
import { MediaType, QueueOption } from "@/plugins/api/interfaces";
import api, { ConnectionState } from "@/plugins/api";
import router from "@/plugins/router";
import MediaItemThumb from "@/components/MediaItemThumb.vue";

export interface Props {
  height: number;
}
defineProps<Props>();

const menuItems = getMenuItems();

const isLibraryOpen = ref(false);
const isShortcutsOpen = ref(false);

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

// thumbnails are handled by MediaItemThumb with built-in fallbacks

const handleShortcutClick = async (shortcut: Shortcut) => {
  try {
    if (shortcut.itemType === MediaType.TRACK) {
      // Check if we have an active player
      if (!store.activePlayer) {
        store.activeAlert = {
          type: AlertType.WARNING,
          message: "Please select a player first",
          persistent: false
        };
        return;
      }

      // Check connection
      if (api.state.value !== ConnectionState.CONNECTED) {
        store.activeAlert = {
          type: AlertType.ERROR,
          message: "Not connected to server",
          persistent: false
        };
        return;
      }

      // Play the track
      await api.playMedia([shortcut.uri], QueueOption.PLAY);
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
    isShortcutsOpen.value = false;
  } catch (error) {
    console.error('Error handling shortcut click:', error);
    store.activeAlert = {
      type: AlertType.ERROR,
      message: "Failed to play track. Please try again.",
      persistent: false
    };
  }
};
</script>

<style scoped>
.menuButton {
  font-weight: 350;
  font-size: x-small;
  font-stretch: condensed;
  text-transform: none;
  margin-top: 5px;
}

.v-btn--active {
  color: rgb(var(--v-theme-accent));
}

.v-slide-group-item--active {
  opacity: 100%;
}

.shortcut-title {
  margin-left: 6px;
  max-width: 220px;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
