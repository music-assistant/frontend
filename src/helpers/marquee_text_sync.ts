type ComponentId = symbol;
type SyncResolver = () => void;

class RunningAnimationSync {
  private parentSync: MarqueeTextSync;
  private readonly id: ComponentId;
  // resolve method of the promise returned by `sync()`
  private promiseResolver: SyncResolver | null = null;

  constructor(parentSync: MarqueeTextSync) {
    this.parentSync = parentSync;
    this.id = Symbol();
  }

  // Call this when a animation is started with the time it will take to scroll
  // the whole text (without constant delays)
  // Must be called if you wan't to use `sync()`
  setScrollingDuration(duration: number): void {
    if (duration > 0) {
      this.parentSync._componentDurations.set(this.id, duration);
    } else {
      this.unregister();
    }
  }

  // Returns the maximum duration set by `setScrollingDuration` of all running animations
  maxDuration(): number {
    if (this.parentSync._componentDurations.size === 0) return 0;
    return Math.max(...this.parentSync._componentDurations.values());
  }

  // Returns a promise that resolves when all currently running animations
  // are awaiting this sync point
  // the returned promise must be immediatly awaited
  sync(): Promise<void> {
    return new Promise<void>((resolve) => {
      // If the user awaits sync(), we can assume that only a single promiseResolver
      // exists at a time, so we can safely overwrite it
      this.promiseResolver = resolve;
      this.parentSync._pendingSync.push(resolve);
      this.parentSync._tryResolveWaiting();
    });
  }

  // Make sure to call this when:
  // - the component is unmounted
  // - no animation is playing anymore, i.e. the animation was aborted
  // do not call `sync()` after calling this, first call `setScrollingDuration` again
  unregister(): void {
    if (this.promiseResolver) {
      const index = this.parentSync._pendingSync.indexOf(this.promiseResolver);
      if (index > -1) {
        this.parentSync._pendingSync.splice(index, 1);
      }
      this.promiseResolver(); // resolve to avoid potential memory leaks
      this.promiseResolver = null;
    }
    this.parentSync._componentDurations.delete(this.id);
    // free up waiting syncs if needed (now that we compleatly removed ourself)
    this.parentSync._tryResolveWaiting();
  }
}

// Pass this to the `sync` prop of the MarqueeText component to sync all animations
export class MarqueeTextSync {
  _componentDurations: Map<ComponentId, number>; // durations of all running animations
  _pendingSync: SyncResolver[]; // resolvers of all pending sync promises

  constructor() {
    this._componentDurations = new Map();
    this._pendingSync = [];
  }

  _registerAnimation(): RunningAnimationSync {
    return new RunningAnimationSync(this);
  }

  // Will resolve all pending syncs in case all animations are waiting for it
  _tryResolveWaiting(): void {
    if (this._pendingSync?.length === this._componentDurations.size) {
      // Everyone is waiting for this sync point, resolve all
      const pending = this._pendingSync; // to avoid race conditions
      this._pendingSync = [];
      for (const resolve of pending) {
        resolve();
      }
    }
  }
}
