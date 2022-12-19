<template>
  <v-app>
    <!-- override background color set in iframe by HASS -->
    <div
      style="
        position: fixed;
        height: 100%;
        width: 100%;
        background: rgb(var(--primary-background-color));
      "
    />
    <PlayerSelect />
    <PlayerQueueContextMenu />
    <TopBar />
    <v-main v-if="store.apiInitialized">
      <v-container fluid style="padding: 0">
        <router-view v-slot="{ Component }" app>
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </v-container>
    </v-main>
    <v-footer style="padding: 0px" bottom fixed class="d-flex flex-column" app>
      <PlayerOSD />
      <BottomBar />
    </v-footer>
    <ReloadPrompt v-if="store.isInStandaloneMode" />
  </v-app>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { api } from './plugins/api';
import { store } from './plugins/store';
import { isColorDark } from './utils';
import { useTheme } from 'vuetify';
import TopBar from './components/TopBar.vue';
import PlayerOSD from './components/PlayerOSD/Player.vue';
import PlayerSelect from './components/PlayerSelect.vue';
import ReloadPrompt from './components/ReloadPrompt.vue';
import PlayerQueueContextMenu from './components/PlayerQueueDialog.vue';
import 'vuetify/styles';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { HassPanelData, HassData } from './main';
import { useI18n } from 'vue-i18n';
import BottomBar from './components/BottomBar.vue';

const { locale } = useI18n({ useScope: 'global' });

interface HassPropEvent extends Event {
  detail: HassData;
}
interface HassPanelPropEvent extends Event {
  detail: HassPanelData;
}

document.addEventListener('forward-hass-prop', function (e) {
  const hass = (e as HassPropEvent).detail;
  if (!hass) return;
  if (!store.apiInitialized) {
    api.initialize(hass.connection);
    locale.value = hass.selectedLanguage || navigator.language;
  }
  store.alwaysShowMenuButton = hass.dockedSidebar == 'always_hidden';
  setTheme(hass);
});

store.getDisplaySize = { height: window.innerHeight, width: window.innerWidth };
window.addEventListener('resize', function (e) {
  store.getDisplaySize = {
    height: window.innerHeight,
    width: window.innerWidth,
  };
});

document.addEventListener('forward-panel-prop', function (e) {
  store.defaultTopBarTitle = (e as HassPanelPropEvent).detail.config.title;
});

const verifyThemeVar = function (
  theme: { [x: string]: object },
  key: string,
  extendedTheme: Record<string, string> | undefined,
  recoveryValue: { [x: string]: object }
) {
  if (theme && key in theme) return theme[key];
  else if (extendedTheme && key in extendedTheme) return extendedTheme[key];
  return recoveryValue[key];
};

// set theme colors based on HA theme
const theme = useTheme();
let lightTheme = theme.themes.value.light.colors;
let darkTheme = theme.themes.value.dark.colors;

const defaultThemeColor = function () {
  lightTheme['background'] = '#fafafa';
  lightTheme['primary'] = '#03a9f4';
  lightTheme['secondary'] = '#ff9800';
  lightTheme['accent'] = '#03a9f4';
  lightTheme['error'] = '#db4437';
  lightTheme['info'] = '#039be5';
  lightTheme['success'] = '#43a047';
  lightTheme['warning'] = '#ffa600';

  darkTheme['background'] = '#121212';
  darkTheme['primary'] = '#0288d1';
  darkTheme['secondary'] = '#ff9800';
  darkTheme['accent'] = '#0288d1';
  darkTheme['error'] = '#db4437';
  darkTheme['info'] = '#039be5';
  darkTheme['success'] = '#43a047';
  darkTheme['warning'] = '#ffa600';
};

defaultThemeColor();
const setTheme = async function (hassData: HassData) {
  // determine if dark theme active
  const curTheme = hassData.themes?.theme || 'default';
  const darkMode = hassData?.themes?.darkMode || false;
  store.darkTheme = darkMode;

  if (curTheme == 'default') {
    // default theme
    const curThemeMode = darkMode ? darkTheme : lightTheme;
    curThemeMode['primary'] = hassData.selectedTheme?.primaryColor || '#03A9F4';
    curThemeMode['secondary'] =
      hassData.selectedTheme?.accentColor || '#ff9800';
    curThemeMode['accent'] = isColorDark(curThemeMode['primary'])
      ? curThemeMode['secondary']
      : curThemeMode['primary'];
  } else {
    // custom theme
    const customTheme = hassData.themes?.themes[hassData.themes.theme];
    let availThemeModes: Record<string, string> | any;
    const curThemeMode = darkMode ? darkTheme : lightTheme;
    if (customTheme && customTheme?.modes) {
      availThemeModes = customTheme?.modes[darkMode ? 'dark' : 'light'];
    } else {
      availThemeModes = customTheme;
    }

    const themeVarArray = [
      'primary-color',
      'accent-color',
      'error-color',
      'info-color',
      'success-color',
      'warning-color',
      'background',
    ];

    themeVarArray.forEach((themeVar) => {
      curThemeMode[themeVar.replace('-color', '')] = verifyThemeVar(
        availThemeModes,
        themeVar,
        customTheme,
        curThemeMode
      );
    });

    curThemeMode['accent'] = isColorDark(curThemeMode['primary'])
      ? curThemeMode['secondary']
      : curThemeMode['primary'];
    darkMode ? (darkTheme = curThemeMode) : (lightTheme = curThemeMode);
  }
  theme.name.value = darkMode ? 'dark' : 'light';
};

setTimeout(() => {
  if (!store.apiInitialized) {
    console.log('Activating stand-alone mode...');
    store.isInStandaloneMode = true;
    api.initialize();
  }
}, 1000);
</script>

<style>
* {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.selectable {
  -webkit-user-select: text;
  -khtml-user-select: text;
  -moz-user-select: text;
  -o-user-select: text;
  user-select: text;
}

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

.v-slider.v-input--horizontal {
  margin-left: 0px;
  margin-right: 0px;
}

div.v-slide-group__next {
  margin-bottom: 5px;
}

div.v-slide-group__prev {
  margin-bottom: 5px;
}

.v-slide-group {
  align-items: self-end;
  padding-left: 30px;
  padding-right: 30px;
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
  height: 50px;
  vertical-align: middle;
  align-items: center;
  padding: 0px 0px 0px 10px;
}

.v-card {
  box-shadow: none;
  border-width: var(--ha-card-border-width, 1px);
  border-style: solid;
}

.text-caption {
  z-index: 3;
}

.v-list-item-subtitle {
  font-size: 0.6875rem;
}

.v-list-item-title {
  font-size: 0.875rem;
}

.v-footer {
  padding: 10px 10px;
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

.citl {
  position: relative;
  min-height: 14px;
}

.citl > div {
  position: absolute;
}

.citl > div > div {
  white-space: nowrap;
}

.list-item-subtitle-slider {
  min-height: 20px;
  padding: 8px 11px 8px;
}

.v-select__selection-text {
  font-size: 0.875rem;
}

.v-main {
  padding-top: calc(var(--v-layout-top) - 5px);
}
</style>
