<script setup lang="ts">
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
  formatStorageSize,
  isManagedShare,
  isRegisteredFolder,
  networkShareAddress,
  SHARE_TYPE_LABEL_KEYS,
  STORAGE_KIND_ICONS,
  STORAGE_KIND_LABEL_KEYS,
} from "@/helpers/storage";
import {
  MountBackend,
  type StorageLocation,
  StorageUsage,
} from "@/plugins/api/interfaces";
import { Database, HardDrive, Pencil, RefreshCw, Trash2 } from "@lucide/vue";
import { type Component, computed } from "vue";
import { useI18n } from "vue-i18n";

/** A storage location on the Storage page, with the actions a managed one offers. */
const props = defineProps<{
  location: StorageLocation;
  // whether the viewer may change the storage
  manageable?: boolean;
  // the command running on this location, if any
  pending?: "reload" | "remove" | null;
}>();

const emit = defineEmits<{ reload: []; edit: []; remove: [] }>();

const { t, locale } = useI18n();

const isMedia = computed(() => props.location.usage === StorageUsage.MEDIA);

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

const canReloadOrEdit = computed(
  () => props.manageable && isManagedShare(props.location),
);
const canRemove = computed(
  () =>
    props.manageable &&
    (isManagedShare(props.location) || isRegisteredFolder(props.location)),
);
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
        {{ location.name }}
        <Badge v-if="isMedia" variant="secondary">
          {{ t(STORAGE_KIND_LABEL_KEYS[location.kind]) }}
        </Badge>
        <Badge v-if="location.read_only" variant="outline">
          {{ t("settings.storage.read_only") }}
        </Badge>
        <Badge v-if="!location.available" variant="destructive">
          {{ t("settings.storage.unavailable") }}
        </Badge>
      </ItemTitle>
      <ItemDescription class="break-all">{{ location.path }}</ItemDescription>
      <ItemDescription v-if="shareSummary" data-testid="storage-share-summary">
        {{ shareSummary }}
      </ItemDescription>
      <ItemDescription
        v-if="!location.available && location.error"
        class="text-destructive"
      >
        {{ location.error }}
      </ItemDescription>
      <ItemDescription v-if="spaceText">{{ spaceText }}</ItemDescription>
    </ItemContent>
    <ItemActions v-if="canReloadOrEdit || canRemove">
      <template v-if="canReloadOrEdit">
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!!pending"
          :aria-busy="pending === 'reload' || undefined"
          :aria-label="`${t('settings.reload')}: ${location.name}`"
          :title="`${t('settings.reload')}: ${location.name}`"
          data-testid="storage-reload"
          @click="emit('reload')"
        >
          <Spinner v-if="pending === 'reload'" />
          <RefreshCw v-else />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!!pending"
          :aria-label="`${t('edit')}: ${location.name}`"
          :title="`${t('edit')}: ${location.name}`"
          data-testid="storage-edit"
          @click="emit('edit')"
        >
          <Pencil />
        </Button>
      </template>
      <Button
        v-if="canRemove"
        variant="ghost"
        size="icon-sm"
        class="text-destructive hover:text-destructive"
        :disabled="!!pending"
        :aria-busy="pending === 'remove' || undefined"
        :aria-label="`${t('remove')}: ${location.name}`"
        :title="`${t('remove')}: ${location.name}`"
        data-testid="storage-remove"
        @click="emit('remove')"
      >
        <Spinner v-if="pending === 'remove'" />
        <Trash2 v-else />
      </Button>
    </ItemActions>
  </Item>
</template>
