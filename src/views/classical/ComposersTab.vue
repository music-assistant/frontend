<template>
  <div class="composers-tab">
    <ul v-if="composers.length" class="composer-grid">
      <li v-for="c in composers" :key="c.item_id" class="composer-card">
        <router-link
          :to="`/classical/composers/${c.item_id}`"
          class="composer-card-link"
          :aria-label="c.name"
        >
          <div class="composer-thumb">
            <img
              v-if="c.fanart_url || c.thumbnail_url"
              :src="c.fanart_url || c.thumbnail_url || ''"
              :alt="c.name"
              loading="lazy"
            />
            <div v-else class="composer-thumb-placeholder"></div>
          </div>
          <div class="composer-meta">
            <div class="composer-name">{{ c.name }}</div>
            <div v-if="c.year_range" class="composer-sub">
              {{ c.year_range }}
            </div>
            <div class="composer-sub">
              {{ $t("works") }}: {{ c.work_count }}
            </div>
          </div>
        </router-link>
      </li>
    </ul>
    <p v-else class="text-muted-foreground">
      {{ $t("classical_no_composers") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { getComposers, type ClassicalComposer } from "@/services/classical";
import { onMounted, ref } from "vue";

defineOptions({ name: "ComposersTab" });

const composers = ref<ClassicalComposer[]>([]);

onMounted(async () => {
  composers.value = await getComposers();
});
</script>

<style scoped>
.composers-tab {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.composer-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.composer-card {
  display: flex;
  flex-direction: column;
}

.composer-card-link {
  display: flex;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
  transition: transform 0.15s ease;
}

.composer-card-link:hover,
.composer-card-link:focus-visible {
  transform: translateY(-2px);
}

.composer-thumb {
  display: block;
  /* fanart.tv background art proportions */
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--muted, #2a2a2a);
}

.composer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.composer-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #4a4a4a, #1a1a1a);
}

.composer-meta {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.composer-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.composer-card-link:hover .composer-name,
.composer-card-link:focus-visible .composer-name {
  text-decoration: underline;
}

.composer-sub {
  color: var(--muted-foreground, #888);
  font-size: 0.8125rem;
}
</style>
