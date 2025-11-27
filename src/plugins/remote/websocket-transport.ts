/**
 * WebSocket Transport
 *
 * Implements the transport interface using native WebSocket.
 * Used for local connections to the Music Assistant server.
 */

import { BaseTransport, TransportState } from './transport';

export interface WebSocketTransportOptions {
  url: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectDelayGrowth?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketTransport extends BaseTransport {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketTransportOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(options: WebSocketTransportOptions) {
    super();
    this.options = {
      url: options.url,
      reconnect: options.reconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      reconnectDelayGrowth: options.reconnectDelayGrowth ?? 1.5,
      maxReconnectAttempts: options.maxReconnectAttempts ?? Infinity,
    };
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.intentionalClose = false;
    this.setState(TransportState.CONNECTING);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.url);

        this.ws.onopen = () => {
          console.log('[WebSocketTransport] Connection opened');
          this.reconnectAttempts = 0;
          this.setState(TransportState.CONNECTED);
          this.emit('open');
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocketTransport] Connection closed', event.code, event.reason);
          this.setState(TransportState.DISCONNECTED);
          this.emit('close', event.reason);

          if (!this.intentionalClose && this.options.reconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          console.error('[WebSocketTransport] Error:', event);
          const error = new Error('WebSocket error');
          this.emit('error', error);

          // Only reject if we're still in connecting state
          if (this._state === TransportState.CONNECTING) {
            this.setState(TransportState.FAILED);
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.emit('message', event.data);
        };
      } catch (error) {
        this.setState(TransportState.FAILED);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState(TransportState.DISCONNECTED);
  }

  send(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(data);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.log('[WebSocketTransport] Max reconnect attempts reached');
      this.setState(TransportState.FAILED);
      return;
    }

    this.clearReconnectTimer();
    this.setState(TransportState.RECONNECTING);

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(this.options.reconnectDelayGrowth, this.reconnectAttempts),
      this.options.maxReconnectDelay
    );

    console.log(`[WebSocketTransport] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((error) => {
        console.error('[WebSocketTransport] Reconnect failed:', error);
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
