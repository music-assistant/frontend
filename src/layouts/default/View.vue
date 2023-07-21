<template>
  <v-main id="cont" class="overflow-y-auto" style="height: 0px">
    <navigation-menu />

    <router-view v-slot="{ Component }" app>
      <transition name="fade" mode="out-in">
        <component :is="Component" v-scroll:#cont="onScroll" />
      </transition>
    </router-view>
  </v-main>
</template>

<script lang="ts" setup>
import NavigationMenu from './NavigationMenu.vue';
import AppBar from './AppBar.vue';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

function onScroll(e: any) {
  history.replaceState({ top: e.target.scrollTop }, '');
}

const onPopstate = () => {
  if (history.state && history.state.top) {
    nextTick(() => {
      const el = document.getElementById('cont');
      setTimeout(() => {
        //@ts-ignore
        scrollTo(el, history.state.top, 1000);
      }, 400);
    });
  }
};

function scrollTo(el: HTMLElement, to: number, duration: number) {
  const start = el.scrollTop;
  const change = to - start;
  const startDate = new Date().getTime();

  const easeInOutQuad = (t: number, b: number, c: number, d: number) => {
    t /= d / 2;
    if (t < 1) return (c / 2) * t * t + b;
    t--;
    return (-c / 2) * (t * (t - 2) - 1) + b;
  };

  const animateScroll = () => {
    const currentDate = new Date().getTime();
    const elapsedTime = currentDate - startDate;
    el.scrollTop = easeInOutQuad(elapsedTime, start, change, duration);
    if (elapsedTime < duration) {
      requestAnimationFrame(animateScroll);
    } else {
      el.scrollTop = to;
    }
  };

  animateScroll();
}

onMounted(() => {
  window.addEventListener('popstate', onPopstate);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopstate);
});
</script>
