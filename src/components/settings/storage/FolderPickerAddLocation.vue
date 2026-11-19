<script setup lang="ts">
import LocalFolderDialog from "@/components/settings/storage/LocalFolderDialog.vue";
import NetworkShareDialog from "@/components/settings/storage/NetworkShareDialog.vue";
import { Button } from "@/components/ui/button";
import type { ShareType, StorageLocation } from "@/plugins/api/interfaces";
import { FolderPlus, Plus } from "@lucide/vue";
import { ref } from "vue";

/**
 * The buttons of a folder picker that add a network share or a folder on the server,
 * each in its own dialog on top of the one the picker is in.
 */
defineProps<{
  canAddShare: boolean;
  canAddFolder: boolean;
  // the share types this install can mount
  shareTypes: ShareType[];
  // the protocol versions this install can honour per share type
  shareVersions: Partial<Record<ShareType, string[]>>;
  disabled?: boolean;
}>();

const emit = defineEmits<{ added: [location: StorageLocation] }>();

const showShareDialog = ref(false);
const showFolderDialog = ref(false);
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Button
      v-if="canAddShare"
      type="button"
      variant="outline"
      size="sm"
      :disabled="disabled"
      data-testid="folder-picker-add-share"
      @click="showShareDialog = true"
    >
      <Plus />
      {{ $t("settings.storage.add_network_share") }}
    </Button>
    <Button
      v-if="canAddFolder"
      type="button"
      variant="outline"
      size="sm"
      :disabled="disabled"
      data-testid="folder-picker-add-folder"
      @click="showFolderDialog = true"
    >
      <FolderPlus />
      {{ $t("settings.storage.add_local_folder") }}
    </Button>
    <NetworkShareDialog
      v-if="canAddShare"
      v-model:open="showShareDialog"
      :location="null"
      :share-types="shareTypes"
      :share-versions="shareVersions"
      @added="emit('added', $event)"
    />
    <LocalFolderDialog
      v-if="canAddFolder"
      v-model:open="showFolderDialog"
      @added="emit('added', $event)"
    />
  </div>
</template>
