<template>
  <div class="detail-admin">
    <slot></slot>
  </div>
</template>

<style scoped>
/* the shared admin sections keep their own toolbar and content, but take the
   page's row title and gutter and sit in a card each; their inline bottom margin
   is the only spacing they set themselves, hence the override */
.detail-admin :deep(section) {
  margin: 16px 28px 0 !important;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  overflow: hidden;
}
.detail-admin :deep(.v-toolbar-title) {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
}
.detail-admin :deep(.v-divider) {
  display: none;
}
/* the lists and image tiles inside sit on the card instead of painting their own surface */
.detail-admin :deep(.v-container) {
  padding: 0 12px 12px;
}
.detail-admin :deep(.v-list),
.detail-admin :deep(.panel-item) {
  background: transparent;
  box-shadow: none;
}
.detail-admin :deep(.v-list) {
  padding: 0;
}
/* uniform square image tiles instead of percentage columns, one row per image type */
.detail-admin :deep(.v-row) {
  margin: 0 0 12px;
  gap: 12px;
}
.detail-admin :deep(.v-row:empty) {
  display: none;
}
.detail-admin :deep(.v-col) {
  flex: 0 0 auto;
  width: 176px;
  max-width: 176px;
  padding: 0;
}
.detail-admin :deep(.panel-item) {
  padding: 8px;
  /* outweighs the equally-!important radius the card's tile utility carries */
  border-radius: 12px !important;
}
.detail-admin :deep(.panel-item:hover) {
  background: rgba(var(--v-theme-on-surface), 0.08);
  box-shadow: none;
}
.detail-admin :deep(.panel-item .v-img) {
  aspect-ratio: 1 / 1;
  border-radius: 8px;
}
.detail-admin :deep(.panel-item .v-img__img) {
  object-fit: cover;
}

@media (max-width: 768px) {
  .detail-admin :deep(section) {
    margin: 12px 16px 0 !important;
  }
  .detail-admin :deep(.v-toolbar-title) {
    font-size: 19px;
  }
}
</style>
