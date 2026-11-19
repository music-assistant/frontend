<template>
  <Item variant="outline" size="sm">
    <ItemMedia variant="icon">
      <ProviderIcon :domain="provider.domain" :size="20" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ provider.name }}</ItemTitle>
    </ItemContent>
    <ItemActions>
      <!-- a provider that is set up but switched off or broken is no tick -->
      <Check
        v-if="!provider.needsAttention"
        class="text-primary size-4"
        aria-hidden="true"
      />
      <template v-else>
        <Button
          v-if="needsReconfigure"
          variant="secondary"
          size="sm"
          data-testid="onboarding-provider-reconfigure"
          @click="reconfigure"
        >
          {{ $t("settings.reconfigure") }}
        </Button>
        <span :title="attentionLabel">
          <TriangleAlert
            class="text-muted-foreground size-4"
            :aria-label="attentionLabel"
          />
        </span>
      </template>
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { ConfiguredProvider } from "@/composables/useOnboarding";
import { attentionLabelKey } from "@/helpers/onboarding";
import { providerRequiresReconfiguration } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { Check, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";

/**
 * A provider set up in the setup wizard: ticked when it works, otherwise
 * flagged with what is wrong, with a Reconfigure button when signing in again
 * fixes it.
 */
const props = defineProps<{
  provider: ConfiguredProvider;
}>();

const needsReconfigure = computed(() =>
  providerRequiresReconfiguration(
    props.provider.status,
    api.providerManifests[props.provider.domain]?.has_setup_flow,
  ),
);

const attentionLabel = computed(() =>
  $t(attentionLabelKey(props.provider.status)),
);

const reconfigure = function () {
  eventbus.emit("setupFlowDialog", {
    kind: "reconfigure",
    instanceId: props.provider.instance_id,
    name: props.provider.name,
  });
};
</script>
