<template>
  <section class="w-full" :aria-busy="loading">
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
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";

import { Skeleton } from "@/components/ui/skeleton";
import api from "@/plugins/api";
import { MediaType, type MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { decodeSharePayload } from "@/helpers/share_links";
import { CircleAlert, LoaderCircle } from "@lucide/vue";

const props = defineProps<{ payload: string }>();
const router = useRouter();
const loading = ref(true);
const errorKey = ref("");

watch(
  () => props.payload,
  async (encoded, _previous, onCleanup) => {
    let active = true;
    onCleanup(() => {
      active = false;
    });
    errorKey.value = "";
    loading.value = true;

    try {
      await decodeSharePayload(encoded);
    } catch {
      if (!active) return;
      errorKey.value = "share.invalid_link";
      loading.value = false;
      return;
    }
    if (!active) return;

    if (!store.enabledPlugins.has("share_provider")) {
      errorKey.value = "share.plugin_unavailable";
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

async function openItem(item: MediaItemType): Promise<void> {
  const routeNames: Partial<Record<MediaType, string>> = {
    [MediaType.TRACK]: "track",
    [MediaType.ALBUM]: "album",
    [MediaType.ARTIST]: "artist",
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
</script>
