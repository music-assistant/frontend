<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1
          class="inline-flex items-center text-2xl font-semibold tracking-tight"
        >
          <Sparkles class="mr-2 h-5 w-5" />
          AI Radio
        </h1>
        <p class="text-sm text-muted-foreground">
          Run, create, and manage AI Radio stations and reusable sections.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" @click="tutorialOpen = true">
          Show Tutorial
        </Button>
        <Button
          variant="outline"
          :disabled="isRefreshing"
          @click="handleRefresh"
        >
          {{ isRefreshing ? "Refreshing..." : "Refresh" }}
        </Button>
      </div>
    </header>

    <Tabs v-model:model-value="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-3 md:w-[480px]">
        <TabsTrigger value="run">Run</TabsTrigger>
        <TabsTrigger value="stations">Stations</TabsTrigger>
        <TabsTrigger value="sections">Sections</TabsTrigger>
      </TabsList>

      <TabsContent value="run" class="mt-4 space-y-4">
        <div class="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Start Run</CardTitle>
              <CardDescription>
                Select a station, then start playlist generation or live queue
                injection.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="space-y-2">
                <Label for="ai-radio-run-station">Station</Label>
                <Select
                  :model-value="selectedRunStationId"
                  @update:model-value="
                    (value) => onSelectRunStation(value as string)
                  "
                >
                  <SelectTrigger id="ai-radio-run-station" class="w-full">
                    <SelectValue placeholder="Select station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="station in stations"
                      :key="station.id"
                      :value="station.id"
                    >
                      {{ station.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                v-if="hasSourcePlaylistOverride"
                class="space-y-2 rounded-md border border-dashed p-3"
              >
                <div class="text-sm font-medium">Source Playlist Override</div>
                <p class="text-xs text-muted-foreground">
                  This run will use the selected playlist from the playlist
                  context menu.
                </p>
                <div class="text-sm">
                  {{ sourcePlaylistOverrideName || sourcePlaylistOverrideId }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ sourcePlaylistOverrideProvider }}:{{
                    sourcePlaylistOverrideId
                  }}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-auto justify-start px-0"
                  @click="clearSourcePlaylistOverride"
                >
                  Use station source playlist
                </Button>
              </div>

              <div class="space-y-2">
                <Label for="ai-radio-run-player"
                  >Playback Device Override (optional)</Label
                >
                <Select
                  :model-value="selectedRunPlayerSelectValue"
                  @update:model-value="
                    (value) => onSelectRunPlayer(value as string)
                  "
                >
                  <SelectTrigger id="ai-radio-run-player" class="w-full">
                    <SelectValue placeholder="Use station default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="DEFAULT_PLAYER_SELECT_VALUE">
                      Use station default
                    </SelectItem>
                    <SelectItem
                      v-for="player in availableRunPlayers"
                      :key="player.player_id"
                      :value="player.player_id"
                    >
                      {{ player.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                  <Label for="ai-radio-run-source-cap"
                    >Source Playtime Cap Override (minutes)</Label
                  >
                  <Input
                    id="ai-radio-run-source-cap"
                    v-model="runSourcePlaytimeCapOverrideInput"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Use station default"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="ai-radio-run-batch-size"
                    >Dynamic Batch Size Override</Label
                  >
                  <Input
                    id="ai-radio-run-batch-size"
                    v-model="runDynamicBatchSizeOverrideInput"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Use station default"
                  />
                </div>
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <Button
                  :disabled="!selectedRunStationId || startingRun"
                  @click="startPlaylistRun"
                >
                  <Sparkles class="mr-1 h-4 w-4" />
                  {{ startingRun ? "Starting..." : "Create Playlist" }}
                </Button>
                <Button
                  :disabled="!selectedRunStationId || startingRun"
                  @click="startDynamicRun"
                >
                  <Sparkles class="mr-1 h-4 w-4" />
                  <Radio class="mr-1 h-4 w-4" />
                  {{ startingRun ? "Starting..." : "Start Live Radio" }}
                </Button>
              </div>

              <div class="border-t pt-3">
                <Button variant="outline" @click="openGuidedStationCreator">
                  Create Station (Guided)
                </Button>
                <p class="mt-2 text-xs text-muted-foreground">
                  Recommended for first setup. Advanced settings can be edited
                  later in the Stations tab.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>
                Latest AI Radio sessions for this server.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                v-if="sessions.length === 0"
                class="text-sm text-muted-foreground"
              >
                No sessions yet.
              </div>
              <ul v-else class="space-y-3">
                <li
                  v-for="session in sessions"
                  :key="session.session_id"
                  class="rounded-md border p-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">{{
                      stationName(session.station_id)
                    }}</span>
                    <Badge :variant="sessionBadgeVariant(session.status)">
                      {{ session.status }}
                    </Badge>
                    <Badge variant="outline">{{ session.mode }}</Badge>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground">
                    Started:
                    {{
                      formatTimestamp(session.started_at || session.created_at)
                    }}
                  </div>
                  <div
                    v-if="sessionProgressSummary(session)"
                    class="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div class="font-medium">
                      {{ sessionProgressSummary(session) }}
                    </div>
                    <div
                      v-if="sessionProgressDetails(session)"
                      class="mt-1 text-muted-foreground"
                    >
                      {{ sessionProgressDetails(session) }}
                    </div>
                  </div>
                  <div
                    v-if="session.error"
                    class="mt-2 text-sm text-destructive"
                  >
                    {{ session.error }}
                  </div>
                  <div v-if="session.status === 'running'" class="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="stoppingRun"
                      @click="stopSession(session.session_id)"
                    >
                      {{ stoppingRun ? "Stopping..." : "Stop" }}
                    </Button>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="stations" class="mt-4">
        <div class="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Stations</CardTitle>
              <CardDescription
                >Select and manage station profiles.</CardDescription
              >
            </CardHeader>
            <CardContent class="space-y-3">
              <div class="flex flex-wrap gap-2">
                <Button size="sm" @click="createNewStationDraft">New</Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="openGuidedStationCreator"
                >
                  Guided
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="triggerStationImport"
                >
                  Import
                </Button>
              </div>
              <input
                ref="stationImportInput"
                type="file"
                accept="application/json"
                class="hidden"
                @change="onStationImport"
              />

              <div
                class="max-h-[560px] space-y-1 overflow-y-auto rounded-md border p-2"
              >
                <button
                  v-for="station in stations"
                  :key="station.id"
                  class="w-full rounded-md px-3 py-2 text-left text-sm transition"
                  :class="
                    selectedEditorStationId === station.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  "
                  @click="selectStationForEdit(station.id)"
                >
                  <div class="font-medium">{{ station.name }}</div>
                  <div class="text-xs opacity-80">{{ station.id }}</div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Station Editor</CardTitle>
              <CardDescription>
                Configure source playlist, section selection, flow rules, and
                runtime profile.
              </CardDescription>
            </CardHeader>
            <CardContent v-if="stationDraft" class="space-y-6">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2 md:col-span-2">
                  <Label for="station-name">Station Name</Label>
                  <Input id="station-name" v-model="stationDraft.name" />
                </div>

                <div class="space-y-2">
                  <Label for="station-source-select">Source Playlist</Label>
                  <select
                    id="station-source-select"
                    v-model="stationSourcePlaylistSelectValue"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">-- Select --</option>
                    <option
                      v-for="playlist in playlists"
                      :key="
                        playlistSelectValue(playlist.provider, playlist.item_id)
                      "
                      :value="
                        playlistSelectValue(playlist.provider, playlist.item_id)
                      "
                    >
                      {{ playlist.name }} ({{ playlist.provider }}:{{
                        playlist.item_id
                      }})
                    </option>
                    <option value="__custom__">Custom source playlist</option>
                  </select>
                </div>

                <div class="space-y-2">
                  <Label for="station-default-player"
                    >Default Playback Device (optional)</Label
                  >
                  <select
                    id="station-default-player"
                    v-model="stationDraft.default_player_id"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">-- None --</option>
                    <option
                      v-for="player in players"
                      :key="player.player_id"
                      :value="player.player_id"
                    >
                      {{ player.name
                      }}{{
                        player.available === false ? " (Not available)" : ""
                      }}
                    </option>
                  </select>
                </div>

                <div
                  v-if="stationSourcePlaylistSelectValue === '__custom__'"
                  class="space-y-2"
                >
                  <Label for="station-source-provider"
                    >Source Playlist Provider</Label
                  >
                  <Input
                    id="station-source-provider"
                    v-model="stationDraft.source_playlist_provider"
                  />
                </div>

                <div
                  v-if="stationSourcePlaylistSelectValue === '__custom__'"
                  class="space-y-2"
                >
                  <Label for="station-source-id">Source Playlist ID</Label>
                  <Input
                    id="station-source-id"
                    v-model="stationDraft.source_playlist_id"
                  />
                </div>

                <div class="space-y-2">
                  <Label for="station-duration-cap"
                    >Source Playtime Cap (minutes)</Label
                  >
                  <Input
                    id="station-duration-cap"
                    v-model="stationMaxDurationInput"
                    type="number"
                    min="0"
                    step="1"
                  />
                </div>

                <div class="space-y-2">
                  <Label for="station-target-provider"
                    >Target Playlist Provider</Label
                  >
                  <Input
                    id="station-target-provider"
                    v-model="stationDraft.target_playlist_provider"
                  />
                </div>

                <div class="space-y-2 md:col-span-2">
                  <Label for="station-sections"
                    >Selected Sections (shared library)</Label
                  >
                  <select
                    id="station-sections"
                    class="min-h-[180px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    multiple
                    :value="stationDraft.section_ids"
                    @change="onStationSectionIdsChange"
                  >
                    <option
                      v-for="section in sections"
                      :key="section.id"
                      :value="section.id"
                    >
                      {{ section.name }}
                    </option>
                  </select>
                  <p class="text-xs text-muted-foreground">
                    Cmd/Ctrl-click for multi-select.
                  </p>
                </div>

                <div class="space-y-2 md:col-span-2">
                  <Label for="station-merge-section"
                    >Merge Section (optional)</Label
                  >
                  <select
                    id="station-merge-section"
                    v-model="stationDraft.merge_section_id"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">-- None --</option>
                    <option
                      v-for="option in mergeSectionOptions"
                      :key="option.id"
                      :value="option.id"
                    >
                      {{ option.name }}
                    </option>
                  </select>
                  <p class="text-xs text-muted-foreground">
                    Used when one between-song slot generates multiple spoken
                    sections.
                  </p>
                </div>
              </div>

              <div class="space-y-3 rounded-md border p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 class="text-base font-semibold">Playback Flow Rules</h3>
                    <p class="text-xs text-muted-foreground">
                      MUST always includes, ALTERNATIVE picks one weighted
                      choice, OPTIONAL runs by chance and guards.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" @click="addOrderRule"
                    >Add Placement Rule</Button
                  >
                </div>

                <div
                  v-if="!stationDraft.section_order?.length"
                  class="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
                >
                  No flow rules configured yet.
                </div>

                <div
                  v-for="(rule, ruleIndex) in stationDraft.section_order"
                  :key="`rule-${ruleIndex}`"
                  class="space-y-3 rounded-md border p-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <Label class="sr-only">Placement</Label>
                    <select
                      :value="rule.when"
                      class="h-9 rounded-md border bg-background px-3 text-sm"
                      @change="onOrderPlacementChange(ruleIndex, $event)"
                    >
                      <option value="start_of_playlist">
                        Start of Playlist
                      </option>
                      <option value="between_songs">Between Songs</option>
                      <option value="end_of_playlist">End of Playlist</option>
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="moveOrderRule(ruleIndex, -1)"
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="moveOrderRule(ruleIndex, 1)"
                    >
                      Down
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="addFlowItem(ruleIndex)"
                    >
                      Add Flow Item
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      @click="removeOrderRule(ruleIndex)"
                    >
                      Remove Rule
                    </Button>
                  </div>

                  <div class="space-y-2">
                    <div
                      v-for="(flowItem, flowIndex) in rule.flow"
                      :key="`flow-${ruleIndex}-${flowIndex}`"
                      class="space-y-2 rounded-md border border-dashed p-3"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <select
                          :value="getFlowType(flowItem)"
                          class="h-9 rounded-md border bg-background px-3 text-sm"
                          @change="
                            onFlowTypeChange(ruleIndex, flowIndex, $event)
                          "
                        >
                          <option value="MUST">MUST</option>
                          <option value="ALTERNATIVE">ALTERNATIVE</option>
                          <option value="OPTIONAL">OPTIONAL</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          @click="removeFlowItem(ruleIndex, flowIndex)"
                        >
                          Remove
                        </Button>
                      </div>

                      <div
                        v-if="getFlowType(flowItem) === 'MUST'"
                        class="space-y-2"
                      >
                        <Label class="text-xs">Section</Label>
                        <select
                          :value="getMustSection(flowItem)"
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          @change="
                            onMustSectionChange(ruleIndex, flowIndex, $event)
                          "
                        >
                          <option value="">-- Select section --</option>
                          <option
                            v-for="section in stationSelectedSections"
                            :key="`must-${section.id}`"
                            :value="section.id"
                          >
                            {{ section.name }}
                          </option>
                        </select>
                      </div>

                      <div
                        v-else-if="getFlowType(flowItem) === 'ALTERNATIVE'"
                        class="space-y-2"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <Label class="text-xs">Weighted Choices</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            @click="addAlternativeChoice(ruleIndex, flowIndex)"
                          >
                            Add Choice
                          </Button>
                        </div>
                        <div
                          v-for="(choice, choiceIndex) in getAlternativeChoices(
                            flowItem,
                          )"
                          :key="`choice-${ruleIndex}-${flowIndex}-${choiceIndex}`"
                          class="grid gap-2 md:grid-cols-[1fr_160px_auto]"
                        >
                          <select
                            :value="choice.section"
                            class="h-9 rounded-md border bg-background px-3 text-sm"
                            @change="
                              onAlternativeChoiceSectionChange(
                                ruleIndex,
                                flowIndex,
                                choiceIndex,
                                $event,
                              )
                            "
                          >
                            <option value="">-- Select section --</option>
                            <option
                              v-for="section in stationSelectedSections"
                              :key="`alt-${section.id}`"
                              :value="section.id"
                            >
                              {{ section.name }}
                            </option>
                          </select>
                          <Input
                            :model-value="String(choice.weight ?? 1)"
                            type="number"
                            min="0"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onAlternativeChoiceWeightChange(
                                  ruleIndex,
                                  flowIndex,
                                  choiceIndex,
                                  value,
                                )
                            "
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            @click="
                              removeAlternativeChoice(
                                ruleIndex,
                                flowIndex,
                                choiceIndex,
                              )
                            "
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div v-else class="grid gap-2 md:grid-cols-2">
                        <div class="space-y-2">
                          <Label class="text-xs">Section</Label>
                          <select
                            :value="getOptionalSection(flowItem)"
                            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            @change="
                              onOptionalSectionChange(
                                ruleIndex,
                                flowIndex,
                                $event,
                              )
                            "
                          >
                            <option value="">-- Select section --</option>
                            <option
                              v-for="section in stationSelectedSections"
                              :key="`opt-${section.id}`"
                              :value="section.id"
                            >
                              {{ section.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-2">
                          <Label class="text-xs">Chance (%)</Label>
                          <Input
                            :model-value="
                              String(getOptionalChancePercent(flowItem))
                            "
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onOptionalChanceChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                        <div class="space-y-2">
                          <Label class="text-xs">Guard: Minimum Song Gap</Label>
                          <Input
                            :model-value="String(getOptionalMinGap(flowItem))"
                            type="number"
                            min="0"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onOptionalMinGapChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                        <div class="space-y-2">
                          <Label class="text-xs"
                            >Guard: Max Per 60 Minutes</Label
                          >
                          <Input
                            :model-value="String(getOptionalMaxPer60(flowItem))"
                            type="number"
                            min="0"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onOptionalMaxPerChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                        <div class="space-y-2 md:col-span-2">
                          <Label class="text-xs"
                            >Guard: Required Placeholders (comma
                            separated)</Label
                          >
                          <Input
                            :model-value="getOptionalPlaceholders(flowItem)"
                            @update:model-value="
                              (value) =>
                                onOptionalPlaceholdersChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <details class="rounded-md border p-4">
                <summary class="cursor-pointer select-none text-sm font-medium">
                  Advanced Runtime and Provider Settings
                </summary>
                <div
                  class="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2 md:gap-x-8 [&>div]:min-w-0"
                >
                  <div class="space-y-2">
                    <Label for="station-id">Station ID (technical key)</Label>
                    <Input id="station-id" v-model="stationDraft.id" />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-clear-queue"
                      >Clear Queue on Dynamic Start</Label
                    >
                    <div class="flex h-10 items-center rounded-md border px-3">
                      <input
                        id="station-clear-queue"
                        v-model="stationDraft.clear_queue_on_start"
                        type="checkbox"
                        class="h-4 w-4"
                      />
                    </div>
                  </div>

                  <div class="space-y-2">
                    <Label for="station-dynamic-batch"
                      >Dynamic Batch Size</Label
                    >
                    <Input
                      id="station-dynamic-batch"
                      v-model="stationDynamicBatchSizeInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-dynamic-prefetch"
                      >Dynamic Prefetch Remaining Tracks</Label
                    >
                    <Input
                      id="station-dynamic-prefetch"
                      v-model="stationDynamicPrefetchInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="station-dynamic-poll"
                      >Dynamic Poll Seconds</Label
                    >
                    <Input
                      id="station-dynamic-poll"
                      v-model="stationDynamicPollInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="station-general-model">Model</Label>
                    <Input
                      id="station-general-model"
                      v-model="stationDraft.general.model"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-temp">Temperature</Label>
                    <Input
                      id="station-general-temp"
                      v-model="stationTemperatureInput"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-max-tokens">Max Tokens</Label>
                    <Input
                      id="station-general-max-tokens"
                      v-model="stationMaxTokensInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-timezone">Timezone</Label>
                    <Input
                      id="station-general-timezone"
                      v-model="stationDraft.general.timezone"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-city">Weather City</Label>
                    <Input
                      id="station-general-city"
                      v-model="stationDraft.general.location.city"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-country">Weather Country</Label>
                    <Input
                      id="station-general-country"
                      v-model="stationDraft.general.location.country"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-weather-provider"
                      >Weather Provider</Label
                    >
                    <Input
                      id="station-general-weather-provider"
                      v-model="stationDraft.general.weather_provider"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-weather-timeout"
                      >Weather Timeout Seconds</Label
                    >
                    <Input
                      id="station-general-weather-timeout"
                      v-model="stationWeatherTimeoutInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-openai-url"
                      >OpenAI Base URL</Label
                    >
                    <Input
                      id="station-general-openai-url"
                      v-model="stationDraft.general.openai_base_url"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-section-store"
                      >Section Store Path</Label
                    >
                    <Input
                      id="station-general-section-store"
                      v-model="stationDraft.general.section_store_path"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-tts-provider"
                      >TTS Provider</Label
                    >
                    <select
                      id="station-general-tts-provider"
                      v-model="stationDraft.general.tts_provider"
                      class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="elevenlabs">ElevenLabs</option>
                    </select>
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-openai-tts-model"
                      >OpenAI TTS Model</Label
                    >
                    <Input
                      id="station-general-openai-tts-model"
                      v-model="stationDraft.general.openai_tts_model"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-openai-tts-voice"
                      >OpenAI TTS Voice</Label
                    >
                    <Input
                      id="station-general-openai-tts-voice"
                      v-model="stationDraft.general.openai_tts_voice"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-eleven-model"
                      >ElevenLabs Model</Label
                    >
                    <Input
                      id="station-general-eleven-model"
                      v-model="stationDraft.general.elevenlabs_model"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-eleven-voice"
                      >ElevenLabs Voice ID</Label
                    >
                    <Input
                      id="station-general-eleven-voice"
                      v-model="stationDraft.general.elevenlabs_voice_id"
                    />
                  </div>
                  <div class="space-y-2 md:col-span-2">
                    <Label for="station-general-instructions"
                      >Host and Program Instructions</Label
                    >
                    <Textarea
                      id="station-general-instructions"
                      v-model="stationDraft.general.instructions"
                      rows="6"
                    />
                  </div>
                  <div class="space-y-2 md:col-span-2">
                    <Label for="station-general-openai-tts-instructions">
                      OpenAI TTS Delivery Instructions
                    </Label>
                    <Textarea
                      id="station-general-openai-tts-instructions"
                      v-model="stationDraft.general.openai_tts_instructions"
                      rows="4"
                    />
                  </div>
                </div>
              </details>

              <div class="flex flex-wrap gap-2">
                <Button :disabled="savingStation" @click="saveStationDraft">
                  {{ savingStation ? "Saving..." : "Save Station" }}
                </Button>
                <Button variant="outline" @click="validateStationDraftOnServer">
                  Validate
                </Button>
                <Button variant="outline" @click="exportStationDraft"
                  >Export</Button
                >
                <Button
                  variant="destructive"
                  :disabled="!selectedEditorStationId || deletingStation"
                  @click="removeSelectedStation"
                >
                  {{ deletingStation ? "Deleting..." : "Delete" }}
                </Button>
              </div>
            </CardContent>
            <CardContent v-else>
              <p class="text-sm text-muted-foreground">
                No station selected. Create a new station to begin.
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="sections" class="mt-4">
        <div class="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <CardDescription
                >Reusable prompt blocks shared across stations.</CardDescription
              >
            </CardHeader>
            <CardContent class="space-y-3">
              <div class="flex flex-wrap gap-2">
                <Button size="sm" @click="createNewSectionDraft">New</Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="triggerSectionImport"
                >
                  Import
                </Button>
              </div>
              <input
                ref="sectionImportInput"
                type="file"
                accept="application/json"
                class="hidden"
                @change="onSectionImport"
              />

              <div
                class="max-h-[560px] space-y-1 overflow-y-auto rounded-md border p-2"
              >
                <button
                  v-for="section in sections"
                  :key="section.id"
                  class="w-full rounded-md px-3 py-2 text-left text-sm transition"
                  :class="
                    selectedEditorSectionId === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  "
                  @click="selectSectionForEdit(section.id)"
                >
                  <div class="font-medium">{{ section.name }}</div>
                  <div class="text-xs opacity-80">{{ section.id }}</div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section Editor</CardTitle>
              <CardDescription>
                Define prompt templates, web-search mode, and section
                constraints.
              </CardDescription>
            </CardHeader>
            <CardContent v-if="sectionDraft" class="space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2 md:col-span-2">
                  <Label for="section-name">Section Name</Label>
                  <Input id="section-name" v-model="sectionDraft.name" />
                </div>

                <div class="space-y-2">
                  <Label for="section-type">Section Type</Label>
                  <select
                    id="section-type"
                    v-model="sectionDraft.type"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="ai_text">ai_text</option>
                    <option value="ai_meta">ai_meta</option>
                  </select>
                </div>

                <div
                  class="space-y-2"
                  :class="{ 'opacity-60': sectionDraft.type !== 'ai_text' }"
                >
                  <Label for="section-web-search">Web Search Mode</Label>
                  <select
                    id="section-web-search"
                    v-model="sectionDraft.web_search"
                    :disabled="sectionDraft.type !== 'ai_text'"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="disabled">disabled (no web tool)</option>
                    <option value="allow">allow (model may use web)</option>
                    <option value="force">force (web search required)</option>
                  </select>
                </div>

                <div
                  class="space-y-2"
                  :class="{ 'opacity-60': sectionDraft.type !== 'ai_text' }"
                >
                  <Label for="section-max-chars">Character Limit</Label>
                  <Input
                    id="section-max-chars"
                    :model-value="
                      String(sectionDraft.constraints?.max_chars ?? 0)
                    "
                    :disabled="sectionDraft.type !== 'ai_text'"
                    type="number"
                    min="0"
                    step="1"
                    @update:model-value="onSectionMaxCharsChange"
                  />
                </div>

                <div class="space-y-2 md:col-span-2">
                  <Label for="section-prompt">Prompt</Label>
                  <Textarea
                    id="section-prompt"
                    v-model="sectionDraft.prompt"
                    rows="8"
                  />
                </div>
              </div>

              <details class="rounded-md border p-4">
                <summary class="cursor-pointer select-none text-sm font-medium">
                  Advanced
                </summary>
                <div class="mt-4 space-y-2">
                  <Label for="section-id">Section ID (technical key)</Label>
                  <Input id="section-id" v-model="sectionDraft.id" />
                </div>
              </details>

              <div class="flex flex-wrap gap-2">
                <Button :disabled="savingSection" @click="saveSectionDraft">
                  {{ savingSection ? "Saving..." : "Save Section" }}
                </Button>
                <Button variant="outline" @click="exportSectionDraft"
                  >Export</Button
                >
                <Button
                  variant="destructive"
                  :disabled="!selectedEditorSectionId || deletingSection"
                  @click="removeSelectedSection"
                >
                  {{ deletingSection ? "Deleting..." : "Delete" }}
                </Button>
              </div>
            </CardContent>
            <CardContent v-else>
              <p class="text-sm text-muted-foreground">
                No section selected. Create a new section to begin.
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="guidedWizardOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Create Station (Guided)</DialogTitle>
          <DialogDescription>
            Step-by-step setup for a working station. You can fine-tune all
            advanced options later.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="text-xs text-muted-foreground">
            Step {{ guidedWizardStep }} of 3
          </div>

          <div v-if="guidedWizardStep === 1" class="space-y-4">
            <div class="space-y-2">
              <Label for="guided-station-name">Station Name</Label>
              <Input
                id="guided-station-name"
                v-model="guidedWizardStationName"
                placeholder="My AI Radio Station"
              />
            </div>

            <div class="space-y-2">
              <Label for="guided-source-playlist">Source Playlist</Label>
              <select
                id="guided-source-playlist"
                v-model="guidedWizardSourcePlaylistSelectValue"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">-- Select --</option>
                <option
                  v-for="playlist in playlists"
                  :key="
                    playlistSelectValue(playlist.provider, playlist.item_id)
                  "
                  :value="
                    playlistSelectValue(playlist.provider, playlist.item_id)
                  "
                >
                  {{ playlist.name }} ({{ playlist.provider }}:{{
                    playlist.item_id
                  }})
                </option>
              </select>
            </div>

            <div class="space-y-2">
              <Label for="guided-default-player"
                >Default Playback Device (optional)</Label
              >
              <select
                id="guided-default-player"
                v-model="guidedWizardDefaultPlayerId"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">-- None --</option>
                <option
                  v-for="player in players"
                  :key="player.player_id"
                  :value="player.player_id"
                >
                  {{ player.name
                  }}{{ player.available === false ? " (Not available)" : "" }}
                </option>
              </select>
            </div>
          </div>

          <div v-else-if="guidedWizardStep === 2" class="space-y-5">
            <div class="space-y-2">
              <Label>Choose Existing Sections</Label>
              <p class="text-xs text-muted-foreground">
                Select spoken sections and assign where each should be inserted
                in the generated flow.
              </p>
              <div
                class="max-h-[240px] space-y-2 overflow-y-auto rounded-md border p-3"
              >
                <label
                  v-for="section in wizardSelectableSections"
                  :key="`guided-${section.id}`"
                  class="flex items-start gap-2 rounded-md border p-2"
                >
                  <input
                    type="checkbox"
                    class="mt-1 h-4 w-4"
                    :checked="guidedWizardSectionIds.includes(section.id)"
                    @change="onGuidedSectionToggle(section.id, $event)"
                  />
                  <span class="text-sm">
                    <span class="font-medium">{{ section.name }}</span>
                  </span>
                </label>
              </div>
            </div>

            <div class="space-y-2 rounded-md border p-3">
              <Label>Add New Section</Label>
              <p class="text-xs text-muted-foreground">
                Create a new section here and add it to this station instantly.
              </p>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-2">
                  <Label for="guided-new-section-name">Section Name</Label>
                  <Input
                    id="guided-new-section-name"
                    v-model="guidedNewSectionName"
                    placeholder="Artist Fact"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="guided-new-section-placement">Insert At</Label>
                  <select
                    id="guided-new-section-placement"
                    v-model="guidedNewSectionPlacement"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="start_of_playlist">Start of Playlist</option>
                    <option value="between_songs">Between Songs</option>
                    <option value="end_of_playlist">End of Playlist</option>
                  </select>
                </div>
                <div class="space-y-2 md:col-span-2">
                  <Label for="guided-new-section-prompt">Prompt</Label>
                  <Textarea
                    id="guided-new-section-prompt"
                    v-model="guidedNewSectionPrompt"
                    rows="4"
                  />
                </div>
              </div>
              <Button
                class="mt-1"
                variant="outline"
                :disabled="creatingGuidedSection"
                @click="createGuidedSection"
              >
                {{ creatingGuidedSection ? "Adding..." : "Add Section" }}
              </Button>
            </div>

            <div class="space-y-2">
              <Label>Selected Sections and Placement</Label>
              <div
                v-if="guidedWizardSelectedSections.length === 0"
                class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
              >
                No sections selected yet.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="section in guidedWizardSelectedSections"
                  :key="`guided-placement-${section.id}`"
                  class="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[1fr_220px]"
                >
                  <div class="text-sm font-medium">{{ section.name }}</div>
                  <select
                    :value="
                      guidedWizardSectionPlacements[section.id] ||
                      'between_songs'
                    "
                    class="h-9 rounded-md border bg-background px-3 text-sm"
                    @change="onGuidedSectionPlacementChange(section.id, $event)"
                  >
                    <option value="start_of_playlist">Start of Playlist</option>
                    <option value="between_songs">Between Songs</option>
                    <option value="end_of_playlist">End of Playlist</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="guided-merge-section">Merge Section (optional)</Label>
              <select
                id="guided-merge-section"
                v-model="guidedWizardMergeSectionId"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">-- None --</option>
                <option
                  v-for="section in guidedWizardMergeSectionOptions"
                  :key="`guided-merge-${section.id}`"
                  :value="section.id"
                >
                  {{ section.name }}
                </option>
              </select>
              <p class="text-xs text-muted-foreground">
                Used when a between-song slot contains multiple spoken sections.
              </p>
            </div>
          </div>

          <div v-else class="space-y-3 text-sm">
            <div class="rounded-md border p-3">
              <div>
                <span class="font-medium">Name:</span>
                {{ guidedWizardStationName }}
              </div>
              <div>
                <span class="font-medium">Source:</span>
                {{ guidedWizardSourcePlaylistLabel }}
              </div>
              <div>
                <span class="font-medium">Sections:</span>
                {{ guidedWizardSelectedSectionNames.join(", ") || "None" }}
              </div>
              <div v-if="guidedWizardSectionPlacementSummary.length">
                <span class="font-medium">Placement:</span>
                {{ guidedWizardSectionPlacementSummary.join(" | ") }}
              </div>
              <div v-if="guidedWizardMergeSectionName">
                <span class="font-medium">Merge Section:</span>
                {{ guidedWizardMergeSectionName }}
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              The wizard will generate a sensible default section flow. You can
              edit the exact flow in the Station Editor afterwards.
            </p>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" @click="guidedWizardOpen = false">
            Cancel
          </Button>
          <Button
            v-if="guidedWizardStep > 1"
            variant="outline"
            @click="guidedWizardStep = guidedWizardStep - 1"
          >
            Back
          </Button>
          <Button
            v-if="guidedWizardStep < 3"
            :disabled="!canProceedGuidedWizardStep"
            @click="guidedWizardStep = guidedWizardStep + 1"
          >
            Next
          </Button>
          <Button
            v-else
            :disabled="creatingGuidedStation"
            @click="createGuidedStation"
          >
            {{ creatingGuidedStation ? "Creating..." : "Create Station" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="tutorialOpen">
      <DialogContent class="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>AI Radio Tutorial</DialogTitle>
          <DialogDescription>
            Quick overview of sections, stations, and flow rules.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 text-sm">
          <div class="rounded-md border p-3">
            <div class="font-medium">What is a Station?</div>
            <p class="mt-1 text-muted-foreground">
              A station is the complete profile for a run: source playlist,
              chosen sections, and flow rules that define where spoken segments
              are inserted.
            </p>
          </div>

          <div class="rounded-md border p-3">
            <div class="font-medium">What is a Section?</div>
            <p class="mt-1 text-muted-foreground">
              A section is a reusable prompt template. Stations reference
              sections so you can reuse the same intro/news/weather blocks
              across multiple stations.
            </p>
          </div>

          <div class="rounded-md border p-3">
            <div class="font-medium">How Flow Rules Work</div>
            <p class="mt-1 text-muted-foreground">
              Flow rules are evaluated per placement (start, between songs,
              end). MUST always inserts a section. ALTERNATIVE picks one
              weighted option. OPTIONAL inserts by chance and guard conditions.
            </p>
          </div>

          <div class="rounded-md border p-3">
            <div class="font-medium">Run Modes</div>
            <p class="mt-1 text-muted-foreground">
              Create Playlist generates a prepared playlist first. Start Live
              Radio generates in dynamic batches and injects directly into a
              player queue.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button @click="closeTutorial">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAiRadio } from "@/composables/useAiRadio";
import { useAiRadioEditor } from "@/composables/useAiRadioEditor";
import type {
  AIRadioAlternativeChoice,
  AIRadioFlowItem,
  AIRadioMode,
  AIRadioOptionalGuards,
  AIRadioPlacement,
  AIRadioSection,
  AIRadioSectionOrderRule,
  AIRadioSession,
  AIRadioStation,
  AIRadioStationGeneral,
  Player,
  Playlist,
} from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Radio, Sparkles } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

const DEFAULT_PLAYER_SELECT_VALUE = "__station_default__";
const AUTO_REFRESH_MS = 5000;
const TUTORIAL_SEEN_STORAGE_KEY = "ai_radio_tutorial_seen_v1";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
type AIRadioFlowType = "MUST" | "ALTERNATIVE" | "OPTIONAL";
type AIRadioStationDraft = Omit<AIRadioStation, "general"> & {
  general: AIRadioStationGeneral;
};
type AIRadioProgressPhase =
  | "fetch_source_tracks"
  | "initializing_queue"
  | "planning_sections"
  | "generating_llm"
  | "generating_tts"
  | "publishing_playlist"
  | "queueing_batch"
  | "waiting_for_playback"
  | "running";

const activeTab = ref<"run" | "stations" | "sections">("run");

const route = useRoute();
const router = useRouter();

const {
  sessions,
  loadingStatus,
  startingRun,
  stoppingRun,
  startRun,
  stopRun,
  loadStatus,
} = useAiRadio();

const {
  stations,
  sections,
  players,
  playlists,
  loadingStations,
  loadingSections,
  loadingPlayers,
  loadingPlaylists,
  savingStation,
  deletingStation,
  savingSection,
  deletingSection,
  refreshEditor,
  saveStation,
  deleteStation,
  getStation,
  validateStation,
  saveSection,
  deleteSection,
  getSection,
  createStationDraftFromTemplate,
  createSectionDraftFromTemplate,
  deepClone,
} = useAiRadioEditor();

const selectedRunStationId = ref("");
const selectedRunPlayerId = ref("");
const runSourcePlaytimeCapOverrideInput = ref("");
const runDynamicBatchSizeOverrideInput = ref("");

const sourcePlaylistOverrideId = ref("");
const sourcePlaylistOverrideProvider = ref("");
const sourcePlaylistOverrideName = ref("");

const selectedEditorStationId = ref("");
const stationDraft = ref<AIRadioStationDraft | null>(null);

const selectedEditorSectionId = ref("");
const sectionDraft = ref<AIRadioSection | null>(null);

const stationImportInput = ref<HTMLInputElement | null>(null);
const sectionImportInput = ref<HTMLInputElement | null>(null);

const guidedWizardOpen = ref(false);
const guidedWizardStep = ref(1);
const creatingGuidedStation = ref(false);
const guidedWizardStationName = ref("");
const guidedWizardSourcePlaylistSelectValue = ref("");
const guidedWizardDefaultPlayerId = ref("");
const guidedWizardSectionIds = ref<string[]>([]);
const guidedWizardMergeSectionId = ref("");
const guidedWizardSectionPlacements = ref<Record<string, AIRadioPlacement>>({});
const creatingGuidedSection = ref(false);
const guidedNewSectionName = ref("");
const guidedNewSectionPrompt = ref("");
const guidedNewSectionPlacement = ref<AIRadioPlacement>("between_songs");

const tutorialOpen = ref(false);

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const isRefreshing = computed(() => {
  return (
    loadingStatus.value ||
    loadingStations.value ||
    loadingSections.value ||
    loadingPlayers.value ||
    loadingPlaylists.value
  );
});

const stationById = computed(() => {
  const output = new Map<string, string>();
  for (const station of stations.value) {
    output.set(station.id, station.name);
  }
  return output;
});

const availableRunPlayers = computed<Player[]>(() => {
  return players.value
    .filter((player) => player.available !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
});

const selectedRunPlayerSelectValue = computed(() => {
  return selectedRunPlayerId.value || DEFAULT_PLAYER_SELECT_VALUE;
});

const hasSourcePlaylistOverride = computed(() => {
  return Boolean(
    sourcePlaylistOverrideId.value && sourcePlaylistOverrideProvider.value,
  );
});

const stationSourcePlaylistSelectValue = computed({
  get: () => {
    if (!stationDraft.value) {
      return "";
    }
    const provider = String(
      stationDraft.value.source_playlist_provider || "",
    ).trim();
    const itemId = String(stationDraft.value.source_playlist_id || "").trim();
    if (!provider || !itemId) {
      return "";
    }
    const value = playlistSelectValue(provider, itemId);
    const inList = playlists.value.some(
      (item) => playlistSelectValue(item.provider, item.item_id) === value,
    );
    return inList ? value : "__custom__";
  },
  set: (value: string) => {
    if (!stationDraft.value || !value) {
      return;
    }
    if (value === "__custom__") {
      if (!stationDraft.value.source_playlist_provider) {
        stationDraft.value.source_playlist_provider = "library";
      }
      return;
    }
    const { provider, itemId } = splitPlaylistSelectValue(value);
    stationDraft.value.source_playlist_provider = provider;
    stationDraft.value.source_playlist_id = itemId;
  },
});

const stationSelectedSections = computed<AIRadioSection[]>(() => {
  if (!stationDraft.value) {
    return [];
  }
  const selected = new Set(stationDraft.value.section_ids || []);
  return sections.value.filter((section) => selected.has(section.id));
});

const mergeSectionOptions = computed(() => {
  return stationSelectedSections.value.filter(
    (section) => section.type === "ai_meta",
  );
});

const guidedWizardSectionById = computed(() => {
  const output = new Map<string, AIRadioSection>();
  for (const section of sections.value) {
    output.set(section.id, section);
  }
  return output;
});

const wizardSelectableSections = computed(() => {
  return sections.value
    .filter((section) => section.type === "ai_text")
    .sort((a, b) => a.name.localeCompare(b.name));
});

const guidedWizardSelectedSections = computed<AIRadioSection[]>(() => {
  return guidedWizardSectionIds.value
    .map((sectionId) => guidedWizardSectionById.value.get(sectionId))
    .filter((section): section is AIRadioSection => Boolean(section));
});

const guidedWizardMergeSectionOptions = computed<AIRadioSection[]>(() => {
  const selectedMeta = guidedWizardSelectedSections.value.filter(
    (section) => section.type === "ai_meta",
  );
  if (selectedMeta.length) {
    return selectedMeta;
  }
  return sections.value.filter((section) => section.type === "ai_meta");
});

const guidedWizardSelectedSectionNames = computed(() => {
  return guidedWizardSelectedSections.value.map((section) => section.name);
});

const guidedWizardMergeSectionName = computed(() => {
  if (!guidedWizardMergeSectionId.value) {
    return "";
  }
  return (
    guidedWizardSectionById.value.get(guidedWizardMergeSectionId.value)?.name ||
    guidedWizardMergeSectionId.value
  );
});

const guidedWizardSectionPlacementSummary = computed(() => {
  return guidedWizardSelectedSections.value.map((section) => {
    const placement =
      guidedWizardSectionPlacements.value[section.id] || "between_songs";
    const placementLabel =
      placement === "start_of_playlist"
        ? "Start"
        : placement === "end_of_playlist"
          ? "End"
          : "Between";
    return `${section.name} → ${placementLabel}`;
  });
});

const guidedWizardSourcePlaylistLabel = computed(() => {
  if (!guidedWizardSourcePlaylistSelectValue.value) {
    return "-";
  }
  const { provider, itemId } = splitPlaylistSelectValue(
    guidedWizardSourcePlaylistSelectValue.value,
  );
  const playlist = playlists.value.find(
    (item) => item.provider === provider && item.item_id === itemId,
  );
  if (!playlist) {
    return `${provider}:${itemId}`;
  }
  return `${playlist.name} (${playlist.provider}:${playlist.item_id})`;
});

const recommendedGuidedSectionIds = computed<string[]>(() => {
  const textSections = sections.value.filter(
    (section) => section.type === "ai_text",
  );
  if (textSections.length <= 6) {
    return textSections.map((section) => section.id);
  }
  const ranked = [...textSections].sort((a, b) => {
    const aName = `${a.id} ${a.name}`.toLowerCase();
    const bName = `${b.id} ${b.name}`.toLowerCase();
    const score = (value: string) => {
      if (value.includes("intro") || value.includes("start")) return 0;
      if (value.includes("transition") || value.includes("between")) return 1;
      if (value.includes("news") || value.includes("weather")) return 2;
      if (
        value.includes("outro") ||
        value.includes("end") ||
        value.includes("close")
      ) {
        return 3;
      }
      return 4;
    };
    const scoreDiff = score(aName) - score(bName);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.name.localeCompare(b.name);
  });
  return ranked.slice(0, 6).map((section) => section.id);
});

const canProceedGuidedWizardStep = computed(() => {
  if (guidedWizardStep.value === 1) {
    return (
      Boolean(guidedWizardStationName.value.trim()) &&
      Boolean(guidedWizardSourcePlaylistSelectValue.value)
    );
  }
  if (guidedWizardStep.value === 2) {
    return (
      guidedWizardSectionIds.value.length > 0 &&
      guidedWizardSectionIds.value.every((sectionId) =>
        Boolean(guidedWizardSectionPlacements.value[sectionId]),
      )
    );
  }
  return true;
});

const stationMaxDurationInput = computed({
  get: () => String(stationDraft.value?.max_duration_minutes ?? 0),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.max_duration_minutes = safeNumber(value, 0, 0);
  },
});

const stationDynamicBatchSizeInput = computed({
  get: () => String(stationDraft.value?.dynamic_batch_size ?? 1),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_batch_size = safeNumber(value, 1, 1);
  },
});

const stationDynamicPrefetchInput = computed({
  get: () => String(stationDraft.value?.dynamic_prefetch_remaining_tracks ?? 2),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_prefetch_remaining_tracks = safeNumber(
      value,
      1,
      1,
    );
  },
});

const stationDynamicPollInput = computed({
  get: () => String(stationDraft.value?.dynamic_poll_seconds ?? 5),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_poll_seconds = safeNumber(value, 1, 1);
  },
});

const stationTemperatureInput = computed({
  get: () => String(stationDraft.value?.general?.temperature ?? 0.7),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.general.temperature = safeNumber(value, 0, 0.7);
  },
});

