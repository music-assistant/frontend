<template>
  <v-container class="pa-4 mx-auto" style="max-width: 600px">
    <!-- Version Information Section -->
    <div
      class="text-subtitle-2 font-weight-bold mb-2 ml-1 text-medium-emphasis"
    >
      {{ $t("settings.version_info") }}
    </div>

    <v-list class="bg-transparent pa-0 mb-6">
      <v-list-item class="settings-item py-3 mb-3 rounded-lg border">
        <template #prepend>
          <v-avatar color="primary" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-information-variant" />
          </v-avatar>
        </template>
        <v-list-item-title>{{
          $t("settings.server_version")
        }}</v-list-item-title>
        <template #append>
          <span class="text-body-2 font-weight-medium">
            {{ api.serverInfo.value?.server_version }}
          </span>
        </template>
      </v-list-item>

      <v-list-item
        v-if="!api.serverInfo.value?.homeassistant_addon"
        class="settings-item py-3 mb-3 rounded-lg border"
      >
        <template #prepend>
          <v-avatar color="primary" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-web" />
          </v-avatar>
        </template>
        <v-list-item-title>{{
          $t("settings.server_base_url")
        }}</v-list-item-title>
        <template #append>
          <span class="text-body-2 font-weight-medium">
            {{ api.serverInfo.value?.base_url }}
          </span>
        </template>
      </v-list-item>

      <v-list-item class="settings-item py-3 mb-3 rounded-lg border">
        <template #prepend>
          <v-avatar color="primary" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-home-assistant" />
          </v-avatar>
        </template>
        <v-list-item-title>{{
          $t("settings.server_as_addon")
        }}</v-list-item-title>
        <template #append>
          <v-chip
            :color="
              api.serverInfo.value?.homeassistant_addon ? 'success' : 'default'
            "
            size="small"
            variant="flat"
          >
            <v-icon
              :icon="
                api.serverInfo.value?.homeassistant_addon
                  ? 'mdi-check'
                  : 'mdi-close'
              "
              start
            />
            {{
              api.serverInfo.value?.homeassistant_addon ? $t("yes") : $t("no")
            }}
          </v-chip>
        </template>
      </v-list-item>
    </v-list>

    <!-- Open Home Foundation Section -->
    <div
      class="text-subtitle-2 font-weight-bold mb-2 ml-1 text-medium-emphasis"
    >
      {{ $t("settings.proud_part_of") }}
    </div>
    <v-card
      href="https://www.openhomefoundation.org/"
      target="_blank"
      class="settings-item mb-6 rounded-lg border"
      elevation="0"
    >
      <v-card-text class="text-center py-6">
        <div class="foundation-logo">
          <img
            :src="foundationLogo"
            alt="Open Home Foundation"
            class="foundation-img"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- Library Statistics Section -->
    <div
      class="text-subtitle-2 font-weight-bold mb-2 ml-1 text-medium-emphasis"
    >
      {{ $t("settings.library_stats") }}
    </div>
    <v-list class="bg-transparent pa-0 mb-6">
      <v-list-item class="settings-item py-3 mb-3 rounded-lg border">
        <template #prepend>
          <v-avatar color="purple" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-account-music" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("artists") }}</v-list-item-title>
        <template #append>
          <span class="text-body-2 font-weight-medium">
            {{ (store.libraryArtistsCount || 0).toLocaleString() }}
          </span>
        </template>
      </v-list-item>

      <v-list-item class="settings-item py-3 mb-3 rounded-lg border">
        <template #prepend>
          <v-avatar color="indigo" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-album" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("albums") }}</v-list-item-title>
        <template #append>
          <span class="text-body-2 font-weight-medium">
            {{ (store.libraryAlbumsCount || 0).toLocaleString() }}
          </span>
        </template>
      </v-list-item>

      <v-list-item class="settings-item py-3 mb-3 rounded-lg border">
        <template #prepend>
          <v-avatar color="blue" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-music" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("tracks") }}</v-list-item-title>
        <template #append>
          <span class="text-body-2 font-weight-medium">
            {{ (store.libraryTracksCount || 0).toLocaleString() }}
          </span>
        </template>
      </v-list-item>

      <v-list-item class="settings-item py-3 mb-3 rounded-lg border">
        <template #prepend>
          <v-avatar color="orange" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-playlist-music" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("playlists") }}</v-list-item-title>
        <template #append>
          <span class="text-body-2 font-weight-medium">
            {{ (store.libraryPlaylistsCount || 0).toLocaleString() }}
          </span>
        </template>
      </v-list-item>

      <v-list-item class="settings-item py-3 mb-3 rounded-lg border">
        <template #prepend>
          <v-avatar color="teal" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-radio" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("radios") }}</v-list-item-title>
        <template #append>
          <span class="text-body-2 font-weight-medium">
            {{ (store.libraryRadiosCount || 0).toLocaleString() }}
          </span>
        </template>
      </v-list-item>
    </v-list>

    <!-- Links Section -->
    <div
      class="text-subtitle-2 font-weight-bold mb-2 ml-1 text-medium-emphasis"
    >
      {{ $t("settings.links") }}
    </div>
    <v-list class="bg-transparent pa-0 mb-6">
      <v-list-item
        :href="documentationUrl"
        target="_blank"
        class="settings-item py-3 mb-3 rounded-lg border"
        link
      >
        <template #prepend>
          <v-avatar color="blue-grey" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-book-open-page-variant" />
          </v-avatar>
        </template>
        <v-list-item-title>{{
          $t("settings.documentation")
        }}</v-list-item-title>
        <template #append>
          <v-icon icon="mdi-open-in-new" size="small" color="grey" />
        </template>
      </v-list-item>

      <v-list-item
        :href="changelogUrl"
        target="_blank"
        class="settings-item py-3 mb-3 rounded-lg border"
        link
      >
        <template #prepend>
          <v-avatar color="blue-grey" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-update" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("settings.changelog") }}</v-list-item-title>
        <template #append>
          <v-icon icon="mdi-open-in-new" size="small" color="grey" />
        </template>
      </v-list-item>

      <v-list-item
        v-if="apiDocsUrl"
        :href="apiDocsUrl"
        target="_blank"
        class="settings-item py-3 mb-3 rounded-lg border"
        link
      >
        <template #prepend>
          <v-avatar color="blue-grey" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-api" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("settings.api_docs") }}</v-list-item-title>
        <template #append>
          <v-icon icon="mdi-open-in-new" size="small" color="grey" />
        </template>
      </v-list-item>

      <v-list-item
        href="https://github.com/orgs/music-assistant/discussions/categories/feature-requests-and-ideas"
        target="_blank"
        class="settings-item py-3 mb-3 rounded-lg border"
        link
      >
        <template #prepend>
          <v-avatar color="amber" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-lightbulb-outline" />
          </v-avatar>
        </template>
        <v-list-item-title>{{
          $t("settings.feature_requests")
        }}</v-list-item-title>
        <template #append>
          <v-icon icon="mdi-open-in-new" size="small" color="grey" />
        </template>
      </v-list-item>

      <v-list-item
        href="https://github.com/music-assistant/support"
        target="_blank"
        class="settings-item py-3 mb-3 rounded-lg border"
        link
      >
        <template #prepend>
          <v-avatar color="red" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-bug" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("settings.bug_reports") }}</v-list-item-title>
        <template #append>
          <v-icon icon="mdi-open-in-new" size="small" color="grey" />
        </template>
      </v-list-item>

      <v-list-item
        href="https://github.com/orgs/music-assistant/discussions"
        target="_blank"
        class="settings-item py-3 mb-3 rounded-lg border"
        link
      >
        <template #prepend>
          <v-avatar color="purple" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-forum" />
          </v-avatar>
        </template>
        <v-list-item-title>{{
          $t("settings.discussion_forums")
        }}</v-list-item-title>
        <template #append>
          <v-icon icon="mdi-open-in-new" size="small" color="grey" />
        </template>
      </v-list-item>

      <v-list-item
        href="https://github.com/music-assistant/server/blob/dev/LICENSE"
        target="_blank"
        class="settings-item py-3 mb-3 rounded-lg border"
        link
      >
        <template #prepend>
          <v-avatar color="green" variant="tonal" size="40" class="mr-4">
            <v-icon icon="mdi-license" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ $t("settings.license") }}</v-list-item-title>
        <template #append>
          <v-icon icon="mdi-open-in-new" size="small" color="grey" />
        </template>
      </v-list-item>
    </v-list>
  </v-container>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed, onMounted } from "vue";
