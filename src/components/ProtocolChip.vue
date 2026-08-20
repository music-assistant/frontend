<template>
  <v-chip
    size="x-small"
    variant="tonal"
    class="protocol-chip"
    :class="{
      'protocol-chip--clickable': documentation,
      'protocol-chip--unavailable': !protocol.available,
    }"
    v-on="documentation ? { click: openDocumentation } : {}"
  >
    <template #prepend>
      <ProviderIcon
        :domain="protocol.protocol_domain"
        :size="14"
        class="chip-icon"
      />
    </template>
    {{ manifest?.name || protocol.protocol_domain }}
    <v-icon v-if="documentation" size="12" class="ml-1">mdi-open-in-new</v-icon>
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { OutputProtocol } from "@/plugins/api/interfaces";

export interface Props {
  protocol: OutputProtocol;
  // turn the chip into a link to the protocol provider's documentation, if it has any
  linkToDocs?: boolean;
}
const props = defineProps<Props>();

const manifest = computed(() =>
  api.getProviderManifest(props.protocol.protocol_domain),
);

const documentation = computed(() =>
  props.linkToDocs ? manifest.value?.documentation : undefined,
);

// bound conditionally: vuetify renders a chip with a click listener as
// interactive, so an unclickable chip must not have one at all
function openDocumentation() {
  if (documentation.value) openLinkInNewTab(documentation.value);
}
</script>

<style scoped>
.protocol-chip {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.3px;
}

.protocol-chip--clickable {
  cursor: pointer;
}

.protocol-chip--clickable:hover {
  opacity: 0.85;
}

.protocol-chip--unavailable {
  opacity: 0.4;
}

.chip-icon {
  margin: 0;
  width: auto !important;
}

.chip-icon :deep(div) {
  margin-left: 0 !important;
  margin-right: 4px !important;
  width: 14px !important;
  height: 14px !important;
}
</style>
