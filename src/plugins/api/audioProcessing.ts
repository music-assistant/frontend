import type { AudioProcessingChain } from "./interfaces";

export const AUDIO_PROCESSING_SCHEMA_VERSION = 38;

export type AudioProcessingSnapshotStore = Record<string, AudioProcessingChain>;

interface AudioProcessingSnapshotStoreState {
  clearedGeneration: number;
  generation: number;
  generations: Map<string, number>;
  revisions: Map<string, number>;
}

const storeStates = new WeakMap<
  AudioProcessingSnapshotStore,
  AudioProcessingSnapshotStoreState
>();

export function replaceAudioProcessingSnapshot(
  snapshots: AudioProcessingSnapshotStore,
  queueId: string,
  snapshot: AudioProcessingChain | null | undefined,
): boolean {
  if (!queueId || snapshot === undefined) return false;

  const state = getStoreState(snapshots);
  if (snapshot === null) {
    const currentRevision = snapshots[queueId]?.revision;
    const latestRevision = state.revisions.get(queueId);
    if (
      Number.isInteger(currentRevision) &&
      (latestRevision === undefined || currentRevision > latestRevision)
    ) {
      state.revisions.set(queueId, currentRevision);
    }
    delete snapshots[queueId];
    incrementGeneration(state, queueId);
    return true;
  }

  if (
    snapshot.queue_id !== queueId ||
    !Number.isInteger(snapshot.revision) ||
    snapshot.revision < 0
  ) {
    return false;
  }

  const currentRevision =
    state.revisions.get(queueId) ?? snapshots[queueId]?.revision;
  if (currentRevision !== undefined && snapshot.revision <= currentRevision) {
    return false;
  }

  snapshots[queueId] = snapshot;
  state.revisions.set(queueId, snapshot.revision);
  incrementGeneration(state, queueId);
  return true;
}

export function clearAudioProcessingSnapshots(
  snapshots: AudioProcessingSnapshotStore,
): void {
  for (const queueId of Object.keys(snapshots)) {
    delete snapshots[queueId];
  }
  const state = getStoreState(snapshots);
  state.generation += 1;
  state.clearedGeneration = state.generation;
  state.generations.clear();
  state.revisions.clear();
}

export function getAudioProcessingSnapshotGeneration(
  snapshots: AudioProcessingSnapshotStore,
  queueId: string,
): number {
  const state = getStoreState(snapshots);
  return state.generations.get(queueId) ?? state.clearedGeneration;
}

export function getMatchingAudioProcessingSnapshot(
  snapshots: AudioProcessingSnapshotStore,
  queueId?: string,
  queueItemId?: string,
): AudioProcessingChain | undefined {
  if (!queueId || !queueItemId) return undefined;

  const snapshot = snapshots[queueId];
  if (
    snapshot?.queue_id !== queueId ||
    snapshot.queue_item_id !== queueItemId
  ) {
    return undefined;
  }
  return snapshot;
}

export function supportsAudioProcessing(
  schemaVersion: number | undefined,
): boolean {
  return (schemaVersion ?? 0) >= AUDIO_PROCESSING_SCHEMA_VERSION;
}

function getStoreState(
  snapshots: AudioProcessingSnapshotStore,
): AudioProcessingSnapshotStoreState {
  let state = storeStates.get(snapshots);
  if (!state) {
    state = {
      clearedGeneration: 0,
      generation: 0,
      generations: new Map(),
      revisions: new Map(),
    };
    storeStates.set(snapshots, state);
  }
  return state;
}

function incrementGeneration(
  state: AudioProcessingSnapshotStoreState,
  queueId: string,
): void {
  state.generation += 1;
  state.generations.set(queueId, state.generation);
}
