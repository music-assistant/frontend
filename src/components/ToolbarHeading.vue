<template>
  <div class="toolbar-heading">
    <component
      :is="to ? RouterLink : 'span'"
      :to="to"
      class="toolbar-heading-title"
    >
      {{ title }}
    </component>
    <v-breadcrumbs
      v-if="items.length"
      :items="items"
      class="pa-0 toolbar-heading-trail"
    />
  </div>
</template>

<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from "vue-router";

// properties
interface Props {
  title: string;
  // leave unset on the section root, where the heading has nowhere to link to
  to?: RouteLocationRaw;
  items?: ToolbarHeadingItem[];
}
withDefaults(defineProps<Props>(), {
  to: undefined,
  items: () => [],
});
</script>

<script lang="ts">
export interface ToolbarHeadingItem {
  title: string;
  // marks the page you are on: highlighted and not clickable, even with a route
  disabled: boolean;
  to?: RouteLocationRaw;
}
</script>

<style scoped>
.toolbar-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  line-height: 1.2;
}

/* the trail carries the detail, so the heading only has to name the section */
.toolbar-heading-title {
  color: inherit;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 500;
}

/* the trail can outgrow the toolbar, so it scrolls rather than pushing the
   actions off the end */
.toolbar-heading-trail {
  max-width: 100%;
  overflow-x: auto;
  font-size: 0.7rem;
  scrollbar-width: none;
}

.toolbar-heading-trail::-webkit-scrollbar {
  display: none;
}

.toolbar-heading-trail :deep(.v-breadcrumbs-item) {
  padding: 0;
  font-size: inherit;
  white-space: nowrap;
  opacity: 0.6;
}

/* vuetify dims the last crumb as "disabled"; it is the page you are on, so it
   is the one that stands out and the trail above it recedes */
.toolbar-heading-trail :deep(.v-breadcrumbs-item--disabled) {
  opacity: 1;
}

.toolbar-heading-trail :deep(.v-breadcrumbs-divider) {
  padding: 0 4px;
  font-size: inherit;
  opacity: 0.6;
}
</style>
