<template>
  <!-- list view: a horizontal row -->
  <Item
    v-if="variant === 'list'"
    v-hold="onManageableHold"
    variant="outline"
    class="rounded-(--radius-xl)"
    :class="{ 'cursor-pointer': manageable, 'opacity-60': !config.enabled }"
    data-testid="provider-row"
    @click.capture="swallowClickAfterHold"
    @click="onRootClick"
    @click.right="onContextMenu"
    @touchstart.passive="onTouchStart"
  >
    <ItemMedia>
      <ProviderIcon :domain="config.domain" :size="40" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle class="flex flex-wrap items-center gap-2">
        <!-- the name is the focusable control; the row itself only follows the pointer -->
        <button
          v-if="manageable"
          type="button"
          class="cursor-pointer text-left"
          data-testid="provider-open"
          @click.stop="emit('open')"
        >
          {{ name }}
        </button>
        <span v-else>{{ name }}</span>
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
          data-testid="provider-status"
        >
          {{ statusLabel }}
        </Badge>
        <CommunityProviderMarker v-if="community" variant="icon" />
      </ItemTitle>
      <ItemDescription v-if="isError" class="text-destructive">
        {{ errorText }}
      </ItemDescription>
      <ItemDescription v-else-if="description">
        {{ description }}
      </ItemDescription>
      <ItemDescription v-if="accessSummary" data-testid="provider-access">
        {{ accessSummary }}
      </ItemDescription>
    </ItemContent>
    <ItemActions>
      <span
        v-if="syncing"
        role="status"
        :aria-label="t('settings.sync_running')"
        :title="t('settings.sync_running')"
      >
        <RefreshCw class="text-muted-foreground size-4 animate-spin" />
      </span>
      <Button
        v-if="isError && reconfigurable"
        size="sm"
        variant="destructive"
        data-testid="provider-action"
        @click.stop="emit('reconfigure')"
      >
        {{ t("settings.reconfigure") }}
      </Button>
      <Button
        v-if="manageable"
        variant="ghost"
        size="icon-sm"
        data-testid="provider-menu"
        :aria-label="menuLabel"
        @click.stop="emit('menu', $event)"
      >
        <MoreVertical class="size-4" />
      </Button>
    </ItemActions>
  </Item>

  <!-- card view: a vertical card carrying the same information -->
  <Card
    v-else
    v-hold="onManageableHold"
    class="provider-card flex h-full min-h-[200px] flex-col gap-3 rounded-(--radius-xl) py-4"
    :class="{
      'card-hover': manageable,
      'opacity-60': !config.enabled,
    }"
    data-testid="provider-row"
    @click.capture="swallowClickAfterHold"
    @click="onRootClick"
    @click.right="onContextMenu"
    @touchstart.passive="onTouchStart"
  >
    <div class="flex items-start gap-3 px-4">
      <ProviderIcon :domain="config.domain" :size="50" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="manageable"
            type="button"
            class="cursor-pointer text-left text-base font-semibold"
            data-testid="provider-open"
            @click.stop="emit('open')"
          >
            {{ name }}
          </button>
          <span v-else class="text-base font-semibold">{{ name }}</span>
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
            data-testid="provider-status"
          >
            {{ statusLabel }}
          </Badge>
          <CommunityProviderMarker v-if="community" variant="icon" />
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <span
          v-if="syncing"
          role="status"
          :aria-label="t('settings.sync_running')"
          :title="t('settings.sync_running')"
        >
          <RefreshCw class="text-muted-foreground size-4 animate-spin" />
        </span>
        <Button
          v-if="manageable"
          variant="ghost"
          size="icon-sm"
          data-testid="provider-menu"
          :aria-label="menuLabel"
          :title="menuLabel"
          @click.stop="emit('menu', $event)"
        >
          <MoreVertical class="size-4" />
        </Button>
      </div>
    </div>

    <div class="flex-1 px-4">
      <div
        v-if="isError"
        class="bg-destructive/8 rounded-(--radius-lg) px-3 py-2"
        data-testid="provider-error"
      >
        <!-- the status shows in the badge by the name; the panel adds the reason -->
        <div class="text-destructive flex items-start gap-1.5 text-sm">
          <TriangleAlert class="mt-0.5 size-4 shrink-0" />
          <span class="line-clamp-2">{{ errorText }}</span>
        </div>
        <Button
          v-if="reconfigurable"
          size="sm"
          variant="destructive"
          class="mt-2 w-full"
          data-testid="provider-action"
          @click.stop="emit('reconfigure')"
        >
          {{ t("settings.reconfigure") }}
        </Button>
      </div>
      <p
        v-else-if="description"
        class="text-muted-foreground m-0 line-clamp-3 text-sm leading-normal"
      >
        {{ description }}
      </p>
    </div>

    <div
      v-if="accessSummary"
      class="text-muted-foreground px-4 text-xs"
      data-testid="provider-access"
    >
      {{ accessSummary }}
    </div>
  </Card>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import CommunityProviderMarker from "@/components/settings/providers/CommunityProviderMarker.vue";
import TooltipIcon from "@/components/TooltipIcon.vue";
import { Badge, type BadgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import type { ProviderConfig } from "@/plugins/api/interfaces";
import { Ban, MoreVertical, RefreshCw, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  config: ProviderConfig;
  variant: "list" | "card";
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
  // the access summary line; omitted hides it (a source the viewer cannot manage)
  accessSummary?: string | null;
  // the status badge variant; omitted hides the badge (a healthy source)
  statusVariant?: BadgeVariants["variant"];
  // a quiet status shown as an icon by the name instead of a badge
  statusIcon?: "loading" | "disabled";
  // the translated status label
  statusLabel?: string;
  // whether the status needs attention (auth required, incompatible or error)
  isError?: boolean;
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
}>();

const { t } = useI18n();

const menuLabel = computed(() => `${t("more_options")}: ${props.name}`);

const onRootClick = function () {
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
