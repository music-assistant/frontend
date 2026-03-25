<script lang="ts">
export interface GenreRow {
  id: string;
  genre: Genre;
  displayName: string;
  thumbSrc: string | undefined;
  aliasCount: number;
  trackCount: number | null;
  albumCount: number | null;
  artistCount: number | null;
  playlistCount: number | null;
  podcastCount: number | null;
  audiobookCount: number | null;
}

export interface ExcludedGenreRow {
  id: string;
  genre: Genre;
  displayName: string;
  thumbSrc: string | undefined;
}
</script>

<script setup lang="ts">
import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/vue-table";
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Search,
} from "lucide-vue-next";
import { h, ref } from "vue";
import { useI18n } from "vue-i18n";

import DataTableColumnHeader from "@/components/DataTableColumnHeader.vue";
import DataTableViewOptions from "@/components/DataTableViewOptions.vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toSentenceCase } from "@/helpers/utils";
import type { Genre } from "@/plugins/api/interfaces";
import GenreDataTableRowActions from "./GenreDataTableRowActions.vue";

interface FilterOption {
  value: string;
  label: string;
}

const props = defineProps<{
  data: GenreRow[];
  excludedData: ExcludedGenreRow[];
  loading: boolean;
  countsLoading: boolean;
  filterOptions: FilterOption[];
  pendingId: string | null;
  restorePendingId: string | null;
}>();

const filter = defineModel<string>("filter", { required: true });

const emit = defineEmits<{
  navigate: [genre: Genre];
  "navigate-library": [genre: Genre, mediaType: string];
  exclude: [itemId: string];
  restore: [genre: Genre];
}>();

const { t } = useI18n();

const sorting = ref<SortingState>([]);
const columnFilters = ref<ColumnFiltersState>([]);
const columnVisibility = ref<VisibilityState>({});
const rowSelection = ref({});

function formatCount(val: number | null): string {
  if (val === null) return props.countsLoading ? "…" : "—";
  return val.toLocaleString();
}

type MediaType =
  | "track"
  | "album"
  | "artist"
  | "playlist"
  | "podcast"
  | "audiobook";
type CountKey = `${MediaType}Count`;

const mediaTypeDefs: Array<{
  key: MediaType;
  countKey: CountKey;
  id: string;
}> = [
  { key: "track", countKey: "trackCount", id: "tracks" },
  { key: "album", countKey: "albumCount", id: "albums" },
  { key: "artist", countKey: "artistCount", id: "artists" },
  { key: "playlist", countKey: "playlistCount", id: "playlists" },
  { key: "podcast", countKey: "podcastCount", id: "podcasts" },
  { key: "audiobook", countKey: "audiobookCount", id: "audiobooks" },
];

const columns: ColumnDef<GenreRow>[] = [
  {
    id: "select",
    header: ({ table }) =>
      h(Checkbox, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate"),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          table.toggleAllPageRowsSelected(!!value),
        "aria-label": "Select all",
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          row.toggleSelected(!!value),
        "aria-label": "Select row",
      }),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "genre",
    accessorKey: "displayName",
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<any, unknown>,
        title: toSentenceCase(t("genre_name")),
      }),
    cell: ({ row }) => {
      const r = row.original;
      return h(
        "div",
        {
          class: "flex items-center gap-3 cursor-pointer group/genre",
          onClick: () => emit("navigate", r.genre),
        },
        [
          h(
            "div",
            { class: "flex size-8 shrink-0 items-center justify-center" },
            [
              r.thumbSrc
                ? h("img", {
                    src: r.thumbSrc,
                    class: "size-8 rounded object-cover",
                  })
                : h(GenreIcon, { class: "size-4 text-muted-foreground" }),
            ],
          ),
          h(
            "span",
            { class: "font-medium group-hover/genre:underline" },
            r.displayName,
          ),
        ],
      );
    },
    enableHiding: false,
  },
  {
    id: "aliases",
    accessorKey: "aliasCount",
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<any, unknown>,
        title: toSentenceCase(t("aliases")),
      }),
    cell: ({ row }) =>
      h(
        Badge,
        { variant: "outline", class: "text-muted-foreground px-1.5" },
        () => String(row.original.aliasCount),
      ),
  },
  ...mediaTypeDefs.map(
    ({ key, countKey, id }): ColumnDef<GenreRow> => ({
      id,
      accessorKey: countKey,
      header: ({ column }) =>
        h(DataTableColumnHeader, {
          column: column as Column<any, unknown>,
          title: toSentenceCase(t(`${key}s`)),
        }),
      cell: ({ row }) =>
        h(
          "div",
          {
            class:
              "cursor-pointer tabular-nums text-muted-foreground hover:text-foreground",
            onClick: () => emit("navigate-library", row.original.genre, key),
          },
          formatCount(row.original[countKey]),
        ),
    }),
  ),
  {
    id: "actions",
    cell: ({ row }) =>
      h(GenreDataTableRowActions, {
        pending: props.pendingId === row.original.id,
        onNavigate: () => emit("navigate", row.original.genre),
        onExclude: () => emit("exclude", row.original.id),
      }),
  },
];

