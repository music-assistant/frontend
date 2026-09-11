<template>
  <Dialog v-model:open="open">
    <component :is="isPhone ? SheetContent : DialogContent" v-bind="chrome">
      <PanelDragHandle v-if="isPhone" @dismiss="open = false" />

      <div class="rows-editor__header">
        <div class="rows-editor__heading">
          <!-- the utilities these carry outrank scoped rules, so the type
               scale is set by competing utilities instead -->
          <DialogTitle class="rows-editor__title text-base font-medium">
            {{ $t("edit_rows") }}
          </DialogTitle>
          <DialogDescription class="rows-editor__subtitle text-[13px]">
            {{ $t("edit_rows_subtitle") }}
          </DialogDescription>
        </div>
        <Button
          v-if="isPhone"
          variant="ghost"
          size="icon-sm"
          :aria-label="$t('reset_to_default')"
          @click="reset"
        >
          <RotateCcw />
        </Button>
        <Button v-else variant="outline" size="sm" @click="reset">
          <RotateCcw />
          {{ $t("reset_to_default") }}
        </Button>
        <Button size="sm" @click="open = false">
          <Check />
          {{ $t("done") }}
        </Button>
      </div>

      <div v-if="!isPhone" class="rows-editor__preview">
        <div class="rows-editor__avatar">
          <MediaItemThumb :item="artist" size="56" :rounded="false" />
        </div>
        <div class="rows-editor__heading">
          <span class="rows-editor__title">{{ artist.name }}</span>
          <span class="rows-editor__subtitle">
            {{ $t("rows_shown", { shown: shownCount, total: rows.length }) }}
          </span>
        </div>
      </div>

      <div
        class="rows-editor__scroll"
        :class="{ 'rows-editor__scroll--phone': isPhone }"
      >
        <div
          ref="listEl"
          class="rows-editor__list"
          :class="{ 'rows-editor__list--phone': isPhone }"
        >
          <div
            v-for="(row, idx) in rows"
            :key="row.id"
            class="rows-editor__slot"
            :data-drag-index="idx"
            :style="slotStyle(idx)"
          >
            <div
              class="rows-editor__row"
              :class="{
                'rows-editor__row--hidden': row.hidden,
                'rows-editor__row--gap': draggingIndex === idx,
              }"
            >
              <button
                type="button"
                class="rows-editor__grip"
                :aria-label="$t('reorder_row')"
                @pointerdown.stop.prevent="startItemDrag($event, idx)"
                @keydown.up.prevent="moveRow(idx, idx - 1)"
                @keydown.down.prevent="moveRow(idx, idx + 1)"
                @click.stop
              >
                <GripVertical :size="16" />
              </button>

              <span class="rows-editor__labels">
                <span class="rows-editor__name">{{ row.title }}</span>
                <span v-if="row.meta" class="rows-editor__meta">{{
                  row.meta
                }}</span>
              </span>

              <DropdownMenu
                v-if="row.source && sourceOptions(row.id).length > 1"
              >
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="outline"
                    size="xs"
                    :aria-label="`${$t('row_source')}: ${sourceLabel(row.source)}`"
                  >
                    {{ $t("row_source") }}
                    <ChevronDown :size="13" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    :model-value="row.source"
                    @update:model-value="(value) => selectSource(row.id, value)"
                  >
                    <DropdownMenuRadioItem
                      v-for="option in sourceOptions(row.id)"
                      :key="option.value"
                      :value="option.value"
                    >
                      <ProviderIcon
                        v-if="option.domain"
                        :domain="option.domain"
                        :size="16"
                      />
                      {{ option.label }}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <!-- bg-secondary paints Vuetify's own teal, so the pill takes the
                 muted surface instead -->
              <Badge
                v-if="!isPhone && row.hidden"
                variant="secondary"
                class="rows-editor__badge bg-muted text-muted-foreground"
              >
                {{ $t("row_hidden") }}
              </Badge>

              <Switch
                v-if="isPhone"
                :model-value="!row.hidden"
                :aria-label="row.hidden ? $t('show_row') : $t('hide_row')"
                @update:model-value="setHidden(row.id, !$event)"
              />
              <Button
                v-else
                variant="ghost"
                size="icon-sm"
                :aria-label="row.hidden ? $t('show_row') : $t('hide_row')"
                @click="setHidden(row.id, !row.hidden)"
              >
                <Eye v-if="!row.hidden" />
                <EyeOff v-else />
              </Button>
            </div>
          </div>

          <div
            v-if="draggedRow"
            class="rows-editor__ghost"
            :style="{ top: `${ghostY}px` }"
          >
            <GripVertical :size="16" class="rows-editor__ghost-icon" />
            <span class="rows-editor__ghost-title">{{ draggedRow.title }}</span>
          </div>
        </div>
      </div>

      <p v-if="!isPhone" class="rows-editor__hint">
        <Info :size="15" />
        {{ $t("edit_rows_hint") }}
      </p>
    </component>
  </Dialog>
