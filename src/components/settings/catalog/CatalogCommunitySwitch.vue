<template>
  <Item
    variant="outline"
    class="rounded-(--radius-xl)"
    data-testid="community-switch"
  >
    <ItemMedia variant="icon">
      <UsersRound aria-hidden="true" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ title }}</ItemTitle>
      <ItemDescription
        v-if="status === 'unavailable'"
        data-testid="community-unavailable"
      >
        {{ $t("settings.catalog.community.unavailable") }}
      </ItemDescription>
      <ItemDescription v-else :id="descriptionId">
        {{ $t("settings.catalog.community.switch_description") }}
      </ItemDescription>
    </ItemContent>
    <ItemActions>
      <Spinner v-if="status === 'loading'" class="size-4" />
      <Button
        v-else-if="status === 'unavailable'"
        variant="outline"
        size="sm"
        data-testid="community-retry"
        @click="emit('retry')"
      >
        <RefreshCw class="size-4" aria-hidden="true" />
        {{ $t("settings.retry") }}
      </Button>
      <Switch
        v-else
        :model-value="enabled"
        :disabled="saving"
        :aria-label="$t('settings.catalog.community.switch_label')"
        :aria-describedby="descriptionId"
        data-testid="community-switch-toggle"
        @update:model-value="emit('update:enabled', $event)"
      />
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
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
import { Switch } from "@/components/ui/switch";
import type { CommunityCatalogStatus } from "@/composables/settings/catalog/useCommunityCatalog";
import { $t } from "@/plugins/i18n";
import { RefreshCw, UsersRound } from "@lucide/vue";
import { computed, useId } from "vue";

interface Props {
  status: CommunityCatalogStatus;
  enabled: boolean;
  saving: boolean;
  // the name the server gives the community catalog
  label?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:enabled", value: boolean): void;
  (e: "retry"): void;
}>();

const descriptionId = useId();

const title = computed(
  () => props.label || $t("settings.catalog.community.title"),
);
</script>
