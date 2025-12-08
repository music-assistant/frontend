<template>
  <Container>
    <!-- Version Information Section -->
    <v-card class="mb-4" elevation="0" variant="flat">
      <v-card-title class="text-subtitle-1 font-weight-bold py-3">
        <v-icon icon="mdi-information-outline" class="mr-2" />
        {{ $t("settings.version_info") }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0">
        <v-list class="py-0" bg-color="transparent">
          <v-list-item class="info-list-item">
            <v-list-item-title class="info-label">
              {{ $t("settings.server_version") }}
            </v-list-item-title>
            <template #append>
              <span class="info-value">
                {{ api.serverInfo.value?.server_version }}
              </span>
            </template>
          </v-list-item>
          <v-divider v-if="!api.serverInfo.value?.homeassistant_addon" />
          <v-list-item
            v-if="!api.serverInfo.value?.homeassistant_addon"
            class="info-list-item"
          >
            <v-list-item-title class="info-label">
              {{ $t("settings.server_base_url") }}
            </v-list-item-title>
            <template #append>
              <span class="info-value">
                {{ api.serverInfo.value?.base_url }}
              </span>
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item class="info-list-item">
            <v-list-item-title class="info-label">
              {{ $t("settings.server_as_addon") }}
            </v-list-item-title>
            <template #append>
              <v-chip
                :color="
                  api.serverInfo.value?.homeassistant_addon
                    ? 'success'
                    : 'default'
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
                  api.serverInfo.value?.homeassistant_addon
                    ? $t("yes")
                    : $t("no")
                }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Open Home Foundation Section -->
    <v-card
      href="https://www.openhomefoundation.org/"
      target="_blank"
      class="foundation-card mb-4"
      elevation="0"
      variant="flat"
    >
      <v-card-text class="text-center py-6">
        <div class="foundation-text text-subtitle-1 mb-4">
          {{ $t("settings.proud_part_of") }}
        </div>
        <div class="foundation-logo">
          <img
            :src="openHomeFoundationLogo"
            alt="Open Home Foundation"
            class="foundation-img"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- Library Statistics Section -->
    <v-card class="mb-4" elevation="0" variant="flat">
      <v-card-title class="text-subtitle-1 font-weight-bold py-3">
        <v-icon icon="mdi-music-box-multiple" class="mr-2" />
        {{ $t("settings.library_stats") }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0">
        <v-list class="py-0" bg-color="transparent">
          <v-list-item class="info-list-item">
            <v-list-item-title class="info-label">
              {{ $t("settings.artists_in_library") }}
            </v-list-item-title>
            <template #append>
              <span class="info-value">
                {{ (store.libraryArtistsCount || 0).toLocaleString() }}
              </span>
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item class="info-list-item">
            <v-list-item-title class="info-label">
              {{ $t("settings.albums_in_library") }}
            </v-list-item-title>
            <template #append>
              <span class="info-value">
                {{ (store.libraryAlbumsCount || 0).toLocaleString() }}
              </span>
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item class="info-list-item">
            <v-list-item-title class="info-label">
              {{ $t("settings.tracks_in_library") }}
            </v-list-item-title>
            <template #append>
              <span class="info-value">
                {{ (store.libraryTracksCount || 0).toLocaleString() }}
              </span>
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item class="info-list-item">
            <v-list-item-title class="info-label">
              {{ $t("settings.playlists_in_library") }}
            </v-list-item-title>
            <template #append>
              <span class="info-value">
                {{ (store.libraryPlaylistsCount || 0).toLocaleString() }}
              </span>
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item class="info-list-item">
            <v-list-item-title class="info-label">
              {{ $t("settings.radio_in_library") }}
            </v-list-item-title>
            <template #append>
              <span class="info-value">
                {{ (store.libraryRadiosCount || 0).toLocaleString() }}
              </span>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Links Section -->
    <v-card class="mb-4" elevation="0" variant="flat">
      <v-card-title class="text-subtitle-1 font-weight-bold py-3">
        <v-icon icon="mdi-link-variant" class="mr-2" />
        {{ $t("settings.links") }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0">
        <v-list class="py-0" bg-color="transparent">
          <v-list-item
            :href="changelogUrl"
            target="_blank"
            link
            class="link-item"
          >
            <template #prepend>
              <v-avatar color="blue-grey-lighten-4" size="36">
                <v-icon
                  icon="mdi-text-box-outline"
                  color="blue-grey-darken-2"
                  size="small"
                />
              </v-avatar>
            </template>
            <v-list-item-title>{{
              $t("settings.changelog")
            }}</v-list-item-title>
            <template #append>
              <v-icon icon="mdi-open-in-new" size="small" />
            </template>
          </v-list-item>
          <v-divider />

          <v-list-item
            :href="documentationUrl"
            target="_blank"
            link
            class="link-item"
          >
            <template #prepend>
              <v-avatar color="indigo-lighten-4" size="36">
                <v-icon
                  icon="mdi-bookshelf"
                  color="indigo-darken-2"
                  size="small"
                />
              </v-avatar>
            </template>
            <v-list-item-title>{{
              $t("settings.documentation")
            }}</v-list-item-title>
            <template #append>
              <v-icon icon="mdi-open-in-new" size="small" />
            </template>
          </v-list-item>
          <v-divider />

          <v-list-item
            v-if="apiDocsUrl"
            :href="apiDocsUrl"
            target="_blank"
            link
            class="link-item"
          >
            <template #prepend>
              <v-avatar color="teal-lighten-4" size="36">
                <v-icon icon="mdi-api" color="teal-darken-2" size="small" />
              </v-avatar>
            </template>
            <v-list-item-title>{{ $t("settings.api_docs") }}</v-list-item-title>
            <template #append>
              <v-icon icon="mdi-open-in-new" size="small" />
            </template>
          </v-list-item>
          <v-divider />

          <v-list-item
            href="https://github.com/orgs/music-assistant/discussions/categories/feature-requests-and-ideas"
            target="_blank"
            link
            class="link-item"
          >
            <template #prepend>
              <v-avatar color="amber-lighten-4" size="36">
                <v-icon
                  icon="mdi-lightbulb-outline"
                  color="amber-darken-3"
                  size="small"
                />
              </v-avatar>
            </template>
            <v-list-item-title>{{
              $t("settings.feature_requests")
            }}</v-list-item-title>
            <template #append>
              <v-icon icon="mdi-open-in-new" size="small" />
            </template>
          </v-list-item>
          <v-divider />

          <v-list-item
            href="https://github.com/music-assistant/support"
            target="_blank"
            link
            class="link-item"
          >
            <template #prepend>
              <v-avatar color="red-lighten-4" size="36">
                <v-icon icon="mdi-bug" color="red-darken-2" size="small" />
              </v-avatar>
            </template>
            <v-list-item-title>{{
              $t("settings.bug_reports")
            }}</v-list-item-title>
            <template #append>
              <v-icon icon="mdi-open-in-new" size="small" />
            </template>
          </v-list-item>
          <v-divider />

          <v-list-item
            href="https://github.com/orgs/music-assistant/discussions"
            target="_blank"
            link
            class="link-item"
          >
            <template #prepend>
              <v-avatar color="purple-lighten-4" size="36">
                <v-icon icon="mdi-forum" color="purple-darken-2" size="small" />
              </v-avatar>
            </template>
            <v-list-item-title>{{
              $t("settings.discussion_forums")
            }}</v-list-item-title>
            <template #append>
              <v-icon icon="mdi-open-in-new" size="small" />
            </template>
          </v-list-item>
          <v-divider />

          <v-list-item
            href="https://github.com/music-assistant/server/blob/dev/LICENSE"
            target="_blank"
            link
            class="link-item"
          >
            <template #prepend>
              <v-avatar color="green-lighten-4" size="36">
                <v-icon
                  icon="mdi-license"
                  color="green-darken-2"
                  size="small"
                />
              </v-avatar>
            </template>
            <v-list-item-title>{{ $t("settings.license") }}</v-list-item-title>
            <template #append>
              <v-icon icon="mdi-open-in-new" size="small" />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </Container>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed, onMounted } from "vue";
import openHomeFoundationLogo from "@/assets/open-home-foundation-logo.svg";

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
