<script setup lang="ts">
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DOCKER_DOCS_URL, STORAGE_DOCS_URL } from "@/helpers/storage";
import { getExternalLinkUrl } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { HardDrive } from "@lucide/vue";
import { computed } from "vue";

/**
 * What a folder picker shows when there is no location to pick from, with how to get
 * one. The buttons that add a location go in the default slot.
 */
defineProps<{
  canManageStorage: boolean;
  // this server lets the user add a location from the picker
  canAdd: boolean;
}>();

// the docs of a beta server live on the beta site
const dockerDocsUrl = computed(() => getExternalLinkUrl(DOCKER_DOCS_URL));
const storageDocsUrl = computed(() => getExternalLinkUrl(STORAGE_DOCS_URL));
const runsAsHomeAssistantApp = computed(
  () => !!api.serverInfo.value?.homeassistant_addon,
);
</script>

<template>
  <Empty class="border" data-testid="folder-picker-empty">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <HardDrive />
      </EmptyMedia>
      <EmptyTitle>{{ $t("settings.folder_picker.empty_title") }}</EmptyTitle>
      <EmptyDescription>
        <template v-if="!canManageStorage">
          {{ $t("settings.folder_picker.empty_text_member") }}
        </template>
        <template v-else-if="canAdd">
          {{ $t("settings.folder_picker.empty_text_add") }}
        </template>
        <!-- a Home Assistant app gets its network shares from Home Assistant -->
        <template v-else-if="runsAsHomeAssistantApp">
          {{ $t("settings.storage.cannot_mount_ha_text") }}
          <a
            :href="storageDocsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary"
            data-testid="folder-picker-docs"
          >
            {{ $t("settings.storage.cannot_mount_link") }}
          </a>
        </template>
        <!-- a container can only use the folders mapped into it -->
        <template v-else>
          {{ $t("settings.folder_picker.empty_text_container") }}
          <a
            :href="dockerDocsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary"
            data-testid="folder-picker-docs"
          >
            {{ $t("settings.storage.cannot_mount_link") }}
          </a>
        </template>
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent v-if="canManageStorage && canAdd">
      <slot />
    </EmptyContent>
  </Empty>
</template>
