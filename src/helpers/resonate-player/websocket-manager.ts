export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private shouldReconnect: boolean = false;

  // Event handlers
  private onOpenHandler?: () => void;
  private onMessageHandler?: (event: MessageEvent) => void;
  private onErrorHandler?: (error: Event) => void;
  private onCloseHandler?: () => void;

  constructor() {}

  // Connect to WebSocket server
  async connect(
    url: string,
    onOpen?: () => void,
    onMessage?: (event: MessageEvent) => void,
    onError?: (error: Event) => void,
    onClose?: () => void,
  ): Promise<void> {
    // Store handlers
    this.onOpenHandler = onOpen;
    this.onMessageHandler = onMessage;
    this.onErrorHandler = onError;
    this.onCloseHandler = onClose;

    // Disconnect if already connected
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log("Resonate: Connecting to", url);

        this.ws = new WebSocket(url);
        this.ws.binaryType = "arraybuffer";
        this.shouldReconnect = true;

        this.ws.onopen = () => {
          console.log("Resonate: WebSocket connected");
          if (this.onOpenHandler) {
            this.onOpenHandler();
          }
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          if (this.onMessageHandler) {
            this.onMessageHandler(event);
          }
        };

        this.ws.onerror = (error: Event) => {
          console.error("Resonate: WebSocket error", error);
          if (this.onErrorHandler) {
            this.onErrorHandler(error);
          }
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("Resonate: WebSocket disconnected");
          if (this.onCloseHandler) {
            this.onCloseHandler();
          }

          // Try to reconnect after a delay if we should reconnect
          if (this.shouldReconnect) {
            this.scheduleReconnect(url);
          }
        };
      } catch (error) {
        console.error("Resonate: Failed to connect", error);
        reject(error);
      }
    });
  }

  // Schedule reconnection attempt
  private scheduleReconnect(url: string): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = window.setTimeout(() => {
      if (this.shouldReconnect) {
        console.log("Resonate: Attempting to reconnect...");
        this.connect(
          url,
          this.onOpenHandler,
          this.onMessageHandler,
          this.onErrorHandler,
          this.onCloseHandler,
        ).catch((error) => {
          console.error("Resonate: Reconnection failed", error);
        });
      }
    }, 5000);
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Send message to server (JSON)
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("Resonate: Cannot send message, WebSocket not connected");
    }
  }

  // Check if WebSocket is connected
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // Get current ready state
  getReadyState(): number {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}
