<template>
  <Dialog v-model:open="model">
    <DialogContent
      class="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[560px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader class="border-b px-5 py-4 pr-12 text-left">
        <DialogTitle>
          {{ $t(`settings.hass_controls.title.${controlType}`) }}
        </DialogTitle>
      </DialogHeader>

      <div class="px-5 py-4">
        <SearchInput
          :model-value="search"
          :aria-label="$t('settings.hass_controls.search_placeholder')"
          :placeholder="$t('settings.hass_controls.search_placeholder')"
          clearable
          @update:model-value="onSearchInput"
        />
      </div>

      <div
        class="min-h-[180px] flex-1 overflow-y-auto px-5 pb-4"
        :class="{ 'opacity-60': loading }"
      >
        <div
          v-if="loading && groups.length === 0"
          class="flex justify-center py-10"
        >
          <Spinner class="text-primary size-8" />
        </div>
        <p v-else-if="error" class="text-destructive py-8 text-center text-sm">
          {{ error }}
        </p>
        <p
          v-else-if="groups.length === 0"
          class="text-muted-foreground py-8 text-center text-sm"
        >
          {{ $t("settings.hass_controls.no_results") }}
        </p>
        <template v-else>
          <div
            v-for="group of groups"
            :key="groupKey(group)"
            class="entity-group mb-3 last:mb-0"
          >
            <div
              class="text-muted-foreground mb-1 flex items-baseline gap-2 border-b pb-1 text-xs"
            >
              <span class="min-w-0 truncate font-semibold">
                {{
                  group.device_name || $t("settings.hass_controls.no_device")
                }}
              </span>
              <span class="min-w-0 truncate">
                {{ group.area_name || $t("settings.hass_controls.no_area") }}
              </span>
            </div>
            <button
              v-for="entity of group.entities"
              :key="entity.entity_id"
              type="button"
              class="entity-option hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left disabled:pointer-events-none disabled:opacity-50"
              :disabled="isAdded(entity)"
              @click="pick(entity)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{{ entity.name }}</span>
                <span class="text-muted-foreground block truncate text-xs">
                  {{ entity.entity_id }}
                </span>
              </span>
              <Badge v-if="isAdded(entity)" variant="secondary">
                {{ $t("settings.hass_controls.already_added") }}
              </Badge>
              <template v-else>
                <Badge
                  v-for="role of extraRoles(entity)"
                  :key="role"
                  variant="outline"
                >
                  {{ $t(`settings.hass_controls.role.${role}`) }}
                </Badge>
              </template>
            </button>
          </div>
          <p
            v-if="truncated"
            class="text-muted-foreground pt-2 text-center text-xs"
          >
            {{ $t("settings.hass_controls.truncated") }}
          </p>
        </template>
      </div>

      <DialogFooter class="border-t px-5 py-3">
        <Button type="button" variant="outline" @click="model = false">
          {{ $t("close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import type { HassControlKey } from "@/helpers/config_entry_ui";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import {
  searchHassControlEntities,
  type HassControlEntity,
  type HassControlEntityGroup,
} from "@/helpers/hass_controls";
import { $t } from "@/plugins/i18n";
import { onBeforeUnmount, ref, watch } from "vue";

const SEARCH_THROTTLE_MS = 400;

const CAPABILITY_BY_CONTROL_KEY = {
  power_controls: "power",
  volume_controls: "volume",
  mute_controls: "mute",
} as const;

const CAPABILITIES = ["power", "volume", "mute"] as const;

const props = defineProps<{
  controlType: HassControlKey;
  // entities already registered for this role, offered but not pickable again
  addedEntityIds?: string[];
}>();

const model = defineModel<boolean>();

const emit = defineEmits<{ pick: [entity: HassControlEntity] }>();

const search = ref("");
const loading = ref(false);
const error = ref("");
const groups = ref<HassControlEntityGroup[]>([]);
const truncated = ref(false);
const searchThrottle = ref<number | undefined>();
let searchRequestId = 0;

watch(model, (open) => {
  // also on close, or a search scheduled just before it still reaches Home Assistant
  clearTimeout(searchThrottle.value);
  if (!open) return;
  search.value = "";
  groups.value = [];
  truncated.value = false;
  error.value = "";
  void runSearch();
});

onBeforeUnmount(() => {
  clearTimeout(searchThrottle.value);
});

const onSearchInput = (value: string) => {
  search.value = value;
  clearTimeout(searchThrottle.value);
  searchThrottle.value = window.setTimeout(
    () => void runSearch(),
    SEARCH_THROTTLE_MS,
  );
};

const isAdded = (entity: HassControlEntity) =>
  props.addedEntityIds?.includes(entity.entity_id) ?? false;

// every result can serve the role the picker was opened for, so only the other roles an
// entity can take on tell the user something new
const extraRoles = (entity: HassControlEntity) =>
  CAPABILITIES.filter(
    (capability) =>
      capability !== CAPABILITY_BY_CONTROL_KEY[props.controlType] &&
      entity[capability],
  );

// a device with entities in several areas is reported once per area
const groupKey = (group: HassControlEntityGroup) =>
  `${group.device_id ?? ""}|${group.area_name ?? ""}`;

const pick = (entity: HassControlEntity) => {
  model.value = false;
  emit("pick", entity);
};

const runSearch = async () => {
  const requestId = ++searchRequestId;
  loading.value = true;
  try {
    const result = await searchHassControlEntities(
      props.controlType,
      search.value,
    );
    if (requestId !== searchRequestId) return;
    groups.value = result.groups;
    truncated.value = result.truncated;
    error.value = "";
  } catch {
    if (requestId !== searchRequestId) return;
    groups.value = [];
    truncated.value = false;
    error.value = $t("settings.hass_controls.search_failed");
  } finally {
    if (requestId === searchRequestId) loading.value = false;
  }
};
</script>
