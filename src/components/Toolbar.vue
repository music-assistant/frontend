<template>
  <v-toolbar :color="color" class="header">
    <template
      v-if="
        (!getBreakpointValue({ breakpoint: 'tablet' }) || iconAction) && icon
      "
      #prepend
    >
      <v-btn
        :icon="icon"
        size="large"
        :disabled="iconAction == null"
        style="opacity: 0.8"
        @click="iconAction?.()"
      />
    </template>

    <template #title>
      <slot name="title">
        <div v-if="store.mobileLayout && home" class="mobile-brand">
          <img
            src="@/assets/icon.svg"
            alt="Music Assistant"
            class="mobile-brand-logo"
          />
          <span class="mobile-brand-text">Music Assistant</span>
        </div>
        <button v-else-if="title" @click="emit('titleClicked')">
          {{ title }}
        </button>
      </slot>
    </template>

    <template v-if="$slots.append" #append>
      <slot name="append"></slot>
    </template>
    <template v-else-if="menuItems?.length" #append>
      <v-progress-circular
        v-if="
          showLoading &&
          (api.fetchesInProgress.value.length > 0 ||
            api.syncTasks.value.length > 0)
        "
        color="primary"
        indeterminate
        :title="$t('tooltip.loading')"
      />
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
          :close-on-content-click="menuItem.closeOnContentClick !== false"
        >
          <template #activator="{ props }">
            <v-btn
              variant="text"
              style="width: 40px"
              v-bind="props"
              :title="$t(menuItem.label, menuItem.labelArgs || [])"
              :disabled="menuItem.disabled == true"
            >
              <v-badge
                :model-value="menuItem.active == true"
                color="primary"
                dot
              >
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
            (getBreakpointValue('bp5') || menuItem.overflowAllowed == false)
          "
          variant="text"
          style="width: 40px"
          :title="$t(menuItem.label, menuItem.labelArgs || [])"
          :disabled="menuItem.disabled == true"
          @click="menuItem.action"
        >
          <v-badge :model-value="menuItem.active == true" color="primary" dot>
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
          (!getBreakpointValue('bp5') || enforceOverflowMenu) &&
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
                  color="primary"
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
    <template v-else-if="showLoading" #append>
      <v-progress-circular
        v-if="
          api.fetchesInProgress.value.length > 0 ||
          api.syncTasks.value.length > 0
        "
        color="primary"
        indeterminate
      />
    </template>
  </v-toolbar>
</template>

<script setup lang="ts">
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { getBreakpointValue } from "../plugins/breakpoint";

// properties
export interface Props {
  color?: string;
  icon?: string;
  title?: string;
  menuItems?: ToolBarMenuItem[];
  enforceOverflowMenu?: boolean;
  showLoading?: boolean;
  home?: boolean;
  iconAction?: () => void;
}
withDefaults(defineProps<Props>(), {
  color: "transparent",
  icon: undefined,
  title: undefined,
  count: undefined,
  menuItems: undefined,
  enforceOverflowMenu: false,
  showLoading: undefined,
  iconAction: undefined,
});

// emitters
const emit = defineEmits<{
  (e: "iconClicked"): void;
  (e: "titleClicked"): void;
}>();
</script>

<script lang="ts">
export interface ToolBarMenuItem extends ContextMenuItem {
  active?: boolean;
  subItems?: ContextMenuItem[];
  overflowAllowed?: boolean;
  closeOnContentClick?: boolean;
}
</script>

<style scoped>
.header.v-toolbar {
  height: 55px;
  font-family: "JetBrains Mono Medium";
}

.header.v-toolbar :deep(.v-toolbar__content) {
  height: 55px !important;
  min-height: 55px !important;
  padding-top: 0;
  padding-bottom: 0;
  align-items: center;
}

.header.v-toolbar :deep(.v-toolbar__content) > .v-toolbar__append {
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

/* Mobile branding on the left */
.mobile-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.mobile-brand-logo {
  height: 30px;
  width: 30px;
}
.mobile-brand-text {
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-top: 4px;
}
</style>