</template>

<script setup lang="ts">
import {
  artistRowDefinition,
  artistRowSources,
  effectiveArtistRowSource,
  resolveArtistRows,
  setArtistRowHidden,
  setArtistRowSource,
  setArtistRowsOrder,
  resetArtistRows,
  type ArtistRowId,
  type ArtistRowSource,
} from "@/components/artist/artistRows";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import PanelDragHandle from "@/components/PanelDragHandle.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useListDragReorder } from "@/composables/useListDragReorder";
import { api } from "@/plugins/api";
import type { Artist } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  RotateCcw,
} from "@lucide/vue";
import { computed, ref } from "vue";

export interface Props {
  artist: Artist;
  // the rows that apply to this artist, in default order
  availableIds: ArtistRowId[];
  // per-row "what feeds it" text supplied by the page, e.g. "11 · newest first"
  rowMeta?: Partial<Record<ArtistRowId, string>>;
}
const props = withDefaults(defineProps<Props>(), { rowMeta: undefined });

const open = defineModel<boolean>("open", { default: false });

interface SourceOption {
  value: ArtistRowSource;
  label: string;
  // provider domain, for the icon beside a provider option
  domain?: string;
}

interface EditorRow {
  id: ArtistRowId;
  title: string;
  meta: string;
  hidden: boolean;
  // the source feeding the row, undefined when it has no source picker
  source?: ArtistRowSource;
}

const listEl = ref<HTMLElement | null>(null);

const isPhone = computed(() => isPhoneSizedScreen());

// the dialog and the sheet only differ in how they are sized and dismissed
const chrome = computed(() =>
  isPhone.value
    ? {
        side: "bottom" as const,
        showClose: false,
        "data-player-panel": "",
        class:
          "max-h-[85dvh] gap-0 overflow-hidden rounded-t-2xl p-0 pb-[var(--device-inset-bottom,0px)]",
      }
    : {
        showCloseButton: false,
        class:
          "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]",
      },
);

// reads the user's preferences from the store, so a toggle, a drop or a reset
// re-renders the list from what was just saved
const rows = computed<EditorRow[]>(() => {
  const { order, hidden } = resolveArtistRows(props.availableIds);
  return order.map((id) => {
    const source = artistRowDefinition(id).supportsSource
      ? effectiveArtistRowSource(
          id,
          props.artist,
          api.supportsArtistDiscography,
        )
      : undefined;
    return {
      id,
      title: $t(artistRowDefinition(id).labelKey),
      meta: rowMetaText(id, source),
      hidden: hidden.has(id),
      source,
    };
  });
});

const shownCount = computed(
  () => rows.value.filter((row) => !row.hidden).length,
);

const {
  startItemDrag,
  draggingIndex,
  isDragging,
  dropIndex,
  ghostY,
  dragRowHeight,
  rowOffset,
} = useListDragReorder({
  listEl,
  count: () => rows.value.length,
  onCommit: moveRow,
});

const draggedRow = computed(() =>
  draggingIndex.value != null ? rows.value[draggingIndex.value] : undefined,
);

// the lifted row becomes the dashed landing slot, so it travels to where the
// other rows have opened up instead of staying under them
const dropGapOffset = computed(() => {
  const source = draggingIndex.value;
  const drop = dropIndex.value;
  if (source == null || drop == null) return 0;
  return ((drop > source ? drop - 1 : drop) - source) * dragRowHeight.value;
});

/** The label of a source: the library, every provider, or one of them. */
function sourceLabel(source: ArtistRowSource): string {
  if (source === "library") return $t("source_library");
  if (source === "all") return $t("source_all");
  return api.providers[source]?.name ?? source;
}

