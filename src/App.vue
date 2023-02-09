<template>
  <router-view />
</template>

<script setup lang="ts">
import { api } from './plugins/api';
import { onMounted } from 'vue';


onMounted(() => {
  // Initialize API Connection
  // TODO: retrieve serveraddress through discovery and/or user settings ?
  let serverAddress = ''
  if (process.env.NODE_ENV === 'production') {
    const loc = window.location
    serverAddress = loc.origin + loc.pathname
  } else {
    serverAddress = 'http://localhost:8095/'
  }
  api.initialize(serverAddress);
})

</script>

<style>
a {
  cursor: pointer;
}
.vertical-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.right {
  float: right;
}

.left {
  float: left;
}

div.v-navigation-drawer__scrim {
  opacity: 0.8;
  background: grey;
}

.volumerow {
  height: 60px;
  padding-top: 5px;
  padding-bottom: 0px;
}

.volumerow .v-slider .v-slider__container {
  margin-left: 57px;
  margin-right: 15px;
  margin-top: -10px;
}

.slider .div.v-input__append {
  padding-top: 0px;
  margin-top: -10px;
}

.active-tab {
  background: rgba(var(--v-theme-on-surface), 0.6);
  color: rgb(var(--v-theme-surface));
}
.inactive-tab {
  background: rgba(var(--v-theme-on-surface), 0.3);
  color: rgba(var(--v-theme-surface), 0.6);
}

.hiresicon {
  position: absolute;
  margin-left: 5px;
  margin-top: -20px;
  height: 30px;
  border-radius: 5px;
}

.padded-overlay .v-overlay__content {
  padding: 50px;
}
.v-overlay__scrim {
  opacity: 65%;
}

.listitem-actions {
  display: flex;
  justify-content: end;
  width: auto;
  height: 50px;
  vertical-align: middle;
  align-items: center;
  padding: 0px;
  padding-right: 0px;
}
.listitem-action {
  padding-left: 5px;
}
.listitem-thumb {
  padding-left: 0px;
  margin-right: 10px;
  margin-left: -15px;
  margin-top: 2px;
  width: 50px;
  height: 50px;
}
.v-card--variant-elevated {
  box-shadow: none;
  border-width: var(--ha-card-border-width, 1px);
  border-style: solid;
  border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
}
.line-clamp-1 {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.line-clamp-2 {
  white-space: pre-line;
  overflow: hidden;
  line-height: 1.5em;
  height: 3em;
  word-wrap: break-word;
  box-sizing: border-box;
  display: -webkit-box;
  -webkit-line-clamp: 2;
}
</style>
