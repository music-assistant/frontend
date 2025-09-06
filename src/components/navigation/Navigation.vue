<template>
  <nav class="sidebar">
    <v-list class="sidebar-list">
      <v-list-item
        slim
        nav
        class="menuButton"
        v-for="menuItem of menuItems"
        :key="menuItem.label"
        :to="menuItem.path"
      >
        <template v-slot:prepend>
          <v-icon :icon="menuItem.icon" size="24px"></v-icon>
        </template>
        <v-list-item-title v-text="$t(menuItem.label)"></v-list-item-title>
      </v-list-item>
    </v-list>
  </nav>
</template>

<script setup lang="ts">
import { getMenuItems } from "./utils/getMenuItems";

const menuItems = getMenuItems();
</script>

<style scoped>
.menuButton {
  margin: 3px 10px;
  padding: 0px 20px;
}

.v-list-item-title {
  font-size: medium;
  font-weight: bold;
}

.v-icon {
  opacity: 1;
}

.v-btn--active {
  color: rgb(var(--v-theme-primary));
}

.v-slide-group-item--active {
  opacity: 100%;
}
</style>

<style scoped>
.sidebar {
  background-color: rgb(var(--v-theme-panel));
}
.sidebar-header {
  padding: 24px 16px 16px 16px;
  font-size: 1.2em;
  font-weight: bold;
}
.sidebar-list {
  background-color: rgb(var(--v-theme-panel));
  list-style: none;
  padding: 0;
  margin: 0;
  margin-top: 30px;
  flex: 1;
  padding-bottom: 30px;
}
.sidebar-list li {
  padding: 12px 16px;
}
.sidebar-list li a {
  color: inherit;
  text-decoration: none;
  display: block;
  border-radius: 4px;
  transition: background 0.2s;
}
.sidebar-list li a:hover {
  background: #333;
}
</style>
