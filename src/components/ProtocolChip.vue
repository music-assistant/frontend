<template>
  <Badge
    v-bind="linkAttrs"
    variant="secondary"
    class="protocol-chip h-5 bg-muted px-1.5 text-[10px] tracking-[0.3px] uppercase no-underline"
    :class="{ 'opacity-40': !protocol.available }"
  >
    <ProviderIcon
      :domain="protocol.protocol_domain"
      :size="14"
      class="protocol-chip__icon"
    />
    {{ manifest?.name || protocol.protocol_domain }}
    <ExternalLink v-if="documentationUrl" aria-hidden="true" />
  </Badge>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";
import { getExternalLinkUrl } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { OutputProtocol } from "@/plugins/api/interfaces";
import { ExternalLink } from "@lucide/vue";

export interface Props {
  protocol: OutputProtocol;
  // turn the chip into a link to the protocol provider's documentation, if it has any
  linkToDocs?: boolean;
}
const props = defineProps<Props>();

const manifest = computed(() =>
  api.getProviderManifest(props.protocol.protocol_domain),
);

const documentationUrl = computed(() =>
  props.linkToDocs
    ? getExternalLinkUrl(manifest.value?.documentation)
    : undefined,
);

// only chips that have somewhere to go become an anchor; the rest stay a plain
// span, so the call sites that just label a protocol are not focusable links
const linkAttrs = computed(() =>
  documentationUrl.value
    ? {
        as: "a",
        href: documentationUrl.value,
        target: "_blank",
        rel: "noopener noreferrer",
      }
    : { as: "span" },
);
</script>

<style scoped>
/* the badge fills with --muted rather than the variant's identical --secondary:
   vuetify's runtime theme stylesheet also defines .bg-secondary and, being
   injected after the bundle, wins the !important tie and turns the chip teal */

/* a plain rule, so the !important dimming of an unavailable chip still wins */
.protocol-chip[href]:hover {
  opacity: 0.85;
}

.protocol-chip__icon {
  flex-shrink: 0;
}
</style>
