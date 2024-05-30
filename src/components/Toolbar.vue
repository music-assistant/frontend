<template>
  <v-toolbar :color="color" class="header">
    <template v-if="icon" #prepend>
      <v-btn :icon="icon" size="large" @click="emit('iconClicked')" />
    </template>

    <template v-if="title" #title>
      {{ title }}
      <v-badge
        v-if="count && getBreakpointValue('bp4')"
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
        <v-menu
          v-if="menuItem.subItems?.length"
          location="bottom end"
          scrim
          density="compact"
          slim
          tile
        >
          <template #activator="{ props }">
            <v-btn
              variant="text"
              style="width: 40px"
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
            </v-btn>
          </template>
          <v-list>
            <v-list-item
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
            </v-list-item>
          </v-list>
        </v-menu>
        <!-- regular menuitem without subitems -->
        <v-btn
          v-else-if="
            !enforceOverflowMenu &&
            (getBreakpointValue('bp3') || menuItem.overflowAllowed == false)
          "
          variant="text"
          style="width: 40px"
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
        </v-btn>
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
        <v-menu location="bottom end" scrim>
          <template #activator="{ props }">
            <v-btn
              variant="plain"
              style="width: 15px; margin-left: -10px"
              v-bind="props"
            >
              <v-icon
                icon="mdi-dots-vertical"
                :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
                size="22"
                style="margin-right: -5px; width: 15px"
              />
            </v-btn>
          </template>
          <v-list density="compact" slim tile>
            <v-list-item
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
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-toolbar>
</template>

<script setup lang="ts">
import { ContextMenuItem } from '@/layouts/default/ItemContextMenu.vue';
import { getBreakpointValue } from '../plugins/breakpoint';

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

<style scoped>
.header.v-toolbar {
  height: 55px;
  font-family: 'JetBrains Mono Medium';
}

.header.v-toolbar >>> .v-toolbar__content > .v-toolbar__append {
  margin-right: 0px;
}

.header.v-toolbar > .v-toolbar__content > .v-toolbar-title {
  margin-inline-start: 10px;
}

.header.v-toolbar > .v-toolbar__content > .v-toolbar__prepend {
  margin-inline-start: 6px;
}

.header.v-toolbar > .v-toolbar__content > .v-toolbar__append {
  margin-inline-end: 21px;
}

.header.v-toolbar-default > .v-toolbar__content > .v-toolbar-title {
  margin-inline-start: 0px;
}

.header.v-toolbar-default > .v-toolbar__content > .v-toolbar__prepend {
  margin-inline-start: 10px;
}

.header.v-toolbar-default > .v-toolbar__content > .v-toolbar__append {
  margin-inline-end: 10px;
}
</style>