const stationMaxTokensInput = computed({
  get: () => String(stationDraft.value?.general?.max_tokens ?? 1200),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.general.max_tokens = safeInteger(value, 1, 1200);
  },
});

const stationWeatherTimeoutInput = computed({
  get: () => String(stationDraft.value?.general?.weather_timeout_seconds ?? 8),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.general.weather_timeout_seconds = safeInteger(
      value,
      1,
      8,
    );
  },
});

const safeNumber = (
  value: string | number,
  min: number,
  fallback: number,
): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

const safeInteger = (
  value: string | number,
  min: number,
  fallback: number,
): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

const parseOptionalNumber = (
  value: string | number | null | undefined,
): number => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return safeNumber(value, 0, 0);
};

const stationName = (stationId: string) => {
  return stationById.value.get(stationId) || stationId;
};

const sessionBadgeVariant = (
  status: AIRadioSession["status"],
): BadgeVariant => {
  if (status === "running") return "default";
  if (status === "completed") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

const toProgressRecord = (session: AIRadioSession): Record<string, unknown> => {
  if (!session.progress || typeof session.progress !== "object") {
    return {};
  }
  return session.progress as Record<string, unknown>;
};

const asProgressNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const progressPhaseLabel = (phase: string): string => {
  const labels: Record<AIRadioProgressPhase, string> = {
    fetch_source_tracks: "Loading source playlist",
    initializing_queue: "Preparing player queue",
    planning_sections: "Planning station sections",
    generating_llm: "Generating AI text",
    generating_tts: "Generating voice audio",
    publishing_playlist: "Publishing generated playlist",
    queueing_batch: "Queueing next dynamic batch",
    waiting_for_playback: "Waiting for playback progress",
    running: "Running",
  };
  return labels[phase as AIRadioProgressPhase] || phase;
};

const sessionProgressSummary = (session: AIRadioSession): string => {
  const progress = toProgressRecord(session);
  const phase = String(progress.phase || progress.step || "").trim();
  if (!phase) {
    return "";
  }
  return progressPhaseLabel(phase);
};

const sessionProgressDetails = (session: AIRadioSession): string => {
  const progress = toProgressRecord(session);
  const phase = String(progress.phase || progress.step || "").trim();
  const queuedTracks = asProgressNumber(progress.queued_tracks);
  const totalTracks = asProgressNumber(progress.total_tracks);
  const batchIndex = asProgressNumber(progress.batch_index);
  const sectionsPlanned = asProgressNumber(progress.sections_planned);
  const sections = asProgressNumber(progress.sections);
  const queueEntries = asProgressNumber(progress.queue_entries);
  const entries = asProgressNumber(progress.entries);
  const tracks = asProgressNumber(progress.tracks);

  if (!phase) {
    return "";
  }
  if (phase === "generating_llm") {
    if (sectionsPlanned !== null && batchIndex !== null) {
      return `Batch ${batchIndex}: ${sectionsPlanned} section(s) to generate`;
    }
    if (sectionsPlanned !== null) {
      return `${sectionsPlanned} section(s) to generate`;
    }
  }
  if (phase === "generating_tts") {
    if (sections !== null && batchIndex !== null) {
      return `Batch ${batchIndex}: ${sections} section(s) to synthesize`;
    }
    if (sections !== null) {
      return `${sections} section(s) to synthesize`;
    }
  }
  if (phase === "queueing_batch") {
    if (batchIndex !== null && queueEntries !== null) {
      return `Batch ${batchIndex}: ${queueEntries} queue entries total`;
    }
  }
  if (phase === "waiting_for_playback") {
    if (queuedTracks !== null && totalTracks !== null && batchIndex !== null) {
      return `Batch ${batchIndex} queued, waiting (${queuedTracks}/${totalTracks} tracks prepared)`;
    }
  }
  if (phase === "publishing_playlist") {
    if (entries !== null || tracks !== null) {
      const entryText = entries !== null ? `${entries} entries` : "";
      const trackText = tracks !== null ? `${tracks} source tracks` : "";
      return [entryText, trackText].filter(Boolean).join(" · ");
    }
  }
  if (queuedTracks !== null && totalTracks !== null) {
    return `${queuedTracks}/${totalTracks} source tracks processed`;
  }
  return "";
};

const formatTimestamp = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const playlistSelectValue = (provider: string, itemId: string) => {
  return `${provider}:::${itemId}`;
};

const splitPlaylistSelectValue = (value: string) => {
  const [provider, itemId] = value.split(":::");
  return {
    provider: provider || "library",
    itemId: itemId || "",
  };
};

const getQueryValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parseOptionalInput = (value: string): number | undefined => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

const asGeneralDefaults = (
  general?: AIRadioStationGeneral,
): AIRadioStationGeneral => {
  return {
    timezone: general?.timezone || "UTC",
    location: {
      city: general?.location?.city || "",
      country: general?.location?.country || "",
    },
    model: general?.model || "gpt-4o-mini",
    temperature:
      typeof general?.temperature === "number" ? general.temperature : 0.7,
    max_tokens:
      typeof general?.max_tokens === "number" ? general.max_tokens : 1200,
    instructions: general?.instructions || "",
    openai_base_url: general?.openai_base_url || "https://api.openai.com/v1",
    section_store_path: general?.section_store_path || "ai_radio_sections",
    weather_provider: general?.weather_provider || "open_meteo",
    weather_timeout_seconds:
      typeof general?.weather_timeout_seconds === "number"
        ? general.weather_timeout_seconds
        : 8,
    tts_provider: general?.tts_provider || "openai",
    openai_tts_model: general?.openai_tts_model || "gpt-4o-mini-tts",
    openai_tts_voice: general?.openai_tts_voice || "ballad",
    openai_tts_instructions: general?.openai_tts_instructions || "",
    elevenlabs_model: general?.elevenlabs_model || "eleven_flash_v2_5",
    elevenlabs_voice_id: general?.elevenlabs_voice_id || "",
  };
};

const normalizeStationDraft = (
  station: AIRadioStation,
): AIRadioStationDraft => {
  const draft = deepClone(station);
  draft.id = String(draft.id || "").trim();
  draft.name = String(draft.name || "").trim();
  draft.source_playlist_id = String(draft.source_playlist_id || "").trim();
  draft.source_playlist_provider =
    String(draft.source_playlist_provider || "library").trim() || "library";
  draft.target_playlist_provider =
    String(draft.target_playlist_provider || "builtin").trim() || "builtin";
  draft.default_player_id = String(draft.default_player_id || "").trim();
  draft.max_duration_minutes = parseOptionalNumber(draft.max_duration_minutes);
  draft.dynamic_batch_size = safeInteger(
    String(draft.dynamic_batch_size ?? 1),
    1,
    1,
  );
  draft.dynamic_poll_seconds = safeInteger(
    String(draft.dynamic_poll_seconds ?? 5),
    1,
    5,
  );
  draft.dynamic_prefetch_remaining_tracks = safeInteger(
    String(draft.dynamic_prefetch_remaining_tracks ?? 2),
    1,
    2,
  );
  draft.clear_queue_on_start = draft.clear_queue_on_start !== false;
  draft.merge_section_id = String(draft.merge_section_id || "").trim();
  draft.section_ids = Array.isArray(draft.section_ids)
    ? [...draft.section_ids]
    : [];
  draft.section_order = Array.isArray(draft.section_order)
    ? deepClone(draft.section_order)
    : [];
  draft.sections = [];
  draft.general = asGeneralDefaults(draft.general);
  return draft as AIRadioStationDraft;
};

const normalizeSectionDraft = (section: AIRadioSection): AIRadioSection => {
  const draft = deepClone(section);
  draft.id = String(draft.id || "").trim();
  draft.name = String(draft.name || "").trim();
  draft.type = draft.type === "ai_meta" ? "ai_meta" : "ai_text";
  draft.prompt = String(draft.prompt || "");
  draft.web_search = draft.web_search || "disabled";
  draft.constraints = {
    max_chars: safeInteger(String(draft.constraints?.max_chars ?? 0), 0, 0),
  };
  return draft;
};

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "item";
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const closeTutorial = () => {
  tutorialOpen.value = false;
  localStorage.setItem(TUTORIAL_SEEN_STORAGE_KEY, "1");
};

const defaultGuidedPlacement = (section: AIRadioSection): AIRadioPlacement => {
  const label = `${section.id} ${section.name}`.toLowerCase();
  if (
    label.includes("intro") ||
    label.includes("start") ||
    label.includes("opening")
  ) {
    return "start_of_playlist";
  }
  if (
    label.includes("outro") ||
    label.includes("end") ||
    label.includes("closing") ||
    label.includes("signoff") ||
    label.includes("sign-off")
  ) {
    return "end_of_playlist";
  }
  return "between_songs";
};

const applyRouteOverrides = () => {
  const querySourcePlaylistId = getQueryValue(route.query.source_playlist_id);
  const querySourcePlaylistProvider = getQueryValue(
    route.query.source_playlist_provider,
  );
  const querySourcePlaylistName = getQueryValue(
    route.query.source_playlist_name,
  );

  if (querySourcePlaylistId && querySourcePlaylistProvider) {
    sourcePlaylistOverrideId.value = querySourcePlaylistId;
    sourcePlaylistOverrideProvider.value = querySourcePlaylistProvider;
    sourcePlaylistOverrideName.value = querySourcePlaylistName;
    activeTab.value = "run";
  } else {
    sourcePlaylistOverrideId.value = "";
    sourcePlaylistOverrideProvider.value = "";
    sourcePlaylistOverrideName.value = "";
  }

  const queryStationId = getQueryValue(route.query.station_id);
  if (
    queryStationId &&
    stations.value.some((station) => station.id === queryStationId)
  ) {
    selectedRunStationId.value = queryStationId;
    applyRunStationDefaults(queryStationId);
  } else if (!selectedRunStationId.value && stations.value.length > 0) {
    selectedRunStationId.value = stations.value[0].id;
    applyRunStationDefaults(stations.value[0].id);
  }
};

const clearSourcePlaylistOverride = async () => {
  sourcePlaylistOverrideId.value = "";
  sourcePlaylistOverrideProvider.value = "";
  sourcePlaylistOverrideName.value = "";

  const query = { ...route.query };
  delete query.source_playlist_id;
  delete query.source_playlist_provider;
  delete query.source_playlist_name;
  await router.replace({ query });
};

const applyRunStationDefaults = (stationId: string) => {
  const station = stations.value.find((item) => item.id === stationId);
  selectedRunPlayerId.value = station?.default_player_id || "";
};

const onSelectRunStation = (stationId: string) => {
  selectedRunStationId.value = stationId;
  applyRunStationDefaults(stationId);
};

const onSelectRunPlayer = (value: string) => {
  selectedRunPlayerId.value =
    value === DEFAULT_PLAYER_SELECT_VALUE ? "" : value;
};

const runStart = async (mode: AIRadioMode) => {
  if (!selectedRunStationId.value) {
    toast.error("Select a station first");
    return;
  }
  try {
    await startRun(selectedRunStationId.value, mode, {
      playerIdOverride: selectedRunPlayerId.value || undefined,
      sourcePlaylistIdOverride: sourcePlaylistOverrideId.value || undefined,
      sourcePlaylistProviderOverride:
        sourcePlaylistOverrideProvider.value || undefined,
      dynamicSourcePlaytimeCapOverride: parseOptionalInput(
        runSourcePlaytimeCapOverrideInput.value,
      ),
      dynamicBatchSizeOverride: parseOptionalInput(
        runDynamicBatchSizeOverrideInput.value,
      ),
    });
    await loadStatus(true);
  } catch (error) {
    toast.error(`Failed to start run: ${errorMessage(error)}`);
  }
};

const startPlaylistRun = async () => {
  await runStart("playlist");
};

const startDynamicRun = async () => {
  await runStart("dynamic");
};

const stopSession = async (sessionId: string) => {
  try {
    await stopRun(sessionId);
  } catch (error) {
    toast.error(`Failed to stop session: ${errorMessage(error)}`);
  }
};

const handleRefresh = async () => {
  try {
    await Promise.all([refreshEditor(true), loadStatus(true)]);
    applyRouteOverrides();
    toast.success("AI Radio data refreshed");
  } catch (error) {
    toast.error(`Refresh failed: ${errorMessage(error)}`);
  }
};

const openGuidedStationCreator = () => {
  guidedWizardOpen.value = true;
  guidedWizardStep.value = 1;
  guidedWizardStationName.value = "";
  if (sourcePlaylistOverrideName.value) {
    guidedWizardStationName.value = `AI Radio - ${sourcePlaylistOverrideName.value}`;
  }

  if (sourcePlaylistOverrideId.value && sourcePlaylistOverrideProvider.value) {
    guidedWizardSourcePlaylistSelectValue.value = playlistSelectValue(
      sourcePlaylistOverrideProvider.value,
      sourcePlaylistOverrideId.value,
    );
  } else {
    guidedWizardSourcePlaylistSelectValue.value = playlists.value[0]
      ? playlistSelectValue(
          playlists.value[0].provider,
          playlists.value[0].item_id,
        )
      : "";
  }

  guidedWizardDefaultPlayerId.value = "";
  const runStation = stations.value.find(
    (item) => item.id === selectedRunStationId.value,
  );
  if (runStation?.default_player_id) {
    guidedWizardDefaultPlayerId.value = runStation.default_player_id;
  } else if (availableRunPlayers.value[0]) {
    guidedWizardDefaultPlayerId.value = availableRunPlayers.value[0].player_id;
  }

  guidedWizardSectionIds.value = [...recommendedGuidedSectionIds.value];
  guidedWizardSectionPlacements.value = {};
  for (const sectionId of guidedWizardSectionIds.value) {
    const section = guidedWizardSectionById.value.get(sectionId);
    if (!section) {
      continue;
    }
    guidedWizardSectionPlacements.value[sectionId] =
      defaultGuidedPlacement(section);
  }
  guidedWizardMergeSectionId.value = "";
  if (guidedWizardMergeSectionOptions.value[0]) {
    guidedWizardMergeSectionId.value =
      guidedWizardMergeSectionOptions.value[0].id;
  }
  guidedNewSectionName.value = "";
  guidedNewSectionPrompt.value = "";
  guidedNewSectionPlacement.value = "between_songs";
};

const onGuidedSectionToggle = (sectionId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    if (!guidedWizardSectionIds.value.includes(sectionId)) {
      guidedWizardSectionIds.value = [
        ...guidedWizardSectionIds.value,
        sectionId,
      ];
    }
    if (!guidedWizardSectionPlacements.value[sectionId]) {
      const section = guidedWizardSectionById.value.get(sectionId);
      if (section) {
        guidedWizardSectionPlacements.value[sectionId] =
          defaultGuidedPlacement(section);
      }
    }
    return;
  }
  guidedWizardSectionIds.value = guidedWizardSectionIds.value.filter(
    (item) => item !== sectionId,
  );
  delete guidedWizardSectionPlacements.value[sectionId];
  if (
    guidedWizardMergeSectionId.value &&
    !guidedWizardSectionIds.value.includes(guidedWizardMergeSectionId.value)
  ) {
    guidedWizardMergeSectionId.value = "";
  }
};

