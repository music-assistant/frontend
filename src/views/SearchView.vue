<template>
  <div>
    <div
      style="
        margin-left: 10px;
        margin-right: 10px;
        margin-top: 10px;
        margin-bottom: 10px;
      "
    >
      <GlobalSearch />
    </div>
  </div>
</template>

<script setup lang="ts">
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import { store } from '../plugins/store';
import { useI18n } from 'vue-i18n';
import GlobalSearch from '../components/GlobalSearch.vue';
import { onBeforeUnmount, onMounted } from 'vue';

// global refs
const { t } = useI18n();

// local refs
store.topBarTitle = t('search');

onMounted(() => {
  store.showTabsNav = false;
});

onBeforeUnmount(() => {
  store.showTabsNav = true;
});
</script>
