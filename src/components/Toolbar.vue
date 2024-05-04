<template>
  <v-toolbar :color="color">
    <template v-if="icon" #prepend>
      <v-icon
        :icon="icon"
        size="large"
        style="margin-left: 10px"
        @click="emit('iconClicked')"
      />
    </template>

    <template v-if="title" #title>
      {{ title }}
      <v-badge
        v-if="count !== undefined && getBreakpointValue('bp4')"
        color="grey"
        :content="count"
        inline
      />
    </template>

    <template v-if="menuItems?.length" #append>
      <div
        v-for="menuItem of menuItems.filter((x) => !x.hide)"
        :key="menuItem.label"
      >
        <!-- menu item with subitems -->
        <v-menu v-if="menuItem.subItems?.length" location="bottom end">
          <template #activator="{ props }">
            <Button
              variant="list"
              style="width: 50px"
              v-bind="props"
              :title="$t(menuItem.label, menuItem.labelArgs || [])"
              :disabled="menuItem.disabled == true"
            >
              <v-badge :model-value="menuItem.active == true" color="error" dot>
                <v-icon
                  :icon="menuItem.icon"
                  :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
                  size="22px"
                />
              </v-badge>
            </Button>
          </template>
          <v-list>
            <ListItem
              v-for="(subItem, index) in menuItem.subItems.filter(
                (x) => x.hide != true,
              )"
              :key="index"
              :title="$t(subItem.label, subItem.labelArgs || [])"
              :disabled="subItem.disabled == true"
              @click="subItem.action ? subItem.action() : ''"
            >
              <template v-if="subItem.icon" #prepend>
                <v-icon :icon="subItem.icon" />
              </template>
              <template #append>
                <v-icon v-if="subItem.selected" icon="mdi-check" />
              </template>
            </ListItem>
          </v-list>
        </v-menu>
        <!-- regular menuitem without subitems -->
        <Button
          v-else-if="
            !enforceOverflowMenu &&
            (getBreakpointValue('bp3') || menuItem.overflowAllowed == false)
          "
          variant="list"
          style="width: 50px"
          :title="$t(menuItem.label, menuItem.labelArgs || [])"
          :disabled="menuItem.disabled == true"
          @click="menuItem.action"
        >
          <v-badge :model-value="menuItem.active == true" color="error" dot>
            <v-icon
              :icon="menuItem.icon"
              :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
              size="22px"
            />
          </v-badge>
        </Button>
      </div>

      <!-- overflow menu with (remaining) items if on mobile -->
      <div
        v-if="
          (!getBreakpointValue('bp3') || enforceOverflowMenu) &&
          menuItems.filter(
            (x) =>
              x.hide != true &&
              !x.subItems?.length &&
              x.overflowAllowed !== false,
          ).length
        "
      >
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <Button
              variant="list"
              style="width: 20px; margin-left: -15px"
              v-bind="props"
            >
              <v-icon
                icon="mdi-dots-vertical"
                :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
                size="22"
                style="margin-right: -15px; width: 20px"
              />
            </Button>
          </template>
          <v-list>
            <ListItem
              v-for="(menuItem, index) in menuItems.filter(
                (x) =>
                  x.hide != true &&
                  !x.subItems?.length &&
                  x.overflowAllowed !== false,
              )"
              :key="index"
              :title="$t(menuItem.label, menuItem.labelArgs || [])"
              :disabled="menuItem.disabled == true"
              @click="menuItem.action ? menuItem.action() : ''"
            >
              <template v-if="menuItem.icon" #prepend>
                <v-badge
                  :model-value="menuItem.active == true"
                  color="error"
                  dot
                >
                  <v-icon
                    :icon="menuItem.icon"
                    :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
                    size="22px"
                  />
                </v-badge>
              </template>
            </ListItem>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-toolbar>
</template>

<script setup lang="ts">
import Button from './mods/Button.vue';
import { ContextMenuItem } from '../helpers/contextmenu';
import { getBreakpointValue } from '../plugins/breakpoint';
import ListItem from './mods/ListItem.vue';

// properties
export interface Props {
  color?: string;
  icon?: string;
  title?: string;
  count?: number;
  menuItems?: ToolBarMenuItem[];
  enforceOverflowMenu?: boolean;
}
withDefaults(defineProps<Props>(), {
  color: 'transparent',
  icon: undefined,
  title: undefined,
  count: undefined,
  menuItems: undefined,
  enforceOverflowMenu: false,
});

// emitters
const emit = defineEmits<{
  (e: 'iconClicked'): void;
}>();
</script>

<script lang="ts">
export interface ToolBarMenuItem extends ContextMenuItem {
  active?: boolean;
  subItems?: ContextMenuItem[];
  overflowAllowed?: boolean;
}
</script>

<style>
.v-toolbar {
  height: 55px;
}

.v-toolbar-title {
  font-family: 'JetBrains Mono Medium';
}

.v-toolbar__content {
  height: 100% !important;
}

.v-toolbar > .v-toolbar__content > .v-toolbar-title {
  margin-inline-start: 25px;
}

.v-toolbar > .v-toolbar__content > .v-toolbar__prepend {
  margin-inline-start: 6px;
}

.v-toolbar > .v-toolbar__content > .v-toolbar__append {
  margin-inline-end: 21px;
}

.v-toolbar-default > .v-toolbar__content > .v-toolbar-title {
  margin-inline-start: 16px;
}

.v-toolbar-default > .v-toolbar__content > .v-toolbar__prepend {
  margin-inline-start: 10px;
}

.v-toolbar-default > .v-toolbar__content > .v-toolbar__append {
  margin-inline-end: 10px;
}
</style>