const onGuidedSectionPlacementChange = (sectionId: string, event: Event) => {
  const placement = (event.target as HTMLSelectElement)
    .value as AIRadioPlacement;
  guidedWizardSectionPlacements.value = {
    ...guidedWizardSectionPlacements.value,
    [sectionId]: placement,
  };
};

const createGuidedSection = async () => {
  if (!guidedNewSectionName.value.trim()) {
    toast.error("Section name is required");
    return;
  }
  if (!guidedNewSectionPrompt.value.trim()) {
    toast.error("Section prompt is required");
    return;
  }

  creatingGuidedSection.value = true;
  try {
    const sectionDraft = normalizeSectionDraft(
      createSectionDraftFromTemplate(),
    );
    sectionDraft.name = guidedNewSectionName.value.trim();
    sectionDraft.id = slugify(sectionDraft.name);
    sectionDraft.type = "ai_text";
    sectionDraft.prompt = guidedNewSectionPrompt.value.trim();
    sectionDraft.web_search = "disabled";
    sectionDraft.constraints = { max_chars: 650 };

    const saved = await saveSection(sectionDraft);
    if (!guidedWizardSectionIds.value.includes(saved.id)) {
      guidedWizardSectionIds.value = [
        ...guidedWizardSectionIds.value,
        saved.id,
      ];
    }
    guidedWizardSectionPlacements.value = {
      ...guidedWizardSectionPlacements.value,
      [saved.id]: guidedNewSectionPlacement.value,
    };

    guidedNewSectionName.value = "";
    guidedNewSectionPrompt.value = "";
    guidedNewSectionPlacement.value = "between_songs";
    toast.success("Section added to station setup");
  } catch (error) {
    toast.error(`Failed to create section: ${errorMessage(error)}`);
  } finally {
    creatingGuidedSection.value = false;
  }
};

