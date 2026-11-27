<template>
  <!-- list view: a row that stacks beside its icon, and takes the columns of
       the list once the list is wide enough (its @container) -->
  <Item
    v-if="variant === 'list'"
    v-hold="onManageableHold"
    :class="listRowClass"
    data-testid="provider-row"
    @click.capture="swallowClickAfterHold"
    @click="onRootClick"
    @click.right="onContextMenu"
    @touchstart.passive="onTouchStart"
  >
    <div class="flex min-w-0 flex-1 flex-col @4xl:contents">
      <div class="flex min-w-0 items-start gap-3 @4xl:items-center">
        <CatalogIconTile :src="iconSrc" :size="36" :on-dark="onDark" />
        <div class="min-w-0 flex-1">
          <div
            class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 @4xl:flex-nowrap"
          >
            <!-- the name is the focusable control; the row itself only follows the pointer -->
            <button
              v-if="manageable"
              type="button"
              :class="NAME_CLASS"
              class="cursor-pointer text-left"
              data-testid="provider-open"
              @click.stop="emit('open')"
            >
              {{ name }}
            </button>
            <span v-else :class="NAME_CLASS">{{ name }}</span>
            <TooltipIcon
              v-if="statusIcon"
              :label="statusLabel ?? ''"
              data-testid="provider-status-icon"
            >
              <Spinner
                v-if="statusIcon === 'loading'"
                class="size-3.5"
                aria-hidden="true"
              />
              <Ban v-else class="size-3.5" aria-hidden="true" />
            </TooltipIcon>
            <Badge
              v-if="statusVariant"
              :variant="statusVariant"
              :class="statusBadgeClass"
              data-testid="provider-status"
            >
              <TriangleAlert aria-hidden="true" />
              {{ statusLabel }}
            </Badge>
            <ProviderMaintainerMarker v-if="community" variant="icon" />
          </div>
          <p
            v-if="isError"
            :class="LINE_CLASS"
            class="text-destructive"
            data-testid="provider-error"
          >
            {{ errorText }}
          </p>
          <p
            v-else-if="description"
            :class="LINE_CLASS"
            class="text-muted-foreground"
          >
            {{ description }}
          </p>
          <slot name="details" />
        </div>
      </div>
      <!-- one line under the description, or a column each -->
      <p
        v-if="columns.offers || columns.access"
        class="m-0 mt-1 pl-12 text-xs leading-4 text-muted-foreground @4xl:contents"
        :class="{ '@max-4xl:hidden': !offersShown && !accessSummary }"
      >
        <span v-if="columns.offers" :class="CELL_CLASS">
          <ProviderLabels :labels="labels ?? []" />
        </span>
        <span
          v-if="offersShown && accessSummary"
          class="mx-1 @4xl:hidden"
          aria-hidden="true"
          >·</span
        >
        <span
          v-if="columns.access"
          :class="CELL_CLASS"
          :data-testid="accessSummary ? 'provider-access' : undefined"
        >
          {{ accessSummary }}
        </span>
      </p>
      <!-- the stacked spacing only applies while stacked: Vuetify's own mt-2
           and pl-12 would outrank @4xl:mt-0 and @4xl:pl-0 -->
      <div
        v-if="showReconfigure || removable"
        class="flex flex-wrap gap-2 @max-4xl:mt-2 @max-4xl:pl-12 @4xl:-col-end-2 @4xl:justify-end"
      >
        <ProviderRowButtons
          :reconfigure="showReconfigure"
          :remove="!!removable"
          @reconfigure="emit('reconfigure')"
          @remove="emit('remove')"
        />
      </div>
    </div>
    <div class="flex shrink-0 items-center @4xl:-col-end-1">
      <span
        v-if="syncing"
        role="status"
        class="inline-flex size-8 items-center justify-center"
        :aria-label="$t('settings.sync_running')"
        :title="$t('settings.sync_running')"
      >
        <RefreshCw class="size-4 animate-spin text-muted-foreground" />
      </span>
      <!-- a finger needs the bigger target while the row stacks -->
      <Button
        v-if="manageable"
        variant="ghost"
        size="icon-sm"
        class="@max-4xl:-my-1.5 @max-4xl:-mr-2 @max-4xl:size-11"
        data-testid="provider-menu"
        :aria-label="menuLabel"
        :title="menuLabel"
        @click.stop="emit('menu', $event)"
      >
        <MoreVertical class="size-4" />
      </Button>
    </div>
  </Item>

  <!-- card view: the Marketplace card, with the status on its banner -->
  <ProviderCard
    v-else
    v-hold="onManageableHold"
    :config="config"
    :name="name"
    :manageable="manageable"
    :reconfigure="showReconfigure"
    :removable="removable"
    :syncing="syncing"
    :description="description"
    :labels="labels"
    :access-summary="accessSummary"
    :status-variant="statusVariant"
    :status-icon="statusIcon"
    :status-label="statusLabel"
    :is-error="isError"
    :error-text="errorText"
    :community="community"
    data-testid="provider-row"
    @click.capture="swallowClickAfterHold"
    @click="onRootClick"
    @click.right="onContextMenu"
    @touchstart.passive="onTouchStart"
    @open="emit('open')"
    @menu="emit('menu', $event)"
    @reconfigure="emit('reconfigure')"
    @remove="emit('remove')"
  >
    <template v-if="$slots.details" #details>
      <slot name="details" />
    </template>
  </ProviderCard>
