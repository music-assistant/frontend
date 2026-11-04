<template>
  <section
    class="relative isolate aspect-[16/10] overflow-hidden rounded-md bg-black text-white"
  >
    <img
      v-if="art"
      :src="art"
      :alt="title"
      class="absolute inset-0 -z-20 size-full object-cover"
      @error="hideFailedArtwork"
    />
    <div
      class="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/25 to-black/30"
    ></div>
    <img
      :src="musicAssistantLogo"
      alt="Music Assistant"
      class="absolute left-3 top-3 h-5 w-auto"
    />
    <div class="absolute inset-x-3 bottom-3 flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <h2 class="line-clamp-2 text-xl leading-tight font-bold sm:text-2xl">
          {{ title }}
        </h2>
        <p v-if="artist" class="mt-1 truncate text-sm font-medium">
          {{ artist }}
        </p>
        <p v-if="album" class="truncate text-xs text-white/75">{{ album }}</p>
      </div>
      <Button
        variant="ghost-icon"
        size="icon-sm"
        class="shrink-0 text-white hover:bg-white/15 hover:text-white"
        :aria-label="$t('share.copy_share_link')"
        :title="$t('share.copy_share_link')"
        :disabled="!shareUrl"
        @click="emit('copy-share-link')"
      >
        <Copy class="size-4" />
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import musicAssistantLogo from "@/assets/logo/logo.svg";
import { Copy } from "@lucide/vue";

defineProps<{
  title: string;
  artist?: string;
  album?: string;
  art?: string;
  shareUrl: string;
}>();

const emit = defineEmits<{
  "copy-share-link": [];
}>();

function hideFailedArtwork(event: Event): void {
  (event.currentTarget as HTMLImageElement).style.display = "none";
}
</script>
