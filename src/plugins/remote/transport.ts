/**
 * Transport Abstraction Layer
 *
 * Provides a common interface for different transport mechanisms (WebSocket, WebRTC DataChannel)
 * This allows the MusicAssistantApi to work with either transport seamlessly.
 */

export enum TransportState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

export interface TransportEventMap {
  open: () => void;
  close: (reason?: string) => void;
  error: (error: Error) => void;
  message: (data: string) => void;
  stateChange: (state: TransportState) => void;
}

export type TransportEventHandler<K extends keyof TransportEventMap> =
  TransportEventMap[K];

/**
 * Abstract transport interface that both WebSocket and WebRTC transports implement
 */
export interface ITransport {
  readonly state: TransportState;
  readonly isConnected: boolean;

  connect(): Promise<void>;
  disconnect(): void;
  send(data: string): void;

  on<K extends keyof TransportEventMap>(
    event: K,
    handler: TransportEventHandler<K>,
  ): void;
  off<K extends keyof TransportEventMap>(
    event: K,
    handler: TransportEventHandler<K>,
  ): void;
}

/**
 * Base transport class with common event handling logic
 */
export abstract class BaseTransport implements ITransport {
  protected _state: TransportState = TransportState.DISCONNECTED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected eventHandlers: Map<
    keyof TransportEventMap,
    Set<(...args: any[]) => void>
  > = new Map();

  get state(): TransportState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === TransportState.CONNECTED;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract send(data: string): void;

  on<K extends keyof TransportEventMap>(
    event: K,
    handler: TransportEventHandler<K>,
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off<K extends keyof TransportEventMap>(
    event: K,
    handler: TransportEventHandler<K>,
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  protected emit<K extends keyof TransportEventMap>(
    event: K,
    ...args: Parameters<TransportEventMap[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(
            `Error in transport event handler for '${event}':`,
            error,
          );
        }
      });
    }
  }

  protected setState(newState: TransportState): void {
    if (this._state !== newState) {
      this._state = newState;
      this.emit("stateChange", newState);
    }
  }
}