import { useTheme } from "vuetify";
import openHomeFoundationLogoWhite from "@/assets/open-home-foundation-white.svg";
import openHomeFoundationLogo from "@/assets/open-home-foundation-logo.svg";

const theme = useTheme();
const foundationLogo = computed(() => {
  return theme.global.current.value.dark
    ? openHomeFoundationLogoWhite
    : openHomeFoundationLogo;
});

const changelogUrl = computed(() => {
  return "https://github.com/music-assistant/server/releases";
});

const documentationUrl = computed(() => {
  const version = api.serverInfo.value?.server_version || "";
  // Check if version contains 'beta' or starts with '0.' for nightly
  if (version.includes("beta") || version.startsWith("0.")) {
    return "https://beta.music-assistant.io";
  }
  return "https://music-assistant.io";
});

const apiDocsUrl = computed(() => {
  const baseUrl = api.serverInfo.value?.base_url || "";
  return `${baseUrl}/api-docs`;
});

onMounted(async () => {
  // Refresh/read the library counts
  store.libraryArtistsCount = await api.getLibraryArtistsCount();
  store.libraryAlbumsCount = await api.getLibraryAlbumsCount();
  store.libraryTracksCount = await api.getLibraryTracksCount();
  store.libraryPlaylistsCount = await api.getLibraryPlaylistsCount();
  store.libraryRadiosCount = await api.getLibraryRadiosCount();
});
</script>

<style scoped>
.settings-item {
  transition: background-color 0.2s ease-in-out;
  background-color: rgb(var(--v-theme-surface));
}

.settings-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.font-monospace {
  font-family: monospace;
  font-size: 0.9em;
}

/* Info list item styling */
.info-list-item {
  min-height: 48px;
}

.info-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.info-value {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.9);
  text-align: right;
  word-break: break-all;
}

/* Make items wrap on mobile */
@media (max-width: 600px) {
  .info-list-item :deep(.v-list-item__content) {
    display: block !important;
  }

  .info-list-item :deep(.v-list-item__append) {
    margin-top: 4px;
    margin-left: 0 !important;
    align-self: flex-start !important;
  }

  .info-value {
    text-align: left;
  }
}

.foundation-card {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.foundation-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
}

.foundation-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 24px;
}

.foundation-img {
  max-width: 400px;
  width: 100%;
  height: auto;
  opacity: 0.9;
  transition: opacity 0.2s ease;
}

.foundation-card:hover .foundation-img {
  opacity: 1;
}

/* Improve avatar colors in dark mode */
@media (prefers-color-scheme: dark) {
  :deep(.v-avatar) {
    opacity: 0.9;
  }
}
</style>
