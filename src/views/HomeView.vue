<template>
  <div>
    <Toolbar
      icon="$mass"
      title="Music Assistant"
      :menu-items="[
        {
          label: 'settings.settings',
          icon: 'mdi-cog-outline',
          action: () => {
            $router.push({ path: 'settings' });
          },
        },
      ]"
    />
    <Container variant="panel">
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
import Toolbar from '@/components/Toolbar.vue';
import HomeCurrentlyPlayingRow from '@/components/HomeCurrentlyPlayingRow.vue';
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
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
