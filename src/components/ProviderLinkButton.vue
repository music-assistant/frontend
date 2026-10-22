<template>
  <Button
    v-if="links.length === 1"
    :variant="variant"
    :size="size"
    v-bind="$attrs"
    :aria-label="
      $t(nativeShareAvailable ? 'provider_links.share' : 'provider_links.copy')
    "
    :title="
      $t(nativeShareAvailable ? 'provider_links.share' : 'provider_links.copy')
    "
    @click.stop="activate(links[0])"
  >
    <Share2 class="size-4" />
  </Button>
  <DropdownMenu v-else-if="links.length">
    <DropdownMenuTrigger as-child>
      <Button
        :variant="variant"
        :size="size"
        v-bind="$attrs"
        :aria-label="$t('provider_links.share')"
        :title="$t('provider_links.share')"
        @click.stop
      >
        <Share2 class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="z-[100001]">
      <template v-for="link in links" :key="link.url">
        <DropdownMenuItem
          v-if="nativeShareAvailable"
          @select="shareProviderLink(link.url, title)"
        >
          <Share2 class="size-4" />
          {{ $t("provider_links.share_on", { provider: providerName(link) }) }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="!nativeShareAvailable"
          @select="copyProviderLink(link.url)"
        >
          <Copy class="size-4" />
          {{ $t("provider_links.copy_from", { provider: providerName(link) }) }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  copyProviderLink,
  shareProviderLink,
} from "@/composables/useProviderLinkSharing";
import { providerLinks, type ProviderLink } from "@/helpers/provider_links";
import { IS_MOBILE_UA } from "@/helpers/device";
import { api } from "@/plugins/api";
import type { ProviderMapping } from "@/plugins/api/interfaces";
import { Copy, Share2 } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  mappings: ProviderMapping[];
  title: string;
  size?: "icon-sm" | "icon-lg";
  variant?: "ghost" | "ghost-icon";
}

const props = withDefaults(defineProps<Props>(), {
  size: "icon-sm",
  variant: "ghost",
});
const nativeShareAvailable =
  IS_MOBILE_UA && typeof navigator.share === "function";
const links = computed(() => providerLinks(props.mappings));
const providerName = (link: ProviderLink) =>
  api.getProviderManifest(link.provider)?.name ?? link.provider;
const activate = (link: ProviderLink) =>
  nativeShareAvailable
    ? shareProviderLink(link.url, props.title)
    : copyProviderLink(link.url);
</script>