const buildGuidedSectionOrder = (
  sectionIds: string[],
): AIRadioSectionOrderRule[] => {
  const selectedSections = sectionIds
    .map((sectionId) =>
      sections.value.find((section) => section.id === sectionId),
    )
    .filter((section): section is AIRadioSection => Boolean(section));
  const textSections = selectedSections.filter(
    (section) => section.type === "ai_text",
  );
  if (!textSections.length) {
    return [];
  }

  const rules: AIRadioSectionOrderRule[] = [];
  const placements: AIRadioPlacement[] = [
    "start_of_playlist",
    "between_songs",
    "end_of_playlist",
  ];

  for (const placement of placements) {
    const placementSections = textSections.filter((section) => {
      const selectedPlacement =
        guidedWizardSectionPlacements.value[section.id] || "between_songs";
      return selectedPlacement === placement;
    });

    if (!placementSections.length) {
      continue;
    }

    rules.push({
      when: placement,
      flow: placementSections.map((section) => ({ MUST: section.id })),
    });
  }

  if (!rules.length) {
    rules.push({
      when: "between_songs",
      flow: [{ MUST: textSections[0].id }],
    });
  }
  return rules;
};

const createGuidedStation = async () => {
  if (!canProceedGuidedWizardStep.value && guidedWizardStep.value < 3) {
    toast.error("Please complete the current step first");
    return;
  }
  if (!guidedWizardStationName.value.trim()) {
    toast.error("Station name is required");
    guidedWizardStep.value = 1;
    return;
  }
  if (!guidedWizardSourcePlaylistSelectValue.value) {
    toast.error("Source playlist is required");
    guidedWizardStep.value = 1;
    return;
  }
  if (!guidedWizardSectionIds.value.length) {
    toast.error("Select at least one section");
    guidedWizardStep.value = 2;
    return;
  }

  creatingGuidedStation.value = true;
  try {
    const draft = normalizeStationDraft(createStationDraftFromTemplate());
    const { provider, itemId } = splitPlaylistSelectValue(
      guidedWizardSourcePlaylistSelectValue.value,
    );
    draft.name = guidedWizardStationName.value.trim();
    draft.id = slugify(draft.name);
    draft.source_playlist_provider = provider;
    draft.source_playlist_id = itemId;
    draft.default_player_id = guidedWizardDefaultPlayerId.value;

    const sectionIds = [...guidedWizardSectionIds.value];
    if (
      guidedWizardMergeSectionId.value &&
      !sectionIds.includes(guidedWizardMergeSectionId.value)
    ) {
      sectionIds.push(guidedWizardMergeSectionId.value);
    }
    draft.section_ids = sectionIds;
    draft.merge_section_id = guidedWizardMergeSectionId.value;
    draft.section_order = buildGuidedSectionOrder(sectionIds);

    const payload = buildStationPayload(draft);
    const localError = validateStationDraftLocal(payload);
    if (localError) {
      toast.error(localError);
      return;
    }

    const saved = await saveStation(payload);
    selectedEditorStationId.value = saved.id;
    stationDraft.value = normalizeStationDraft(saved);
    selectedRunStationId.value = saved.id;
    applyRunStationDefaults(saved.id);
    activeTab.value = "run";
    guidedWizardOpen.value = false;
    toast.success("Station created. You can now start AI Radio.");
  } catch (error) {
    toast.error(`Failed to create guided station: ${errorMessage(error)}`);
  } finally {
    creatingGuidedStation.value = false;
  }
};

