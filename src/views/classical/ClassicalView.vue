<template>
  <section class="classical-view classical-typography">
    <v-toolbar color="transparent" class="classical-toolbar">
      <template #prepend>
        <v-btn :disabled="true" size="small" style="opacity: 0.8">
          <Piano class="w-6 h-6" />
        </v-btn>
      </template>
      <v-toolbar-title class="classical-toolbar-title">
        {{ $t("classical") }}
      </v-toolbar-title>
      <Tabs :model-value="activeTab" class="classical-tabs-inline">
        <TabsList class="classical-tabs w-full h-auto">
          <TabsTrigger
            value="composers"
            class="classical-tab-trigger"
            @click="goToTab('composers')"
          >
            <Feather class="classical-tab-icon" />
            <span>{{ $t("composers") }}</span>
          </TabsTrigger>
          <TabsTrigger
            value="works"
            class="classical-tab-trigger"
            @click="goToTab('works')"
          >
            <Music3 class="classical-tab-icon" />
            <span>{{ $t("works") }}</span>
          </TabsTrigger>
          <TabsTrigger
            value="performers"
            class="classical-tab-trigger"
            @click="goToTab('performers')"
          >
            <Users class="classical-tab-icon" />
            <span>{{ $t("performers") }}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </v-toolbar>
    <v-divider />
    <div
      class="classical-tab-content"
      :class="{ 'full-bleed': fullBleedContent }"
    >
      <router-view />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CLASSICAL_DEFAULT_TAB,
  CLASSICAL_LAST_TAB_KEY,
  isClassicalTab,
  type ClassicalTab,
} from "@/views/classical/tabs";
import { Feather, Music3, Piano, Users } from "lucide-vue-next";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

defineOptions({ name: "ClassicalView" });

const route = useRoute();
const router = useRouter();

const activeTab = computed<ClassicalTab>(() => {
  const segment = route.path.split("/")[2];
  return isClassicalTab(segment) ? segment : CLASSICAL_DEFAULT_TAB;
});

// Detail routes render their own full-bleed banner (InfoHeader); drop the
// inner padding so the banner reaches the edges.
const fullBleedContent = computed(() =>
  route.matched.some((r) => r.meta?.hideTabs === true),
);

// reka-ui's Tabs only emits update:modelValue on a value change, so clicking
// a tab that's already active (e.g. Composers while on a composer detail
// page) wouldn't navigate. Drive navigation from a direct click handler.
const goToTab = (tab: ClassicalTab) => {
  const target = `/classical/${tab}`;
  localStorage.setItem(CLASSICAL_LAST_TAB_KEY, tab);
  if (route.path !== target) router.push(target);
};
</script>

<style scoped>
.classical-view {
  display: flex;
  flex-direction: column;
}

/* Inherited by all child routes; referenced by inner components for movement titles. */
.classical-typography {
  --font-classical-serif:
    "Roboto Serif", ui-serif, Georgia, "Times New Roman", serif;
}

.classical-typography .classical-toolbar-title,
.classical-typography :deep(.classical-tab-trigger),
.classical-typography :deep(.classical-tab-trigger span) {
  font-family: var(--font-classical-serif);
  font-optical-sizing: auto;
}

.classical-typography :deep(.v-card-title) {
  font-family: var(--font-classical-serif);
  font-optical-sizing: auto;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.classical-typography :deep(.header.v-toolbar) {
  font-family: var(--font-classical-serif);
  font-optical-sizing: auto;
}

/* Toolbar's title is a native <button>; no classical view wires titleClicked. */
.classical-typography :deep(.v-toolbar-title button) {
  cursor: default;
}

.classical-toolbar :deep(.v-toolbar__content) {
  gap: 0.75rem;
}

.classical-toolbar-title {
  flex: 0 0 auto;
  font-weight: 600;
  padding-right: 2rem;
}

/* Vuetify wraps the title slot in v-toolbar-title__placeholder; override its
   internal padding so the trailing space matches the leading icon gap. */
.classical-toolbar :deep(.v-toolbar-title__placeholder) {
  padding-right: 2rem;
}

.classical-tabs-inline {
  flex: 1 1 auto;
  min-width: 0;
  padding-right: 0.75rem;
}

.classical-tabs {
  width: 100%;
}

.classical-tab-trigger {
  font-weight: 600;
  line-height: 1.1;
  padding: 0.35rem 0.6rem;
  gap: 0.4rem;
  min-width: 0;
}

.classical-tab-icon {
  width: 1.05rem;
  height: 1.05rem;
  flex-shrink: 0;
}

/* Pin icon size and font size against TabsTrigger's baked-in defaults
   (text-sm and [&_svg]:size-4). */
:deep(.classical-tab-trigger svg) {
  width: 1.05rem !important;
  height: 1.05rem !important;
}

:deep(.classical-tab-trigger),
:deep(.classical-tab-trigger span) {
  font-size: 0.95rem !important;
}

@media (max-width: 600px) {
  .classical-tab-trigger span {
    display: none;
  }
  .classical-tab-trigger {
    padding: 0.3rem 0.5rem;
  }
}

.classical-tab-content {
  flex: 1;
  min-height: 0;
  padding: 0.75rem 1rem 1rem;
}

.classical-tab-content.full-bleed {
  padding: 0;
}
</style>
