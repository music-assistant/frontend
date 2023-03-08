<template>
  <v-main id="cont">
    <v-container
      fluid
      style="padding: 0"
    >
      <router-view
        v-slot="{ Component }"
        app
      >
        <transition
          name="fade"
          mode="out-in"
        >
          <component :is="Component" />
        </transition>
      </router-view>
      <!-- white space to reserve space for footer -->
      <!-- <div style="height: 150px" /> -->
    </v-container>
  </v-main>
</template>

<script lang="ts" setup>
  //
</script>