const createNewStationDraft = () => {
  const draft = normalizeStationDraft(createStationDraftFromTemplate());
  draft.id = "";
  draft.name = "";
  draft.source_playlist_id = "";
  draft.source_playlist_provider = "library";
  selectedEditorStationId.value = "";
  stationDraft.value = draft;
  activeTab.value = "stations";
};

const selectStationForEdit = async (stationId: string) => {
  try {
    const station = await getStation(stationId);
    selectedEditorStationId.value = station.id;
    stationDraft.value = normalizeStationDraft(station);
  } catch (error) {
    toast.error(`Failed to load station: ${errorMessage(error)}`);
  }
};

const validateStationDraftLocal = (station: AIRadioStation): string | null => {
  if (!station.name.trim()) {
    return "Station name is required";
  }
  if (!station.source_playlist_id.trim()) {
    return "Station source playlist is required";
  }
  if (!station.section_ids?.length) {
    return "Select at least one section";
  }
  if (!station.section_order?.length) {
    return "Section order requires at least one rule";
  }

  for (const [ruleIndex, rule] of station.section_order.entries()) {
    if (!Array.isArray(rule.flow) || !rule.flow.length) {
      return `Rule ${ruleIndex + 1} requires at least one flow item`;
    }
    for (const [flowIndex, item] of rule.flow.entries()) {
      const type = getFlowType(item);
      if (type === "MUST" && !getMustSection(item)) {
        return `Rule ${ruleIndex + 1}, flow ${flowIndex + 1}: MUST needs a section`;
      }
      if (type === "ALTERNATIVE") {
        const choices = getAlternativeChoices(item).filter(
          (choice) =>
            choice.section.trim() && parseOptionalNumber(choice.weight) > 0,
        );
        if (!choices.length) {
          return `Rule ${ruleIndex + 1}, flow ${flowIndex + 1}: ALTERNATIVE needs at least one valid choice`;
        }
      }
      if (type === "OPTIONAL" && !getOptionalSection(item)) {
        return `Rule ${ruleIndex + 1}, flow ${flowIndex + 1}: OPTIONAL needs a section`;
      }
    }
  }

  return null;
};