/** The sources offered for a row, in the order the picker lists them. */
function sourceOptions(id: ArtistRowId): SourceOption[] {
  return artistRowSources(id, props.artist, api.supportsArtistDiscography).map(
    (source) => ({
      value: source,
      label: sourceLabel(source),
      domain: api.providers[source]?.domain,
    }),
  );
}

function selectSource(id: ArtistRowId, source: unknown) {
  if (typeof source === "string") setArtistRowSource(id, source);
}

function setHidden(id: ArtistRowId, hidden: boolean) {
  setArtistRowHidden(id, hidden);
}

function reset() {
  resetArtistRows();
}

/** Moves the row at `from` to position `to`, by drop or by arrow key. */
function moveRow(from: number, to: number) {
  if (to < 0 || to >= rows.value.length) return;
  const ids = rows.value.map((row) => row.id);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  setArtistRowsOrder(ids, props.availableIds);
}

function slotStyle(index: number) {
  if (!isDragging.value) return undefined;
  const offset =
    index === draggingIndex.value ? dropGapOffset.value : rowOffset(index);
  return {
    transform: `translateY(${offset}px)`,
    transition: "transform 200ms ease-out",
  };
}

/** What feeds a row, below its title. */
function rowMetaText(id: ArtistRowId, source?: ArtistRowSource): string {
  if (artistRowDefinition(id).adminOnly) return $t("admin_only");
  const parts = source ? [sourceLabel(source)] : [];
  const meta = props.rowMeta?.[id];
  if (meta) parts.push(meta);
  return parts.join(" · ");
}
</script>

<style scoped>
.rows-editor__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
}
.rows-editor__heading {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.rows-editor__title {
  font-size: 16px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rows-editor__subtitle {
  font-size: 13px;
  color: var(--muted-foreground);
}

.rows-editor__preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.rows-editor__avatar {
  width: 56px;
  height: 56px;
  flex: none;
  overflow: hidden;
  border-radius: 999px;
}

/* the scroller sits around the list rather than on it: the drag helper measures
   rows against a list that does not scroll under them */
.rows-editor__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 20px 8px;
}
.rows-editor__scroll--phone {
  padding: 0;
}
.rows-editor__list {
  position: relative;
}
/* the slot carries the gap below its row, so a dragged row and the space the
   others slide over are the same height */
.rows-editor__slot {
  padding-bottom: 6px;
}
.rows-editor__list--phone .rows-editor__slot {
  padding-bottom: 0;
}

.rows-editor__row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 12px 0 8px;
  border-radius: 12px;
  background: var(--card);
}
.rows-editor__list--phone .rows-editor__row {
  gap: 10px;
  padding: 0 16px;
  border-radius: 0;
  background: transparent;
  border-bottom: 1px solid var(--border);
}
.rows-editor__row--hidden {
  opacity: 0.45;
}
.rows-editor__list .rows-editor__row--gap {
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  border: 1px dashed color-mix(in srgb, var(--primary) 60%, transparent);
  border-radius: 12px;
}
/* the lifted row is represented by its ghost, so its slot shows only the frame */
.rows-editor__row--gap > * {
  visibility: hidden;
}

.rows-editor__grip {
  display: grid;
  place-items: center;
  width: 28px;
  height: 32px;
  flex: none;
  color: var(--muted-foreground);
  cursor: grab;
  touch-action: none;
}
.rows-editor__grip:active {
  cursor: grabbing;
}
.rows-editor__list--phone .rows-editor__grip {
  width: 24px;
}

.rows-editor__labels {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.rows-editor__name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rows-editor__meta {
  font-size: 12px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rows-editor__badge {
  flex: none;
}

.rows-editor__ghost {
  position: absolute;
  left: 16px;
  right: 16px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: var(--accent);
  border: 1px solid var(--border);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  font-size: 15px;
  font-weight: 500;
  opacity: 0.95;
  pointer-events: none;
  cursor: grabbing;
}
.rows-editor__ghost-icon {
  flex: none;
  opacity: 0.6;
}
.rows-editor__ghost-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rows-editor__hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 20px 28px;
  font-size: 13px;
  color: var(--muted-foreground);
}
.rows-editor__hint svg {
  flex: none;
}
</style>
