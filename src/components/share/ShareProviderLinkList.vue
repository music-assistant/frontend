<template>
  <div
    v-if="links.length"
    class="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain"
  >
    <div
      v-for="link in links"
      :key="`${link.domain}-${link.url}`"
      class="flex min-w-0 items-center gap-3 py-2.5"
    >
      <ProviderIcon :domain="link.domain" :size="20" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ link.name }}</p>
        <a
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="block truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {{ link.url }}
        </a>
      </div>
      <Button
        variant="ghost-icon"
        size="icon-sm"
        class="shrink-0"
        :aria-label="$t('share.copy_provider_link', [link.name])"
        :title="$t('share.copy_provider_link', [link.name])"
        @click="emit('copy-link', link.url)"
      >
        <Copy class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import ProviderIcon from "@/components/ProviderIcon.vue";
import type { ShareProviderLink } from "@/helpers/share_links";
import { Copy } from "@lucide/vue";

defineProps<{
  links: ShareProviderLink[];
}>();

const emit = defineEmits<{
  "copy-link": [url: string];
}>();
</script>
