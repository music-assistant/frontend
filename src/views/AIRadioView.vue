<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <CustomizeShow
      v-if="customizeShowId"
      v-show="!customizeHostOpen"
      :station-id="customizeShowId"
      @back="closeCustomize"
      @saved="closeCustomize"
      @open-hosts="openCustomizeHost()"
    />
    <CustomizeHost
      v-if="customizeHostOpen"
      :host-id="customizeHostId || undefined"
      :preset-draft="presetDraft || undefined"
      @back="closeCustomizeHost"
      @saved="closeCustomizeHost"
    />
    <template v-if="!customizeShowId && !customizeHostOpen">
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
          <RefreshCw
            class="h-4 w-4"
            :class="{ 'animate-spin': isRefreshing }"
          />
        </Button>
      </header>

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold tracking-tight">
            {{ $t("providers.ai_radio.hosts.title") }}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button>
                <Plus class="mr-1 h-4 w-4" />
                {{ $t("providers.ai_radio.hosts.add_host") }}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="openCustomizeHost()">
                {{ $t("providers.ai_radio.hosts.blank_host") }}
              </DropdownMenuItem>
              <template v-if="presets.length">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  v-for="preset in presets"
                  :key="preset.host.id"
                  @click="openCustomizeHostFromPreset(preset)"
                >
                  {{ preset.host.name }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div
          class="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]"
        >
          <HostCard
            v-for="host in hosts"
            :key="host.id"
            :host="host"
            @edit="openCustomizeHost"
          />
        </div>
      </div>

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

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold tracking-tight">
            {{ $t("providers.ai_radio.gallery.title") }}
          </h2>
          <Button @click="openCreateDialog()">
            <Plus class="mr-1 h-4 w-4" />
            {{ $t("providers.ai_radio.gallery.add_show") }}
          </Button>
        </div>

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
          class="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]"
        >
          <ShowCard
            v-for="show in shows"
            :key="show.id"
            :show="show"
            @customize="onCustomize"
          />
        </div>
      </div>

      <CreateShowDialog
        v-model:open="createDialogOpen"
        :initial-playlist="createDialogInitialPlaylist"
        @open-hosts="openHostsFromCreateDialog"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { PlaylistSelection } from "@/components/ai-radio/AiRadioPlaylistPicker.vue";
import CreateShowDialog from "@/components/ai-radio/CreateShowDialog.vue";
import CustomizeHost from "@/components/ai-radio/CustomizeHost.vue";
import CustomizeShow from "@/components/ai-radio/CustomizeShow.vue";
import HostCard from "@/components/ai-radio/HostCard.vue";
import ShowCard from "@/components/ai-radio/ShowCard.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useHosts,
  type AIRadioHostPreset,
} from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  decompileHost,
  errorMessage,
  getQueryValue,
  uniqueHostName,
  type HostDraft,
} from "@/helpers/ai_radio";
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
  loadingPlaylists,
  loadShows,
  loadSections,
  refreshDjStatus,
  loadPlaylists,
  noAiProviderAlert,
  dismissNoAiProviderAlert,
} = useShows();
const { hosts, presets, loadingHosts, loadHosts, loadPresets } = useHosts();

const createDialogOpen = ref(false);
const createDialogInitialPlaylist = ref<PlaylistSelection | undefined>();
const customizeShowId = ref("");
// null = closed; "" = creating a new host; otherwise the id being edited.
const customizeHostId = ref<string | null>(null);
const customizeHostOpen = computed(() => customizeHostId.value !== null);
const presetDraft = ref<HostDraft | null>(null);

const isRefreshing = computed(
  () =>
    loadingHosts.value ||
    loadingShows.value ||
    loadingSections.value ||
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

function onCustomize(stationId: string) {
  customizeShowId.value = stationId;
}

function closeCustomize() {
  customizeShowId.value = "";
}

function openCustomizeHost(hostId?: string) {
  presetDraft.value = null;
  customizeHostId.value = hostId || "";
}

/** Opens the host editor pre-filled with an unsaved draft cloned from a bundled persona preset. */
function openCustomizeHostFromPreset(preset: AIRadioHostPreset) {
  const draft = decompileHost(preset.host, preset.sections);
  draft.id = "";
  draft.name = uniqueHostName(
    draft.name,
    hosts.value.map((host) => host.name),
  );
  // compileHost namespaces ids with the new host id, so strip the preset's own prefix.
  const presetPrefix = `${preset.host.id}_`;
  for (const segment of draft.segments) {
    if (segment.id.startsWith(presetPrefix)) {
      segment.id = segment.id.slice(presetPrefix.length);
    }
  }
  presetDraft.value = draft;
  customizeHostId.value = "";
}

/** The create dialog has no draft to return to, so opening the host editor from it just closes it. */
function openHostsFromCreateDialog() {
  createDialogOpen.value = false;
  openCustomizeHost();
}

async function closeCustomizeHost() {
  customizeHostId.value = null;
  if (!customizeShowId.value) return;
  // CustomizeShow stays mounted across the host editor detour, so its own
  // onMounted refresh doesn't run again; refetch so a newly created host
  // shows up in the picker.
  try {
    await loadHosts();
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function applyRouteQuery() {
  const stationId = getQueryValue(route.query.station_id);
  if (stationId) {
    onCustomize(stationId);
    void router.replace({ query: {} });
    return;
  }
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
  }
}

async function handleRefresh() {
  try {
    await Promise.all([
      loadHosts(),
      loadShows(),
      loadSections(),
      refreshDjStatus(),
      loadPlaylists(),
    ]);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

// Set by the unmount hook, so the startup below can tell that the view it is
// setting things up for is already gone.
let unmounted = false;

onMounted(async () => {
  try {
    await Promise.all([
      loadHosts(),
      loadShows(),
      loadSections(),
      refreshDjStatus(),
      loadPlaylists(),
    ]);
  } catch (error) {
    toast.error(errorMessage(error));
  }
  // Leaving the view while the loads are in flight runs the unmount hook first,
  // so bail out rather than rewrite the query of a route this view no longer owns.
  if (unmounted) return;
  // Best effort: the "Add host" menu still works with just "Blank host" if this fails.
  void loadPresets().catch(() => {});
  applyRouteQuery();
});

watch(() => route.query, applyRouteQuery);

onUnmounted(() => {
  unmounted = true;
});
</script>
