<template>
  <CatalogBannerCard
    :domain="config.domain"
    :name="name"
    :tone="tone"
    :class="{ 'card-hover': manageable, 'opacity-60': !config.enabled }"
  >
    <template v-if="bannerStatus" #banner>
      <span
        class="absolute inset-y-0 right-12 left-[72px] flex items-center gap-1.5 text-xs font-semibold"
        :class="statusVariant ? 'text-destructive' : 'text-muted-foreground'"
        data-testid="provider-status"
      >
        <TriangleAlert
          v-if="statusVariant"
          class="size-3.5 shrink-0"
          aria-hidden="true"
        />
        <Ban v-else class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ statusLabel }}</span>
      </span>
    </template>
    <!-- a light circle reads on any banner -->
    <template v-if="manageable" #corner>
      <Button
        variant="ghost"
        size="icon-sm"
        class="rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background dark:hover:bg-background"
        data-testid="provider-menu"
        :aria-label="menuLabel"
        :title="menuLabel"
        @click.stop="emit('menu', $event)"
      >
        <MoreVertical class="size-4" />
      </Button>
    </template>
    <template #name>
      <!-- the name is the focusable control; the card itself only follows the pointer -->
      <button
        v-if="manageable"
        type="button"
        class="block max-w-full cursor-pointer truncate text-left"
        data-testid="provider-open"
        @click.stop="emit('open')"
      >
        {{ name }}
      </button>
      <template v-else>{{ name }}</template>
    </template>
    <template #badges>
      <TooltipIcon
        v-if="statusIcon === 'loading'"
        :label="statusLabel ?? ''"
        data-testid="provider-status-icon"
      >
        <Spinner class="size-3.5" aria-hidden="true" />
      </TooltipIcon>
      <ProviderMaintainerMarker v-if="community" variant="icon" />
    </template>
    <template v-if="offersShown" #subtitle>
      <ProviderLabels :labels="labels ?? []" />
    </template>
    <p
      v-if="isError"
      :class="TEXT_CLASS"
      class="text-destructive"
      data-testid="provider-error"
    >
      {{ errorText }}
    </p>
    <p
      v-else-if="description"
      :class="TEXT_CLASS"
      class="text-muted-foreground"
    >
      {{ description }}
    </p>
    <slot name="details" />
    <template
      v-if="accessSummary || syncing || reconfigure || removable"
      #footer
    >
      <span
        v-if="accessSummary"
        class="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
        :title="accessSummary"
      >
        <Users class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate" data-testid="provider-access">
          {{ accessSummary }}
        </span>
      </span>
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <span
          v-if="syncing"
          role="status"
          :aria-label="$t('settings.sync_running')"
          :title="$t('settings.sync_running')"
        >
          <RefreshCw class="size-4 animate-spin text-muted-foreground" />
        </span>
        <ProviderRowButtons
          :reconfigure="reconfigure"
          :remove="!!removable"
          @reconfigure="emit('reconfigure')"
          @remove="emit('remove')"
        />
      </div>
    </template>
  </CatalogBannerCard>
</template>

<script setup lang="ts">
import CatalogBannerCard from "@/components/settings/catalog/CatalogBannerCard.vue";
import ProviderLabels from "@/components/settings/providers/ProviderLabels.vue";
import ProviderMaintainerMarker from "@/components/settings/providers/ProviderMaintainerMarker.vue";
import ProviderRowButtons from "@/components/settings/providers/ProviderRowButtons.vue";
import TooltipIcon from "@/components/TooltipIcon.vue";
import type { BadgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getShownLabels, type ProviderLabel } from "@/helpers/provider_labels";
import type { ProviderConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  Ban,
  MoreVertical,
  RefreshCw,
  TriangleAlert,
  Users,
} from "@lucide/vue";
import { computed } from "vue";

/**
 * A provider in the card view of a settings list: the Marketplace card, whose
 * banner says when the provider is in error or disabled, with what it offers
 * under its name and who can use it at the bottom. ProviderRow opens it and
 * its menu from the card itself.
 */
interface Props {
  config: ProviderConfig;
  name: string;
  // whether the viewer may open and manage the source
  manageable: boolean;
  // whether its error offers to reconfigure it
  reconfigure: boolean;
  // whether it offers to remove it, for an entry that cannot be opened
  removable?: boolean;
  syncing: boolean;
  description?: string;
  labels?: readonly ProviderLabel[];
  accessSummary?: string | null;
  // set for a status that needs attention
  statusVariant?: BadgeVariants["variant"];
  statusIcon?: "loading" | "disabled";
  statusLabel?: string;
  isError?: boolean;
  errorText?: string;
  community?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  open: [];
  menu: [event: Event];
  reconfigure: [];
  remove: [];
}>();

defineSlots<{
  // more about the source, under its description
  details?(): unknown;
}>();

const TEXT_CLASS = "m-0 mt-2.5 line-clamp-2 min-h-10 text-sm leading-5";

const menuLabel = computed(() => `${$t("more_options")}: ${props.name}`);

const offersShown = computed(
  () => getShownLabels(props.labels ?? []).length > 0,
);

// an error turns the banner red and a disabled source grey; a loading one keeps
// its colour and shows its spinner by the name
const tone = computed(() => {
  if (props.isError) return "error";
  if (!props.config.enabled || props.statusIcon === "disabled") return "muted";
  return undefined;
});

const bannerStatus = computed(
  () => !!props.statusVariant || props.statusIcon === "disabled",
);
</script>
