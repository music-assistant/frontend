<template>
  <Dialog :open="show" @update:open="handleOpenChange">
    <DialogContent
      class="add-player-group-dialog max-w-[800px] h-[60vh] max-h-[60vh] flex flex-col p-0"
    >
      <DialogHeader class="px-6 pt-6 pb-4 flex-shrink-0">
        <DialogTitle>{{ $t("settings.add_group_player") }}</DialogTitle>
      </DialogHeader>

      <div
        class="provider-list-container px-6 pt-2 pb-6 flex-1 min-h-0 overflow-y-auto"
      >
        <div v-if="availableProviders.length > 0" class="provider-list">
          <div
            v-for="provider in availableProviders"
            :key="provider.instance_id"
            class="provider-item"
            @click="addPlayerGroup(provider.instance_id)"
          >
            <provider-icon
              :domain="provider.domain"
              :size="40"
              class="provider-icon"
            />
            <div class="provider-content">
              <div class="provider-name">{{ provider.name }}</div>
              <div class="provider-description">
                {{ provider.description }}
              </div>
            </div>
            <ChevronRight class="h-4 w-4 flex-shrink-0" />
          </div>
        </div>

        <div v-else class="empty-state">
          <Users class="empty-icon" />
          <div class="empty-title">{{ $t("no_content") }}</div>
          <div class="empty-message">
            {{ $t("settings.no_group_providers") }}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/plugins/api";
import { ProviderFeature } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ChevronRight, Users } from "lucide-vue-next";
import { computed, watch } from "vue";
import { useRouter } from "vue-router";

const { show = false } = defineProps<{
  show?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
}>();

const router = useRouter();

const availableProviders = computed(() => {
  return Object.values(api.providers)
    .filter(
      (x) =>
        x.available &&
        (x.supported_features.includes(ProviderFeature.CREATE_GROUP_PLAYER) ||
          x.supported_features.includes(ProviderFeature.SYNC_PLAYERS)) &&
        // Only include providers that have actual players
        Object.values(api.players).some(
          (player) => player.provider === x.instance_id,
        ),
    )
    .map((x) => ({
      instance_id: x.instance_id,
      domain: x.domain,
      name: x.name || api.providerManifests[x.domain]?.name || x.domain,
      description:
        api.providerManifests[x.domain]?.description ||
        $t("settings.playerprovider"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const addPlayerGroup = function (instanceId: string) {
  router.push(`/settings/addgroup/${instanceId}`);
  close();
};

const handleOpenChange = (open: boolean) => {
  store.dialogActive = open;
  emit("update:show", open);
};

const close = function () {
  emit("update:show", false);
};

watch(
  () => api.providers,
  () => {},
  { immediate: true },
);
</script>

<style scoped>
.add-player-group-dialog {
  display: flex;
  flex-direction: column;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.provider-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
  transform: translateY(-1px);
}

.provider-icon {
  flex-shrink: 0;
}

.provider-content {
  flex: 1;
  min-width: 0;
}

.provider-name {
  font-weight: 500;
  font-size: 16px;
  line-height: 1.2;
  margin-bottom: 4px;
}

.provider-description {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 2.6em;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.4;
}
</style>
