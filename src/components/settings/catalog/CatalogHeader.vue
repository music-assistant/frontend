<template>
  <SettingsPageHeader page="catalog">
    <template #actions>
      <Button
        :variant="installedOpen ? 'secondary' : 'outline'"
        size="sm"
        :aria-pressed="installedOpen"
        data-testid="catalog-installed-button"
        @click="emit('toggle-installed')"
      >
        {{ $t("settings.catalog.installed") }}
        <span
          v-if="installedCount !== null"
          class="text-muted-foreground"
          data-testid="catalog-installed-count"
          >{{ installedCount }}</span
        >
        <Badge
          v-if="updateCount"
          class="h-5 min-w-5 rounded-full px-1.5"
          :aria-label="
            $t('settings.catalog.community.updates_waiting', updateCount, {
              named: { count: updateCount },
            })
          "
          data-testid="catalog-updates-count"
        >
          {{ updateCount }}
        </Badge>
      </Button>
      <Button
        v-if="menuItems"
        data-testid="catalog-menu"
        variant="ghost"
        size="icon-sm"
        aria-haspopup="menu"
        :aria-label="$t('more_options')"
        :disabled="menuDisabled"
        @click="openMenu"
      >
        <MoreVertical class="size-4" />
      </Button>
    </template>
  </SettingsPageHeader>
</template>

<script setup lang="ts">
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MoreVertical } from "@lucide/vue";

interface Props {
  // what is set up, or null while it is not known
  installedCount: number | null;
  // the updates waiting in the community catalog
  updateCount: number;
  // whether the Installed view is shown
  installedOpen: boolean;
  // the options of the page; no menu without them
  menuItems?: () => ContextMenuItem[];
  menuDisabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "toggle-installed"): void;
}>();

// the menu opens under its button, so it never covers the title, whether it
// was tapped, clicked or opened from the keyboard
const openMenu = (evt: MouseEvent) => {
  const trigger = (evt.currentTarget as HTMLElement).getBoundingClientRect();
  eventbus.emit("contextmenu", {
    items: props.menuItems!(),
    posX: trigger.left,
    posY: trigger.bottom,
  });
};
</script>
