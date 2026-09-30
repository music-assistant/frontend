<script setup lang="ts">
import StoragePath from "@/components/settings/storage/StoragePath.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import {
  formatNames,
  formatStorageSize,
  isManagedShare,
  isNamedByKind,
  isRegisteredFolder,
  networkShareAddress,
  SHARE_TYPE_LABEL_KEYS,
  STORAGE_KIND_ICONS,
  STORAGE_KIND_LABEL_KEYS,
  storageLocationName,
} from "@/helpers/storage";
import {
  MountBackend,
  type StorageLocation,
  StorageUsage,
} from "@/plugins/api/interfaces";
import {
  Database,
  HardDrive,
  Music,
  Pencil,
  RefreshCw,
  Trash2,
} from "@lucide/vue";
import { type Component, computed, useId } from "vue";
import { useI18n } from "vue-i18n";

/** A storage location on the Storage page, with the actions a managed one offers. */
const props = defineProps<{
  location: StorageLocation;
  // the sources to name under "Used by"; the location's own list when left out
  shownUsedBy?: string[];
  // the location may become the folder of a new music source
  canUseAsSource?: boolean;
  // a command runs on the page, so no action may start
  busy?: boolean;
  // the command running on this location, if any
  pending?: "reload" | "remove" | null;
}>();

const emit = defineEmits<{
  reload: [];
  edit: [];
  remove: [];
  useAsSource: [];
}>();

const { t, locale } = useI18n();

const isMedia = computed(() => props.location.usage === StorageUsage.MEDIA);
const name = computed(() => storageLocationName(props.location));

const icon = computed<Component>(() => {
  if (props.location.usage === StorageUsage.DATA) return Database;
  if (props.location.usage === StorageUsage.CACHE) return HardDrive;
  return STORAGE_KIND_ICONS[props.location.kind];
});

const shareSummary = computed(() => {
  const location = props.location;
  if (!isManagedShare(location)) return null;
  const named = {
    type: t(SHARE_TYPE_LABEL_KEYS[location.share_type]),
    address: networkShareAddress(
      location.share_type,
      location.server ?? "",
      location.share ?? "",
    ),
  };
  return location.backend === MountBackend.SUPERVISOR
    ? t("settings.storage.share_summary_via_ha", named)
    : t("settings.storage.share_summary", named);
});

const spaceText = computed(() => {
  const { free_space_gb, total_space_gb, used_space_gb } = props.location;
  const size = (gigabytes: number) =>
    formatStorageSize(gigabytes, locale.value);
  const parts: string[] = [];
  if (used_space_gb != null) {
    parts.push(t("settings.storage.used_space", [size(used_space_gb)]));
  }
  if (free_space_gb != null) {
    parts.push(
      total_space_gb != null
        ? t("settings.storage.free_of_total", [
            size(free_space_gb),
            size(total_space_gb),
          ])
        : t("settings.storage.free_space", [size(free_space_gb)]),
    );
  }
  return parts.join(" · ");
});

const blockedReasonId = useId();
const usedBy = computed(() => {
  const names = props.shownUsedBy ?? props.location.used_by;
  return names.length > 0 ? formatNames(names, locale.value) : null;
});
// sources whose folder holds this location lose its files with it, but do not block
const readBy = computed(() =>
  props.location.read_by.length > 0
    ? formatNames(props.location.read_by, locale.value)
    : null,
);

const canReloadOrEdit = computed(() => isManagedShare(props.location));
const canRemove = computed(
  () => isManagedShare(props.location) || isRegisteredFolder(props.location),
);
// the server refuses to remove a location a music source reads from; the reason
// names all of them, also those the row leaves to a location inside this one
const removeBlockedReason = computed(() => {
  const names = props.location.used_by;
  return names.length > 0
    ? t("settings.storage.remove_in_use", names.length, {
        named: { sources: formatNames(names, locale.value) },
      })
    : null;
});
</script>

