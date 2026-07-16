<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1
          class="inline-flex items-center text-2xl font-semibold tracking-tight"
        >
          <Sparkles class="mr-2 h-5 w-5" />
          {{ $t("providers.ai_radio.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ $t("providers.ai_radio.header.subtitle") }}
        </p>
      </div>
      <Button
        variant="ghost-icon"
        size="icon-sm"
        :disabled="isRefreshing"
        :aria-label="$t('providers.ai_radio.gallery.refresh')"
        @click="handleRefresh"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isRefreshing }" />
      </Button>
    </header>

    <Alert v-if="noAiProviderAlert" variant="warning" class="relative pr-10">
      <TriangleAlert class="h-4 w-4" />
      <AlertTitle>{{ $t("providers.ai_radio.prereq.title") }}</AlertTitle>
      <AlertDescription>
        <p>{{ $t("providers.ai_radio.prereq.description") }}</p>
        <Button
          variant="outline"
          size="sm"
          class="mt-2"
          @click="goToProviderSettings"
        >
          {{ $t("providers.ai_radio.prereq.action") }}
        </Button>
      </AlertDescription>
      <Button
        variant="ghost-icon"
        size="icon-xs"
        class="absolute right-2 top-2"
        :aria-label="$t('close')"
        @click="dismissNoAiProviderAlert"
      >
        <X class="h-3.5 w-3.5" />
      </Button>
    </Alert>

    <div
      v-if="showEmptyState"
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center"
    >
      <Sparkles class="h-10 w-10 text-muted-foreground" />
      <div>
        <h2 class="text-lg font-semibold">
          {{ $t("providers.ai_radio.gallery.empty_title") }}
        </h2>
        <p class="mt-1 max-w-md text-sm text-muted-foreground">
          {{ $t("providers.ai_radio.gallery.empty_description") }}
        </p>
      </div>
      <Button @click="openCreateDialog()">
        <Plus class="mr-1 h-4 w-4" />
        {{ $t("providers.ai_radio.gallery.create_cta") }}
      </Button>
    </div>

    <div
      v-else
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <ShowCard
        v-for="show in shows"
        :key="show.id"
        :show="show"
        @customize="onCustomize"
      />
      <button
        type="button"
        class="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        @click="openCreateDialog()"
      >
        <Plus class="h-8 w-8" />
        <span class="text-sm font-medium">
          {{ $t("providers.ai_radio.gallery.new_show") }}
        </span>
      </button>
    </div>

    <CreateShowDialog
      v-model:open="createDialogOpen"
      :initial-playlist="createDialogInitialPlaylist"
    />
  </section>
</template>

<script setup lang="ts">
import CreateShowDialog from "@/components/ai-radio/CreateShowDialog.vue";
import ShowCard from "@/components/ai-radio/ShowCard.vue";
import type { PlaylistSelection } from "@/components/ai-radio/AiRadioPlaylistPicker.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useShows } from "@/composables/ai-radio/useShows";
import { errorMessage, getQueryValue } from "@/helpers/ai_radio";
import { $t } from "@/plugins/i18n";
import { Plus, RefreshCw, Sparkles, TriangleAlert, X } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

const route = useRoute();
const router = useRouter();

const {
  shows,
  loadingShows,
  loadingSections,
  loadingStatus,
  loadingPlaylists,
  loadShows,
  loadSections,
  loadStatus,
  loadPlaylists,
  startStatusPolling,
  stopStatusPolling,
  noAiProviderAlert,
  dismissNoAiProviderAlert,
} = useShows();

const createDialogOpen = ref(false);
const createDialogInitialPlaylist = ref<PlaylistSelection | undefined>();

const isRefreshing = computed(
  () =>
    loadingShows.value ||
    loadingSections.value ||
    loadingStatus.value ||
    loadingPlaylists.value,
);
const showEmptyState = computed(
  () => !loadingShows.value && shows.value.length === 0,
);

function openCreateDialog(initial?: PlaylistSelection) {
  createDialogInitialPlaylist.value = initial;
  createDialogOpen.value = true;
}

function goToProviderSettings() {
  router.push("/settings/providers?types=plugin");
}

// TODO(task3): open the Customize view for this show instead of a no-op.
function onCustomize(_stationId: string) {}

function applyRouteQuery() {
  const playlistId = getQueryValue(route.query.source_playlist_id);
  const playlistProvider = getQueryValue(route.query.source_playlist_provider);
  const playlistName = getQueryValue(route.query.source_playlist_name);
  if (playlistId && playlistProvider) {
    openCreateDialog({
      itemId: playlistId,
      provider: playlistProvider,
      name: playlistName || playlistId,
    });
    void router.replace({ query: {} });
    return;
  }
  // TODO(task3): a station_id query should open the Customize view for that
  // show; for now it's ignored so navigating here doesn't error out.
}

async function handleRefresh() {
  try {
    await Promise.all([
      loadShows(),
      loadSections(),
      loadStatus(),
      loadPlaylists(),
    ]);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadShows(), loadSections(), loadPlaylists()]);
  } catch (error) {
    toast.error(errorMessage(error));
  }
  startStatusPolling();
  applyRouteQuery();
});

watch(() => route.query, applyRouteQuery);

onUnmounted(() => {
  stopStatusPolling();
});
</script>
