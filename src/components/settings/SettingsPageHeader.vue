<template>
  <header
    class="flex flex-wrap items-start gap-x-4 gap-y-3"
    data-testid="settings-page-header"
  >
    <!-- a phone keeps the header to the title and its buttons -->
    <div class="shrink-0 max-md:hidden">
      <slot name="icon">
        <SettingsIcon
          v-if="heading"
          :icon="heading.icon"
          :color="heading.color"
          soft
          class="size-12 [&>svg]:size-6"
          data-testid="settings-page-icon"
        />
      </slot>
    </div>
    <!-- the buttons move below the title before it gets narrower than this -->
    <div class="min-w-0 flex-1 basis-40 self-center">
      <h1 class="m-0 text-2xl leading-tight font-semibold break-words">
        {{ title ?? (heading && $t(heading.label)) }}
      </h1>
      <p class="m-0 mt-1 text-sm text-muted-foreground max-md:hidden">
        {{ description ?? (heading && $t(heading.description)) }}
      </p>
    </div>
    <div
      v-if="$slots.actions || menuItems.length"
      class="flex shrink-0 items-center gap-1"
    >
      <slot name="actions" />
      <OverflowMenu v-if="menuItems.length" :items="menuItems">
        <Button
          variant="ghost"
          size="icon-sm"
          :title="$t('menu')"
          :aria-label="$t('menu')"
          data-testid="settings-page-menu"
        >
          <span class="relative inline-flex">
            <EllipsisVertical class="size-4" />
            <span
              v-if="menuActive"
              :class="ACTIVE_DOT_CLASS"
              data-testid="settings-page-menu-active"
            ></span>
          </span>
        </Button>
      </OverflowMenu>
    </div>
  </header>
</template>

<script setup lang="ts">
import OverflowMenu from "@/components/OverflowMenu.vue";
import SettingsIcon from "@/components/settings/SettingsIcon.vue";
import { Button } from "@/components/ui/button";
import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import { ACTIVE_DOT_CLASS } from "@/constants";
import { settingsHeading } from "@/helpers/settings_sections";
import { $t } from "@/plugins/i18n";
import { EllipsisVertical } from "@lucide/vue";
import { computed } from "vue";

/**
 * The header of a settings page: the icon of the page in its colour, its title
 * and description, and on the right its buttons and the menu the page
 * publishes.
 */
const props = defineProps<{
  // the key of the page in the settings menu, which gives its icon, title and
  // description
  page: string;
  // in place of the title and description of the page
  title?: string;
  description?: string;
}>();

defineSlots<{
  // in place of the icon of the page
  icon?(): unknown;
  // the buttons of the page, before its menu
  actions?(): unknown;
}>();

const heading = computed(() => settingsHeading(props.page));

const pageMenu = useSettingsPageMenu();
const menuItems = computed(() => pageMenu.value.filter((item) => !item.hide));
// an option that is on shows on the menu button
const menuActive = computed(() => menuItems.value.some((item) => item.active));
</script>