const buildStationPayload = (draft: AIRadioStationDraft): AIRadioStation => {
  const station = normalizeStationDraft(deepClone(draft));
  if (!station.id.trim()) {
    station.id = slugify(station.name);
  }
  // Keep station payload section-id based; shared section library is edited separately.
  delete (station as { sections?: AIRadioSection[] }).sections;
  return station;
};

const saveStationDraft = async () => {
  if (!stationDraft.value) {
    return;
  }
  const payload = buildStationPayload(stationDraft.value);
  const localError = validateStationDraftLocal(payload);
  if (localError) {
    toast.error(localError);
    return;
  }
  try {
    const saved = await saveStation(payload);
    selectedEditorStationId.value = saved.id;
    stationDraft.value = normalizeStationDraft(saved);
    if (!selectedRunStationId.value) {
      selectedRunStationId.value = saved.id;
      applyRunStationDefaults(saved.id);
    }
  } catch (error) {
    toast.error(`Failed to save station: ${errorMessage(error)}`);
  }
};

const validateStationDraftOnServer = async () => {
  if (!stationDraft.value) {
    return;
  }
  const payload = buildStationPayload(stationDraft.value);
  const localError = validateStationDraftLocal(payload);
  if (localError) {
    toast.error(localError);
    return;
  }
  try {
    const normalized = await validateStation(payload);
    stationDraft.value = normalizeStationDraft(normalized);
    toast.success("Station validation passed");
  } catch (error) {
    toast.error(`Station validation failed: ${errorMessage(error)}`);
  }
};

