<template>
  <v-dialog
    :model-value="show"
    @update:model-value="(val) => emit('update:show', val)"
    max-width="800"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        {{ $t("settings.add_group_player") }}
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="emit('update:show', false)"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0" style="height: 60vh">
        <v-list v-if="availableProviders.length > 0" lines="two">
          <v-list-item
            v-for="provider in availableProviders"
            :key="provider.instance_id"
            @click="addPlayerGroup(provider.instance_id)"
            :title="provider.name"
            link
          >
            <template #prepend>
              <ProviderIcon
                :domain="provider.domain"
                :size="40"
                class="mr-4"
              />
            </template>
            <template #subtitle>
              <div class="text-truncate">{{ provider.description }}</div>
            </template>
            <template #append>
              <v-icon icon="mdi-chevron-right" />
            </template>
          </v-list-item>
        </v-list>
        <div
          v-else
          class="d-flex flex-column align-center justify-center fill-height pa-6"
        >
          <v-icon icon="mdi-account-group" size="64" class="mb-4 text-disabled" />
          <div class="text-h6 text-medium-emphasis">{{ $t("no_content") }}</div>
          <div class="text-body-2 text-disabled">
            {{ $t("settings.no_group_providers") }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import { ProviderFeature } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import { useRouter } from "vue-router";

defineProps<{
  show: boolean;
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
  emit("update:show", false);
};
</script>
