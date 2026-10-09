<template>
  <Dialog :open="show" @update:open="handleOpenChange">
    <DialogContent
      class="flex h-[60vh] max-h-[60vh] max-w-[800px] flex-col gap-0 p-0"
    >
      <DialogHeader class="border-b px-5 py-4 pr-12 text-left">
        <DialogTitle>{{ $t("settings.add_group_player") }}</DialogTitle>
      </DialogHeader>

      <div
        class="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        data-testid="provider-list"
      >
        <ItemGroup v-if="availableProviders.length > 0" class="gap-2">
          <Item
            v-for="provider in availableProviders"
            :key="provider.instance_id"
            variant="outline"
            size="sm"
            class="hover:bg-accent/50 cursor-pointer"
            data-testid="provider-row"
            @click="addPlayerGroup(provider.instance_id)"
          >
            <ItemMedia>
              <ProviderIcon :domain="provider.domain" :size="40" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                <!-- the name is the focusable control; the row itself only follows the pointer -->
                <button
                  type="button"
                  class="cursor-pointer text-left"
                  data-testid="provider-open"
                  @click.stop="addPlayerGroup(provider.instance_id)"
                >
                  {{ provider.name }}
                </button>
              </ItemTitle>
              <ItemDescription>{{ provider.description }}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight class="text-muted-foreground size-4" />
            </ItemActions>
          </Item>
        </ItemGroup>

        <Empty v-else class="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{{ $t("no_content") }}</EmptyTitle>
            <EmptyDescription>
              {{ $t("settings.no_group_providers") }}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { api } from "@/plugins/api";
import { ProviderFeature } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ChevronRight, Users } from "@lucide/vue";
import { computed } from "vue";
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
        x.supported_features.includes(ProviderFeature.CREATE_GROUP_PLAYER),
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
</script>