const removeSelectedStation = async () => {
  if (!selectedEditorStationId.value) {
    return;
  }
  if (!window.confirm("Delete this station?")) {
    return;
  }
  try {
    await deleteStation(selectedEditorStationId.value);
    const nextStation = stations.value[0];
    if (nextStation) {
      await selectStationForEdit(nextStation.id);
    } else {
      selectedEditorStationId.value = "";
      stationDraft.value = null;
    }
  } catch (error) {
    toast.error(`Failed to delete station: ${errorMessage(error)}`);
  }
};

const triggerStationImport = () => {
  stationImportInput.value?.click();
};

const onStationImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const data = JSON.parse(await file.text()) as Record<string, unknown>;
    let imported: AIRadioStation | null = null;
    if (Array.isArray(data.stations) && data.stations.length > 0) {
      imported = data.stations[0] as unknown as AIRadioStation;
    } else {
      imported = data as unknown as AIRadioStation;
    }
    stationDraft.value = normalizeStationDraft(imported);
    selectedEditorStationId.value = stationDraft.value.id || "";
    activeTab.value = "stations";
    toast.success("Station imported into editor");
  } catch (error) {
    toast.error(`Failed to import station: ${errorMessage(error)}`);
  } finally {
    target.value = "";
  }
};

const exportJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const exportStationDraft = () => {
  if (!stationDraft.value) {
    toast.error("No station loaded");
    return;
  }
  const payload = buildStationPayload(stationDraft.value);
  const fileName = `${payload.id || slugify(payload.name)}.json`;
  exportJson(fileName, payload);
  toast.success("Station exported");
};

const createNewSectionDraft = () => {
  const draft = normalizeSectionDraft(createSectionDraftFromTemplate());
  draft.id = "";
  draft.name = "";
  draft.prompt = "";
  selectedEditorSectionId.value = "";
  sectionDraft.value = draft;
  activeTab.value = "sections";
};

const selectSectionForEdit = async (sectionId: string) => {
  try {
    const section = await getSection(sectionId);
    selectedEditorSectionId.value = section.id;
    sectionDraft.value = normalizeSectionDraft(section);
  } catch (error) {
    toast.error(`Failed to load section: ${errorMessage(error)}`);
  }
};

const saveSectionDraft = async () => {
  if (!sectionDraft.value) {
    return;
  }
  const payload = normalizeSectionDraft(deepClone(sectionDraft.value));
  if (!payload.name.trim()) {
    toast.error("Section name is required");
    return;
  }
  if (!payload.id.trim()) {
    payload.id = slugify(payload.name);
  }
  if (!payload.prompt.trim()) {
    toast.error("Section prompt is required");
    return;
  }
  if (payload.type !== "ai_text") {
    delete (payload as { web_search?: string }).web_search;
    delete (payload as { constraints?: { max_chars?: number } }).constraints;
  }
  try {
    const saved = await saveSection(payload);
    selectedEditorSectionId.value = saved.id;
    sectionDraft.value = normalizeSectionDraft(saved);
  } catch (error) {
    toast.error(`Failed to save section: ${errorMessage(error)}`);
  }
};

