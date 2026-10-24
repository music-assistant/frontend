<template>
  <section class="w-full" :aria-busy="loading">
    <Toolbar :icon="ArrowLeft" :icon-action="goBack" />

    <div v-if="loading" role="status" class="space-y-6 px-4 py-6 md:px-6">
      <div class="flex items-end gap-5">
        <Skeleton class="size-32 shrink-0 rounded-md md:size-44" />
        <div class="min-w-0 flex-1 space-y-3 pb-1">
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-9 w-72 max-w-full" />
          <p class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-4 shrink-0 animate-spin" />
            {{ $t("share.loading") }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-else-if="errorKey"
      role="alert"
      class="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <CircleAlert class="size-10 text-muted-foreground" />
      <h1 class="max-w-md text-xl font-semibold">{{ $t(errorKey) }}</h1>
    </div>

    <template v-else-if="decodedPayload?.type === 'playlist'">
      <header
        class="relative isolate flex min-h-[336px] items-end overflow-hidden bg-black px-4 py-6 text-white md:min-h-[400px] md:px-6 md:py-8"
      >
        <img
          v-if="artwork && !artworkFailed"
          :src="artwork"
          alt=""
          aria-hidden="true"
          class="absolute inset-0 -z-20 size-full scale-110 object-cover blur-[44px]"
        />
        <div
          class="absolute inset-0 -z-10 bg-black/60"
          aria-hidden="true"
        ></div>
        <div
          class="flex w-full min-w-0 items-end gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3"
        >
          <div
            class="relative flex size-[200px] flex-none items-center justify-center overflow-hidden rounded-lg bg-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-md:size-[132px]"
          >
            <ListMusic class="size-16 text-white/60" aria-hidden="true" />
            <img
              v-if="artwork && !artworkFailed"
              :src="artwork"
              alt=""
              class="absolute inset-0 size-full object-cover"
              @error="artworkFailed = true"
            />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-2.5 pb-1">
            <h1
              class="m-0 text-[44px] leading-[1.2] font-medium break-words [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] max-md:text-[30px]"
            >
              {{ decodedPayload.title }}
            </h1>
            <div class="space-y-1 text-[15px] text-white/85 max-md:text-sm">
              <p v-if="decodedPayload.artist" class="break-words">
                {{ decodedPayload.artist }}
              </p>
              <DetailHeroFacts :icon="ListMusic" :facts="playlistFacts" />
            </div>
            <div class="flex min-w-0 flex-wrap items-center gap-2.5 pt-1">
              <Button
                v-if="canWrite"
                size="lg"
                class="max-w-full whitespace-normal"
                :disabled="decodedPayload.tracks.length === 0"
                @click="confirmImportOpen = true"
              >
                <ListPlus class="size-5" />
                {{ $t("share.import") }}
              </Button>
              <p v-else class="text-sm text-white/85">
                {{ $t("share.write_access_required") }}
              </p>
            </div>
          </div>
        </div>
      </header>

      <SharedPlaylistTracks :key="payload" :payload="payload" />
    </template>
  </section>

  <Dialog v-model:open="confirmImportOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("share.confirm_title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("share.confirm_description") }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="confirmImportOpen = false">
          {{ $t("close") }}
        </Button>
        <Button :disabled="importing" @click="importPlaylist">
          <LoaderCircle v-if="importing" class="size-4 animate-spin" />
          {{ $t("share.confirm_import") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useRouter } from "vue-router";

import Toolbar from "@/components/Toolbar.vue";
import SharedPlaylistTracks from "@/components/share/SharedPlaylistTracks.vue";
import DetailHeroFacts from "@/components/details/DetailHeroFacts.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/plugins/api";
import { MediaType, Scope, type MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { authManager } from "@/plugins/auth";
import { backFromMediaDetails } from "@/helpers/navigation";
import { expandShareArtworkRef, type SharedTrack } from "@/helpers/share_links";
import {
  ArrowLeft,
  CircleAlert,
  LoaderCircle,
  ListMusic,
  ListPlus,
} from "@lucide/vue";

interface SharedPayload {
  type: "track" | "album" | "artist" | "playlist";
  title: string;
  artist?: string;
  version?: string;
  art_ref?: string;
  tracks: SharedTrack[];
}

const props = defineProps<{ payload: string }>();
const router = useRouter();
const decodedPayload = ref<SharedPayload>();
const loading = ref(true);
const errorKey = ref("");
const importing = ref(false);
const confirmImportOpen = ref(false);
let importRequestId = 0;
const canWrite = computed(() => authManager.hasScope(Scope.LIBRARY_WRITE));
const artwork = computed(() =>
  expandShareArtworkRef(decodedPayload.value?.art_ref),
);
const artworkFailed = ref(false);
const playlistFacts = computed(() => [
  $t("playlist"),
  $t("share.playlist_tracks", {
    count: decodedPayload.value?.tracks.length ?? 0,
  }),
]);

function goBack(): void {
  backFromMediaDetails(router);
}

watch(
  () => props.payload,
  async (encoded, _previous, onCleanup) => {
    let active = true;
    onCleanup(() => {
      active = false;
      importRequestId++;
    });
    confirmImportOpen.value = false;
    importing.value = false;
    decodedPayload.value = undefined;
    artworkFailed.value = false;
    errorKey.value = "";
    loading.value = true;

    let shared: SharedPayload;
    try {
      shared = decodePayload(encoded);
    } catch {
      errorKey.value = "share.invalid_link";
      loading.value = false;
      return;
    }
    decodedPayload.value = shared;

    if (shared.type === "playlist") {
      loading.value = false;
      return;
    }

    try {
      const item = await api.resolveSharedItem(encoded);
      if (!active) return;
      if (!item) {
        errorKey.value = "share.resolve_failed";
        return;
      }
      await openItem(item);
    } catch {
      if (active) errorKey.value = "share.resolve_failed";
    } finally {
      if (active) loading.value = false;
    }
  },
  { immediate: true },
);

async function importPlaylist(): Promise<void> {
  if (
    !canWrite.value ||
    decodedPayload.value?.type !== "playlist" ||
    !props.payload
  ) {
    return;
  }

  const encodedPayload = props.payload;
  const requestId = ++importRequestId;
  importing.value = true;
  try {
    const playlist = await api.importSharedPlaylist(encodedPayload);
    if (requestId !== importRequestId || encodedPayload !== props.payload)
      return;
    toast.success($t("share.imported"));
    confirmImportOpen.value = false;
    await openItem(playlist);
  } catch {
    if (requestId === importRequestId && encodedPayload === props.payload) {
      toast.error($t("share.import_failed"));
    }
  } finally {
    if (requestId === importRequestId && encodedPayload === props.payload) {
      importing.value = false;
    }
  }
}

async function openItem(item: MediaItemType): Promise<void> {
  const routeNames: Partial<Record<MediaType, string>> = {
    [MediaType.TRACK]: "track",
    [MediaType.ALBUM]: "album",
    [MediaType.ARTIST]: "artist",
    [MediaType.PLAYLIST]: "playlist",
  };
  const name = routeNames[item.media_type];
  if (!name) {
    errorKey.value = "share.resolve_failed";
    return;
  }
  await router.replace({
    name,
    params: { provider: item.provider, itemId: item.item_id },
  });
}

function decodePayload(encoded: string): SharedPayload {
  if (!encoded) throw new Error("Missing payload");
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    (character) => character.charCodeAt(0),
  );
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object") throw new Error("Invalid payload");
  const candidate = value as Record<string, unknown>;
  if (
    !["track", "album", "artist", "playlist"].includes(
      String(candidate.type),
    ) ||
    typeof candidate.title !== "string" ||
    !candidate.title.trim()
  ) {
    throw new Error("Invalid payload");
  }
  if (candidate.type === "playlist") {
    if (
      !Array.isArray(candidate.tracks) ||
      candidate.tracks.some(
        (track) => !track || typeof track.title !== "string",
      )
    ) {
      throw new Error("Invalid playlist payload");
    }
  }
  return {
    type: candidate.type as SharedPayload["type"],
    title: candidate.title,
    artist: typeof candidate.artist === "string" ? candidate.artist : undefined,
    art_ref:
      typeof candidate.art_ref === "string" ? candidate.art_ref : undefined,
    tracks: (candidate.tracks ?? []) as SharedTrack[],
  };
}
</script>
