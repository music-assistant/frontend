<template>
  <!-- a working provider's row opens its settings on top of the wizard, so
       the setup never has to be left to change them -->
  <Item
    v-bind="$attrs"
    :as="opensSettings ? 'button' : 'div'"
    :type="opensSettings ? 'button' : undefined"
    size="sm"
    :class="
      opensSettings &&
      'hover:bg-accent/50 w-full cursor-pointer text-left transition-colors'
    "
    @click="openSettings"
  >
    <ItemMedia variant="icon">
      <ProviderIcon :domain="provider.domain" :size="20" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ provider.name }}</ItemTitle>
      <ItemDescription v-if="description">{{ description }}</ItemDescription>
    </ItemContent>
    <ItemActions>
      <!-- a provider that is set up but switched off or broken is no tick -->
      <template v-if="working">
        <Check class="text-primary size-4" aria-hidden="true" />
        <ChevronRight
          v-if="opensSettings"
          class="text-muted-foreground size-4"
          aria-hidden="true"
        />
      </template>
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

  <ProviderSettingsDialog
    v-if="opensSettings"
    v-model:open="showSettings"
    :instance-id="provider.instance_id"
  />
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import ProviderSettingsDialog from "@/components/settings/providers/ProviderSettingsDialog.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { ConfiguredProvider } from "@/composables/useOnboarding";
import { attentionLabelKey } from "@/helpers/onboarding";
import { providerRequiresReconfiguration } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { Check, ChevronRight, TriangleAlert } from "@lucide/vue";
import { computed, ref } from "vue";

/**
 * A provider set up in the setup wizard: ticked when it works, and then the
 * way into its settings unless it is shown for its status only; otherwise
 * flagged with what is wrong, with a Reconfigure button when signing in again
 * fixes it.
 */
const props = defineProps<{
  provider: ConfiguredProvider;
  // what it brings, such as the engines it provides
  description?: string;
  // a working provider's row does not open its settings
  statusOnly?: boolean;
}>();

// the row and its settings dialog are siblings, so what the step hands the
// row is put on the row itself
defineOptions({ inheritAttrs: false });

const showSettings = ref(false);
const working = computed(() => !props.provider.needsAttention);
const opensSettings = computed(() => working.value && !props.statusOnly);

const openSettings = function () {
  if (opensSettings.value) showSettings.value = true;
};

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