</template>

<script lang="ts">
/** The columns a wide list gives beside the names of its providers. */
export interface ProviderListColumns {
  // what the providers offer
  offers: boolean;
  // who may use each source
  access: boolean;
}
</script>

<script setup lang="ts">
import CatalogIconTile from "@/components/settings/catalog/CatalogIconTile.vue";
import ProviderCard from "@/components/settings/providers/ProviderCard.vue";
import ProviderLabels from "@/components/settings/providers/ProviderLabels.vue";
import ProviderMaintainerMarker from "@/components/settings/providers/ProviderMaintainerMarker.vue";
import ProviderRowButtons from "@/components/settings/providers/ProviderRowButtons.vue";
import TooltipIcon from "@/components/TooltipIcon.vue";
import { Badge, type BadgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useCatalogIcon } from "@/composables/settings/catalog/useCatalogIcon";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { getShownLabels, type ProviderLabel } from "@/helpers/provider_labels";
import type { ProviderConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Ban, MoreVertical, RefreshCw, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  config: ProviderConfig;
  variant: "list" | "card";
  // the columns of the list the row is in
  columns: ProviderListColumns;
  // whether the viewer may open, reconfigure and manage the source
  manageable: boolean;
  // whether an error state offers a reconfigure action
  reconfigurable: boolean;
  // whether a sync is currently running for the source
  syncing: boolean;
  // the source's display name
  name: string;
  // the provider description, shown while the source is healthy
  description?: string;
  // what the provider offers
  labels?: readonly ProviderLabel[];
  // the access summary line; omitted hides it (a source the viewer cannot manage)
  accessSummary?: string | null;
  // the status badge variant; omitted hides the badge (a healthy source)
  statusVariant?: BadgeVariants["variant"];
  // a quiet status shown as an icon by the name instead of a badge
  statusIcon?: "loading" | "disabled";
  // the translated status label
  statusLabel?: string;
  // whether the status needs attention (auth required, incompatible, error or unavailable)
  isError?: boolean;
  // whether the row offers to remove it, for an entry that cannot be opened
  removable?: boolean;
  // the localized error reason
  errorText?: string;
  // whether a community member maintains the provider
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

const NAME_CLASS = "min-w-0 truncate text-[15px] leading-5 font-semibold";
// two lines while the row stacks, one in the columns
const LINE_CLASS =
  "m-0 mt-0.5 line-clamp-2 text-[13px] leading-[18px] @4xl:line-clamp-1";
const CELL_CLASS =
  "@4xl:line-clamp-2 @4xl:text-[13px] @4xl:leading-[18px] @4xl:text-foreground/80";

const { src: iconSrc, onDark } = useCatalogIcon(
  () => props.config.domain,
  null,
);

const menuLabel = computed(() => `${$t("more_options")}: ${props.name}`);

const offersShown = computed(
  () => getShownLabels(props.labels ?? []).length > 0,
);

const showReconfigure = computed(() => !!props.isError && props.reconfigurable);

const listRowClass = computed(() => [
  "flex-nowrap items-start gap-3 rounded-none border-0 p-3 @4xl:col-span-full @4xl:grid @4xl:min-h-[68px] @4xl:grid-cols-subgrid @4xl:items-center @4xl:gap-x-4 @4xl:px-4 @4xl:py-2.5",
  {
    "bg-destructive/5": props.isError,
    "cursor-pointer hover:bg-muted/50": props.manageable && !props.isError,
    "cursor-pointer hover:bg-destructive/8": props.manageable && props.isError,
    "opacity-60": !props.config.enabled,
  },
]);

// the badge only ever says a source needs attention, softly
const statusBadgeClass = computed(() => [
  "h-5 gap-1 rounded-md border-0 px-1.5 text-[11px] font-semibold",
  props.statusVariant === "destructive" &&
    "bg-destructive/10 text-destructive dark:bg-destructive/20",
]);

const onRootClick = function (evt: MouseEvent) {
  // a tap on an info icon opens its popover, not the provider
  if ((evt.target as Element).closest("[data-info-trigger]")) return;
  if (props.manageable) emit("open");
};

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(
  (evt: Event) => emit("menu", evt),
);

const onManageableHold = function (evt: Event) {
  if (props.manageable) onHold(evt);
};

const onContextMenu = function (evt: Event) {
  if (!props.manageable) return;
  evt.preventDefault();
  emit("menu", evt);
};
</script>
