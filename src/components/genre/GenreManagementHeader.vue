<template>
  <v-card class="header-card mb-4" elevation="0">
    <div class="header-content">
      <div class="header-icon">
        <v-icon size="32" color="primary">mdi-compass-outline</v-icon>
      </div>
      <div class="header-info">
        <h2 class="header-title">
          {{ $t("settings.genre_management") }}
        </h2>
        <p class="header-description">
          {{ $t("settings.genre_management_description") }}
        </p>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.header-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
}

.header-content {
  display: flex;
  gap: 20px;
  padding: 24px;
}

.header-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--v-theme-on-surface));
}

.header-description {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