<template>
  <Item
    variant="outline"
    data-testid="storage-location"
    :data-path="location.path"
  >
    <ItemMedia variant="icon">
      <component :is="icon" />
    </ItemMedia>
    <ItemContent class="min-w-0">
      <ItemTitle class="flex flex-wrap items-center gap-2">
        {{ name }}
        <Badge v-if="isMedia && !isNamedByKind(location)" variant="secondary">
          {{ t(STORAGE_KIND_LABEL_KEYS[location.kind]) }}
        </Badge>
        <Badge v-if="location.read_only" variant="outline">
          {{ t("settings.storage.read_only") }}
        </Badge>
        <Badge v-if="!location.available" variant="destructive">
          {{ t("settings.storage.unavailable") }}
        </Badge>
      </ItemTitle>
      <!-- a path, a reason or a list of sources is read in full, so these lines do
           not take the two-line clamp of ItemDescription -->
      <p class="text-muted-foreground m-0 text-sm leading-normal">
        <StoragePath :path="location.path" />
      </p>
      <ItemDescription v-if="shareSummary" data-testid="storage-share-summary">
        {{ shareSummary }}
      </ItemDescription>
      <p
        v-if="!location.available && location.error"
        class="text-destructive m-0 text-sm leading-normal"
        data-testid="storage-error"
      >
        {{ location.error }}
      </p>
      <p
        v-if="usedBy"
        class="text-muted-foreground m-0 text-sm leading-normal"
        data-testid="storage-used-by"
      >
        {{ t("settings.storage.used_by", { sources: usedBy }) }}
      </p>
      <p
        v-if="readBy"
        class="text-muted-foreground m-0 text-sm leading-normal"
        data-testid="storage-read-by"
      >
        {{ t("settings.storage.read_by", { sources: readBy }) }}
      </p>
      <ItemDescription v-if="spaceText">{{ spaceText }}</ItemDescription>
    </ItemContent>
    <ItemActions v-if="canUseAsSource || canReloadOrEdit || canRemove">
      <!-- on a phone the label would crowd the row, so it is left to the
           accessible name and the tooltip -->
      <Button
        v-if="canUseAsSource"
        variant="outline"
        size="sm"
        class="max-sm:size-8 max-sm:px-0"
        :disabled="busy || !!pending"
        :aria-label="`${t('settings.storage.use_as_source')}: ${name}`"
        :title="`${t('settings.storage.use_as_source')}: ${name}`"
        data-testid="storage-use-as-source"
        @click="emit('useAsSource')"
      >
        <Music />
        <span class="max-sm:hidden">
          {{ t("settings.storage.use_as_source") }}
        </span>
      </Button>
      <template v-if="canReloadOrEdit">
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="busy || !!pending"
          :aria-busy="pending === 'reload' || undefined"
          :aria-label="`${t('settings.reload')}: ${name}`"
          :title="`${t('settings.reload')}: ${name}`"
          data-testid="storage-reload"
          @click="emit('reload')"
        >
          <Spinner v-if="pending === 'reload'" />
          <RefreshCw v-else />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="busy || !!pending"
          :aria-label="`${t('edit')}: ${name}`"
          :title="`${t('edit')}: ${name}`"
          data-testid="storage-edit"
          @click="emit('edit')"
        >
          <Pencil />
        </Button>
      </template>
      <!-- a disabled button takes no pointer events, so its wrapper carries the
           tooltip that says why it can not be pressed -->
      <span
        v-if="canRemove"
        class="inline-flex"
        :title="removeBlockedReason ?? `${t('remove')}: ${name}`"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-destructive hover:text-destructive"
          :disabled="busy || !!pending || !!removeBlockedReason"
          :aria-busy="pending === 'remove' || undefined"
          :aria-label="`${t('remove')}: ${name}`"
          :aria-describedby="removeBlockedReason ? blockedReasonId : undefined"
          data-testid="storage-remove"
          @click="emit('remove')"
        >
          <Spinner v-if="pending === 'remove'" />
          <Trash2 v-else />
        </Button>
        <span v-if="removeBlockedReason" :id="blockedReasonId" class="sr-only">
          {{ removeBlockedReason }}
        </span>
      </span>
    </ItemActions>
  </Item>
</template>