const removeSelectedSection = async () => {
  if (!selectedEditorSectionId.value) {
    return;
  }
  if (!window.confirm("Delete this section?")) {
    return;
  }
  try {
    await deleteSection(selectedEditorSectionId.value);
    const nextSection = sections.value[0];
    if (nextSection) {
      await selectSectionForEdit(nextSection.id);
    } else {
      selectedEditorSectionId.value = "";
      sectionDraft.value = null;
    }
  } catch (error) {
    toast.error(`Failed to delete section: ${errorMessage(error)}`);
  }
};

const triggerSectionImport = () => {
  sectionImportInput.value?.click();
};

const onSectionImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const data = JSON.parse(await file.text()) as Record<string, unknown>;
    let imported: AIRadioSection | null = null;
    if (Array.isArray(data.sections) && data.sections.length > 0) {
      imported = data.sections[0] as unknown as AIRadioSection;
    } else {
      imported = data as unknown as AIRadioSection;
    }
    sectionDraft.value = normalizeSectionDraft(imported);
    selectedEditorSectionId.value = sectionDraft.value.id || "";
    activeTab.value = "sections";
    toast.success("Section imported into editor");
  } catch (error) {
    toast.error(`Failed to import section: ${errorMessage(error)}`);
  } finally {
    target.value = "";
  }
};

const exportSectionDraft = () => {
  if (!sectionDraft.value) {
    toast.error("No section loaded");
    return;
  }
  const payload = normalizeSectionDraft(sectionDraft.value);
  const fileName = `${payload.id || slugify(payload.name)}.json`;
  exportJson(fileName, payload);
  toast.success("Section exported");
};

const onSectionMaxCharsChange = (value: string | number) => {
  if (!sectionDraft.value) {
    return;
  }
  if (!sectionDraft.value.constraints) {
    sectionDraft.value.constraints = { max_chars: 0 };
  }
  sectionDraft.value.constraints.max_chars = safeInteger(String(value), 0, 0);
};

const onStationSectionIdsChange = (event: Event) => {
  if (!stationDraft.value) {
    return;
  }
  const target = event.target as HTMLSelectElement;
  stationDraft.value.section_ids = Array.from(target.selectedOptions).map(
    (item) => item.value,
  );
  if (
    stationDraft.value.merge_section_id &&
    !stationDraft.value.section_ids.includes(
      stationDraft.value.merge_section_id,
    )
  ) {
    stationDraft.value.merge_section_id = "";
  }
};

const addOrderRule = () => {
  if (!stationDraft.value) {
    return;
  }
  if (!stationDraft.value.section_order) {
    stationDraft.value.section_order = [];
  }
  stationDraft.value.section_order.push({
    when: "between_songs",
    flow: [{ MUST: "" }],
  });
};

const moveOrderRule = (index: number, direction: -1 | 1) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const target = index + direction;
  if (target < 0 || target >= stationDraft.value.section_order.length) {
    return;
  }
  const current = stationDraft.value.section_order[index];
  stationDraft.value.section_order[index] =
    stationDraft.value.section_order[target];
  stationDraft.value.section_order[target] = current;
};

const removeOrderRule = (index: number) => {
  stationDraft.value?.section_order?.splice(index, 1);
};

const onOrderPlacementChange = (ruleIndex: number, event: Event) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const value = (event.target as HTMLSelectElement)
    .value as AIRadioSectionOrderRule["when"];
  stationDraft.value.section_order[ruleIndex].when = value;
};

const getFlowType = (item: AIRadioFlowItem): AIRadioFlowType => {
  if ("MUST" in item) {
    return "MUST";
  }
  if ("ALTERNATIVE" in item) {
    return "ALTERNATIVE";
  }
  return "OPTIONAL";
};

const makeDefaultFlowItem = (type: AIRadioFlowType): AIRadioFlowItem => {
  if (type === "MUST") {
    return { MUST: "" };
  }
  if (type === "ALTERNATIVE") {
    return {
      ALTERNATIVE: {
        choices: [{ section: "", weight: 1 }],
      },
    };
  }
  return {
    OPTIONAL: {
      section: "",
      chance: 0.5,
      guards: {
        min_gap_songs: 0,
        max_per_60min: 0,
        require_placeholders_present: [],
      },
    },
  };
};

const addFlowItem = (ruleIndex: number) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  stationDraft.value.section_order[ruleIndex].flow.push(
    makeDefaultFlowItem("MUST"),
  );
};

const removeFlowItem = (ruleIndex: number, flowIndex: number) => {
  stationDraft.value?.section_order?.[ruleIndex]?.flow.splice(flowIndex, 1);
};

const onFlowTypeChange = (
  ruleIndex: number,
  flowIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const type = (event.target as HTMLSelectElement).value as AIRadioFlowType;
  stationDraft.value.section_order[ruleIndex].flow[flowIndex] =
    makeDefaultFlowItem(type);
};

const getMustSection = (item: AIRadioFlowItem): string => {
  if ("MUST" in item) {
    return item.MUST;
  }
  return "";
};

const onMustSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("MUST" in flow)) {
    return;
  }
  flow.MUST = (event.target as HTMLSelectElement).value;
};

const getAlternativeChoices = (
  item: AIRadioFlowItem,
): AIRadioAlternativeChoice[] => {
  if ("ALTERNATIVE" in item) {
    return item.ALTERNATIVE.choices;
  }
  return [];
};

const addAlternativeChoice = (ruleIndex: number, flowIndex: number) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices.push({ section: "", weight: 1 });
};

const removeAlternativeChoice = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices.splice(choiceIndex, 1);
};

const onAlternativeChoiceSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices[choiceIndex].section = (
    event.target as HTMLSelectElement
  ).value;
};

const onAlternativeChoiceWeightChange = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices[choiceIndex].weight = safeNumber(
    String(value),
    0,
    0,
  );
};

const getOptionalPayload = (
  item: AIRadioFlowItem,
): {
  section: string;
  chance?: number;
  guards?: AIRadioOptionalGuards;
} | null => {
  if ("OPTIONAL" in item) {
    if (!item.OPTIONAL.guards) {
      item.OPTIONAL.guards = {
        min_gap_songs: 0,
        max_per_60min: 0,
        require_placeholders_present: [],
      };
    }
    return item.OPTIONAL;
  }
  return null;
};

const getOptionalSection = (item: AIRadioFlowItem): string => {
  const optional = getOptionalPayload(item);
  return optional?.section || "";
};

const onOptionalSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional) {
    return;
  }
  optional.section = (event.target as HTMLSelectElement).value;
};

const getOptionalChancePercent = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return Math.round((optional?.chance ?? 0) * 100);
};

const onOptionalChanceChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional) {
    return;
  }
  const percent = safeNumber(String(value), 0, 0);
  optional.chance = Math.min(percent, 100) / 100;
};

const getOptionalMinGap = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return safeInteger(String(optional?.guards?.min_gap_songs ?? 0), 0, 0);
};

const onOptionalMinGapChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.min_gap_songs = safeInteger(String(value), 0, 0);
};

const getOptionalMaxPer60 = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return safeInteger(String(optional?.guards?.max_per_60min ?? 0), 0, 0);
};

const onOptionalMaxPerChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.max_per_60min = safeInteger(String(value), 0, 0);
};

const getOptionalPlaceholders = (item: AIRadioFlowItem): string => {
  const optional = getOptionalPayload(item);
  return (optional?.guards?.require_placeholders_present || []).join(", ");
};

const onOptionalPlaceholdersChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.require_placeholders_present = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

onMounted(async () => {
  try {
    await Promise.all([refreshEditor(true), loadStatus(true)]);

    if (!localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY)) {
      tutorialOpen.value = true;
    }

    if (stations.value.length > 0) {
      if (!selectedEditorStationId.value) {
        await selectStationForEdit(stations.value[0].id);
      }
      if (!selectedRunStationId.value) {
        selectedRunStationId.value = stations.value[0].id;
        applyRunStationDefaults(stations.value[0].id);
      }
    }

    if (sections.value.length > 0 && !selectedEditorSectionId.value) {
      await selectSectionForEdit(sections.value[0].id);
    }

    applyRouteOverrides();

    refreshTimer = setInterval(() => {
      void loadStatus(true).catch(() => undefined);
    }, AUTO_REFRESH_MS);
  } catch (error) {
    toast.error(`Failed to initialize AI Radio view: ${errorMessage(error)}`);
  }
});

watch(
  () => route.query,
  () => {
    applyRouteOverrides();
  },
);

watch(stations, async (nextStations) => {
  if (nextStations.length === 0) {
    selectedEditorStationId.value = "";
    stationDraft.value = null;
    selectedRunStationId.value = "";
    return;
  }

  if (
    selectedEditorStationId.value &&
    !nextStations.some(
      (station) => station.id === selectedEditorStationId.value,
    )
  ) {
    await selectStationForEdit(nextStations[0].id);
  }

  if (
    selectedRunStationId.value &&
    !nextStations.some((station) => station.id === selectedRunStationId.value)
  ) {
    selectedRunStationId.value = nextStations[0].id;
    applyRunStationDefaults(nextStations[0].id);
  }

  applyRouteOverrides();
});

watch(sections, async (nextSections) => {
  if (nextSections.length === 0) {
    selectedEditorSectionId.value = "";
    sectionDraft.value = null;
    return;
  }

  if (
    selectedEditorSectionId.value &&
    !nextSections.some(
      (section) => section.id === selectedEditorSectionId.value,
    )
  ) {
    await selectSectionForEdit(nextSections[0].id);
  }
});

onBeforeUnmount(() => {
  if (!refreshTimer) {
    return;
  }
  clearInterval(refreshTimer);
  refreshTimer = null;
});
</script>
