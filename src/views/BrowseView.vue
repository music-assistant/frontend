<template>
  <section>
    <ItemsListing
      itemtype="browse"
      :show-provider="false"
      :show-library="false"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :show-select-button="path && path != 'root' ? true : false"
      :load-items="loadItems"
      :sort-keys="['original', 'name', 'name_desc']"
      :path="path"
      :allow-key-hooks="true"
      icon="mdi-folder-outline"
      :title="title"
    >
      <template #title>
        <div class="breadcrumb-container">
          <span
            v-for="(segment, index) in breadcrumbSegments"
            :key="index"
            class="breadcrumb-segment"
          >
            <button
              v-if="segment.clickable"
              class="breadcrumb-link"
              @click="navigateToSegment(segment.path)"
            >
              {{ segment.text }}
            </button>
            <span v-else class="breadcrumb-text">
              {{ segment.text }}
            </span>
            <v-icon
              v-if="index < breadcrumbSegments.length - 1"
              icon="mdi-chevron-right"
              size="small"
              class="breadcrumb-separator"
            />
          </span>
        </div>
      </template>
    </ItemsListing>
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import router from "@/plugins/router";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

export interface Props {
  path?: string;
}

interface BreadcrumbSegment {
  text: string;
  path: string | null;
  clickable: boolean;
}

const props = defineProps<Props>();
const { t } = useI18n();

const title = computed(() => "");

const breadcrumbSegments = computed((): BreadcrumbSegment[] => {
  const segments: BreadcrumbSegment[] = [];

  segments.push({
    text: t("browse"),
    path: null,
    clickable: (props.path && props.path !== "root") || false,
  });

  if (props.path && props.path !== "root") {
    if (props.path.includes("://")) {
      const [providerPart, pathPart] = props.path.split("://");
      const provider = providerPart + "://";

      segments.push({
        text: provider,
        path: provider,
        clickable: (pathPart && pathPart.length > 0) || false,
      });

      if (pathPart && pathPart.length > 0) {
        const pathSegments = pathPart
          .split("/")
          .filter((segment) => segment.length > 0);

        pathSegments.forEach((segment, index) => {
          const fullPath =
            provider + pathSegments.slice(0, index + 1).join("/");

          segments.push({
            text: segment,
            path: fullPath,
            clickable: index < pathSegments.length - 1,
          });
        });
      }
    } else {
      const pathSegments = props.path
        .split("/")
        .filter((segment) => segment.length > 0);

      pathSegments.forEach((segment, index) => {
        const fullPath = pathSegments.slice(0, index + 1).join("/");

        segments.push({
          text: segment,
          path: fullPath,
          clickable: index < pathSegments.length - 1,
        });
      });
    }
  }

  return segments;
});

const loadItems = async function (params: LoadDataParams) {
  return await api.browse(props.path);
};

const navigateToSegment = (path: string | null) => {
  if (path === null) {
    router.push({ name: "browse" });
  } else {
    router.push({
      name: "browse",
      query: { path },
    });
  }
};
</script>

<style scoped>
.breadcrumb-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.breadcrumb-segment {
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-link {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
  font-size: inherit;
  padding: 0;
  margin: 0;
}

.breadcrumb-link:hover {
  opacity: 0.7;
}

.breadcrumb-text {
  color: inherit;
}

.breadcrumb-separator {
  opacity: 0.5;
  margin: 0 2px;
}
</style>