const table = useVueTable({
  get data() {
    return props.data;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: (updaterOrValue) => {
    sorting.value =
      typeof updaterOrValue === "function"
        ? updaterOrValue(sorting.value)
        : updaterOrValue;
  },
  onColumnFiltersChange: (updaterOrValue) => {
    columnFilters.value =
      typeof updaterOrValue === "function"
        ? updaterOrValue(columnFilters.value)
        : updaterOrValue;
  },
  onColumnVisibilityChange: (updaterOrValue) => {
    columnVisibility.value =
      typeof updaterOrValue === "function"
        ? updaterOrValue(columnVisibility.value)
        : updaterOrValue;
  },
  onRowSelectionChange: (updaterOrValue) => {
    rowSelection.value =
      typeof updaterOrValue === "function"
        ? updaterOrValue(rowSelection.value)
        : updaterOrValue;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
    get columnFilters() {
      return columnFilters.value;
    },
    get columnVisibility() {
      return columnVisibility.value;
    },
    get rowSelection() {
      return rowSelection.value;
    },
  },
  initialState: {
    pagination: { pageSize: 10 },
  },
});
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
      <div class="relative w-full max-w-sm sm:w-auto">
        <Search
          class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          :model-value="
            (table.getColumn('genre')?.getFilterValue() as string) ?? ''
          "
          :placeholder="$t('search')"
          class="pl-9"
          @update:model-value="table.getColumn('genre')?.setFilterValue($event)"
        />
      </div>
      <div class="flex items-center gap-2">
        <Select v-model="filter">
          <SelectTrigger size="sm" class="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in filterOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <DataTableViewOptions :table="table" />
      </div>
    </div>

    <div class="relative overflow-auto px-4 lg:px-6">
      <div class="overflow-hidden rounded-lg border">
        <div
          v-if="loading"
          class="absolute inset-0 z-10 flex items-center justify-center bg-background/60"
        >
          <Spinner class="size-5" />
        </div>
        <Table class="border-separate border-spacing-0">
          <TableHeader class="bg-muted">
            <TableRow
              v-for="headerGroup in table.getHeaderGroups()"
              :key="headerGroup.id"
            >
              <TableHead
                v-for="header in headerGroup.headers"
                :key="header.id"
                :col-span="header.colSpan"
                :class="header.id === 'genre' ? 'pl-6' : ''"
              >
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="table.getRowModel().rows.length">
              <TableRow
                v-for="row in table.getRowModel().rows"
                :key="row.id"
                :data-state="row.getIsSelected() && 'selected'"
              >
                <TableCell
                  v-for="cell in row.getVisibleCells()"
                  :key="cell.id"
                  :class="cell.column.id === 'genre' ? 'pl-4' : ''"
                >
                  <FlexRender
                    :render="cell.column.columnDef.cell"
                    :props="cell.getContext()"
                  />
                </TableCell>
              </TableRow>
            </template>

            <template v-if="excludedData.length">
              <TableRow
                v-for="row in excludedData"
                :key="`excl-${row.id}`"
                class="opacity-60"
              >
                <TableCell />
                <TableCell>
                  <div class="flex items-center gap-3">
                    <div
                      class="flex size-8 shrink-0 items-center justify-center"
                    >
                      <img
                        v-if="row.thumbSrc"
                        :src="row.thumbSrc"
                        class="size-8 rounded object-cover grayscale"
                      />
                      <GenreIcon v-else class="size-4 text-muted-foreground" />
                    </div>
                    <span class="font-medium line-through">
                      {{ row.displayName }}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  v-for="n in table.getVisibleLeafColumns().length - 3"
                  :key="n"
                  class="text-right text-muted-foreground"
                >
                  —
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-7"
                        :disabled="restorePendingId === row.id"
                        @click="emit('restore', row.genre)"
                      >
                        <Spinner
                          v-if="restorePendingId === row.id"
                          class="size-3.5"
                        />
                        <RefreshCw v-else class="size-3.5 text-primary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ $t("restore_genre") }}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </template>

            <TableRow
              v-if="
                !loading &&
                table.getRowModel().rows.length === 0 &&
                excludedData.length === 0
              "
            >
              <TableCell :col-span="columns.length" class="h-24 text-center">
                {{ $t("no_content") }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <div class="flex items-center justify-between px-4 lg:px-6">
      <div class="text-muted-foreground hidden flex-1 text-sm lg:flex">
        <template v-if="table.getFilteredSelectedRowModel().rows.length > 0">
          {{ table.getFilteredSelectedRowModel().rows.length }} of
          {{ table.getFilteredRowModel().rows.length }} row(s) selected.
        </template>
      </div>
      <div class="flex w-full items-center gap-8 lg:w-fit">
        <div class="hidden items-center gap-2 lg:flex">
          <Label for="rows-per-page" class="text-sm font-medium">
            {{ $t("settings.genre_table_rows_per_page") }}
          </Label>
          <Select
            :model-value="`${table.getState().pagination.pageSize}`"
            @update:model-value="(value) => table.setPageSize(Number(value))"
          >
            <SelectTrigger id="rows-per-page" size="sm" class="w-20">
              <SelectValue
                :placeholder="`${table.getState().pagination.pageSize}`"
              />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem
                v-for="pageSize in [10, 25, 50]"
                :key="pageSize"
                :value="`${pageSize}`"
              >
                {{ pageSize }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex w-fit items-center justify-center text-sm font-medium">
          Page {{ table.getState().pagination.pageIndex + 1 }} of
          {{ table.getPageCount() }}
        </div>
        <div class="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="outline"
            class="hidden size-8 lg:flex"
            size="icon"
            :disabled="!table.getCanPreviousPage()"
            @click="table.setPageIndex(0)"
          >
            <span class="sr-only">Go to first page</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            class="size-8"
            size="icon"
            :disabled="!table.getCanPreviousPage()"
            @click="table.previousPage()"
          >
            <span class="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            class="size-8"
            size="icon"
            :disabled="!table.getCanNextPage()"
            @click="table.nextPage()"
          >
            <span class="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            class="hidden size-8 lg:flex"
            size="icon"
            :disabled="!table.getCanNextPage()"
            @click="table.setPageIndex(table.getPageCount() - 1)"
          >
            <span class="sr-only">Go to last page</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
