<template>
  <!-- on a phone the buttons join the title row, and the search takes a row
       of its own under it -->
  <SettingsPageHeader page="catalog" actions-class="max-md:contents">
    <template #actions>
      <SearchInput
        v-if="searchable"
        v-model="search"
        :placeholder="$t('settings.catalog.search')"
        clearable
        class="w-80 max-md:order-last max-md:w-full"
      />
      <Button
        v-if="menuItems"
        data-testid="catalog-menu"
        variant="ghost"
        size="icon-sm"
        class="max-md:self-center"
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
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MoreVertical } from "@lucide/vue";

interface Props {
  // whether the page can be searched
  searchable: boolean;
  // the options of the page; no menu without them
  menuItems?: () => ContextMenuItem[];
  menuDisabled?: boolean;
}

const props = defineProps<Props>();

const search = defineModel<string>("search", { required: true });

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
