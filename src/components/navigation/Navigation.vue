<template>
  <nav class="sidebar">
    <div class="sidebar-header">
      <img
        src="@/assets/icon.svg"
        alt="Music Assistant"
        class="sidebar-header-logo"
      />
      <div class="sidebar-header-title">Music Assistant</div>
    </div>
    <v-list class="sidebar-list">
      <v-list-item
        v-for="menuItem of menuItems"
        :key="menuItem.label"
        slim
        nav
        class="menuButton"
        :to="menuItem.path"
      >
        <template #prepend>
          <v-icon :icon="menuItem.icon" size="24px" />
        </template>
        <v-list-item-title v-text="$t(menuItem.label)" />
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
  padding: 0px 15px;
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
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 15px 0px 0 22px;
}
.sidebar-header-logo {
  width: 30px;
  height: 30px;
  border-radius: 6px;
}
.sidebar-header-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 3px 0 0 10px;
}
.sidebar-list {
  background-color: rgb(var(--v-theme-panel));
  list-style: none;
  padding: 0;
  margin: 0;
  margin-top: 20px;
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
