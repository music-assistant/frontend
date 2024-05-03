<template>
  <div>
    <Container variant="panel">
      <div class="logo_box">
        <img
          class="logo_icon"
          :style="$vuetify.theme.current.dark ? 'filter: invert(100%);' : ''"
          width="55"
          src="@/assets/logo.svg"
        />
        <div class="logo_text">Music Assistant</div>
      </div>
      <Suspense>
        <div>
          <HomeCurrentlyPlayingRow />
          <HomeWidgetRows />
        </div>
        <template #fallback><v-progress-circular indeterminate /> </template>
      </Suspense>
    </Container>
  </div>
</template>

<script setup lang="ts">
import Container from '@/components/mods/Container.vue';
import HomeWidgetRows from '@/components/HomeWidgetRows.vue';
import HomeCurrentlyPlayingRow from '@/components/HomeCurrentlyPlayingRow.vue';
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}
.logo_box {
  margin-left: 10px;
  height: 55px;
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 15px;
}
.logo_text {
  margin-left: 10px;
  align-content: center;
  font-family: 'JetBrains Mono Medium';
  font-size: x-large;
  font-weight: 500;
}

.logo_icon {
  margin-left: -5px;
  border-radius: 4px;
}
</style>

<style>
.home-card {
  min-width: 80px;
  text-align: center;
  padding-top: 12px;
  padding-bottom: 8px;
}

.widget-row {
  margin-bottom: 20px;
  margin-left: 0px;
  padding-left: 0px;
}

.v-slide-group__prev {
  min-width: 0px !important;
}

.v-slide-group__prev.v-slide-group__prev--disabled {
  visibility: hidden;
  margin-right: -15px;
}

.v-slide-group__next {
  min-width: 15px !important;
}

.v-slide-group__next.v-slide-group__next--disabled {
  visibility: hidden;
}
</style>
