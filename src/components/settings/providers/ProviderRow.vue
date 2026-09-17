<template>
  <!-- list view: a horizontal row -->
  <Item
    v-if="variant === 'list'"
    variant="outline"
    :class="{ 'cursor-pointer': manageable, 'opacity-60': !config.enabled }"
    data-testid="provider-row"
    @click="onRootClick"
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
        <Badge
          v-if="statusVariant"
          :variant="statusVariant"
          data-testid="provider-status"
        >
          {{ statusLabel }}
        </Badge>
        <Badge
          v-if="stageLabel"
          variant="outline"
          class="uppercase"
          data-testid="stage-badge"
        >
          {{ stageLabel }}
        </Badge>
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
      <span v-if="syncing" :title="t('settings.sync_running')">
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
    class="provider-card flex h-full min-h-[200px] flex-col gap-3 py-4"
    :class="{
      'cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:shadow-lg':
        manageable,
      'opacity-60': !config.enabled,
    }"
    data-testid="provider-row"
    @click="onRootClick"
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
          <Badge
            v-if="statusVariant"
            :variant="statusVariant"
            data-testid="provider-status"
          >
            {{ statusLabel }}
          </Badge>
          <Badge
            v-if="stageLabel"
            variant="outline"
            class="uppercase"
            data-testid="stage-badge"
          >
            {{ stageLabel }}
          </Badge>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <span v-if="syncing" :title="t('settings.sync_running')">
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
        class="bg-destructive/8 rounded-lg px-3 py-2"
        data-testid="provider-error"
      >
        <div
          class="text-destructive flex items-center gap-1.5 text-sm font-medium"
        >
          <TriangleAlert class="size-4 shrink-0" />
          <span>{{ statusLabel }}</span>
        </div>
        <div class="text-muted-foreground mt-1 line-clamp-2 text-xs">
          {{ errorText }}
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
import type { ProviderConfig } from "@/plugins/api/interfaces";
import { MoreVertical, RefreshCw, TriangleAlert } from "@lucide/vue";
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
  // the translated status label
  statusLabel?: string;
  // whether the status needs attention (auth required, incompatible or error)
  isError?: boolean;
  // the localized error reason
  errorText?: string;
  // the translated stage label; empty hides the stage badge
  stageLabel?: string;
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
</script>
