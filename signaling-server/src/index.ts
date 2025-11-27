/**
 * Music Assistant WebRTC Signaling Server
 *
 * A Cloudflare Workers-based signaling server for WebRTC connections
 * between the hosted PWA and local Music Assistant instances.
 *
 * Architecture:
 * - Each MA instance registers with a unique Remote ID
 * - PWA clients connect and request connection to a Remote ID
 * - Server brokers WebRTC signaling (SDP offers/answers, ICE candidates)
 * - Uses Durable Objects to maintain WebSocket connections
 */

export interface Env {
  SIGNALING_ROOM: DurableObjectNamespace;
  ENVIRONMENT: string;
}

interface SignalingMessage {
  type: string;
  remoteId?: string;
  sessionId?: string;
  data?: any;
  error?: string;
}

// Generate a unique session ID
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Main Worker - Routes requests to appropriate Durable Objects
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (url.pathname === '/ws') {
      // Get or create the global signaling room
      const roomId = env.SIGNALING_ROOM.idFromName('global');
      const room = env.SIGNALING_ROOM.get(roomId);
      return room.fetch(request);
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '1.0.0' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // API endpoint to check if a remote ID is online
    if (url.pathname.startsWith('/api/check/')) {
      const remoteId = url.pathname.split('/').pop();
      const roomId = env.SIGNALING_ROOM.idFromName('global');
      const room = env.SIGNALING_ROOM.get(roomId);

      // Forward check request to the Durable Object
      const checkRequest = new Request(`${url.origin}/check/${remoteId}`, {
        method: 'GET',
      });
      return room.fetch(checkRequest);
    }

    return new Response('Music Assistant Signaling Server\n\nEndpoints:\n- /ws - WebSocket connection\n- /health - Health check\n- /api/check/:remoteId - Check if remote ID is online', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};

/**
 * Signaling Room Durable Object
 * Maintains WebSocket connections and handles signaling messages
 */
export class SignalingRoom {
  private state: DurableObjectState;

  // Map of Remote ID -> WebSocket (MA server instances)
  private servers: Map<string, WebSocket> = new Map();

  // Map of Session ID -> { clientWs, remoteId } (PWA clients)
  private clients: Map<string, { ws: WebSocket; remoteId: string }> = new Map();

  // Map of WebSocket -> metadata
  private wsMetadata: Map<WebSocket, { type: 'server' | 'client'; id: string }> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle check request
    if (url.pathname.startsWith('/check/')) {
      const remoteId = url.pathname.split('/').pop()?.toUpperCase();
      const isOnline = remoteId ? this.servers.has(remoteId) : false;
      return new Response(JSON.stringify({ online: isOnline }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleWebSocket(ws: WebSocket): void {
    ws.accept();

    ws.addEventListener('message', (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data as string);
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.addEventListener('close', () => {
      this.handleDisconnect(ws);
    });

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: SignalingMessage): void {
    console.log('Received message:', message.type);

    switch (message.type) {
      case 'register-server':
        this.handleServerRegister(ws, message);
        break;

      case 'connect-request':
        this.handleConnectRequest(ws, message);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.forwardSignalingMessage(ws, message);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle MA server registration
   */
  private handleServerRegister(ws: WebSocket, message: SignalingMessage): void {
    const remoteId = message.remoteId?.toUpperCase();
    if (!remoteId) {
      this.sendError(ws, 'Remote ID required');
      return;
    }

    // Check if Remote ID is already registered
    if (this.servers.has(remoteId)) {
      // Disconnect the old connection
      const oldWs = this.servers.get(remoteId)!;
      oldWs.close(4000, 'Replaced by new connection');
      this.servers.delete(remoteId);
    }

    // Register the server
    this.servers.set(remoteId, ws);
    this.wsMetadata.set(ws, { type: 'server', id: remoteId });

    console.log(`Server registered: ${remoteId}`);

    ws.send(JSON.stringify({
      type: 'registered',
      remoteId: remoteId,
    }));
  }

  /**
   * Handle PWA client connection request
   */
  private handleConnectRequest(ws: WebSocket, message: SignalingMessage): void {
    const remoteId = message.remoteId?.toUpperCase();
    if (!remoteId) {
      this.sendError(ws, 'Remote ID required');
      return;
    }

    // Check if the server is online
    const serverWs = this.servers.get(remoteId);
    if (!serverWs) {
      this.sendError(ws, 'Server not found. Make sure your Music Assistant server is running and has Remote Access enabled.');
      return;
    }

    // Generate a session ID for this connection
    const sessionId = generateSessionId();

    // Register the client
    this.clients.set(sessionId, { ws, remoteId });
    this.wsMetadata.set(ws, { type: 'client', id: sessionId });

    console.log(`Client connected to ${remoteId} with session ${sessionId}`);

    // Notify the client that connection is established
    ws.send(JSON.stringify({
      type: 'connected',
      remoteId: remoteId,
      sessionId: sessionId,
    }));

    // Notify the server about the new client
    serverWs.send(JSON.stringify({
      type: 'client-connected',
      sessionId: sessionId,
    }));
  }

  /**
   * Forward signaling messages between client and server
   */
  private forwardSignalingMessage(ws: WebSocket, message: SignalingMessage): void {
    const metadata = this.wsMetadata.get(ws);
    if (!metadata) {
      this.sendError(ws, 'Not registered');
      return;
    }

    if (metadata.type === 'client') {
      // Client -> Server
      const sessionId = metadata.id;
      const clientData = this.clients.get(sessionId);
      if (!clientData) {
        this.sendError(ws, 'Session not found');
        return;
      }

      const serverWs = this.servers.get(clientData.remoteId);
      if (!serverWs) {
        this.sendError(ws, 'Server disconnected');
        return;
      }

      serverWs.send(JSON.stringify({
        ...message,
        sessionId: sessionId,
      }));
    } else if (metadata.type === 'server') {
      // Server -> Client
      const sessionId = message.sessionId;
      if (!sessionId) {
        this.sendError(ws, 'Session ID required');
        return;
      }

      const clientData = this.clients.get(sessionId);
      if (!clientData) {
        this.sendError(ws, 'Client not found');
        return;
      }

      clientData.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(ws: WebSocket): void {
    const metadata = this.wsMetadata.get(ws);
    if (!metadata) return;

    if (metadata.type === 'server') {
      const remoteId = metadata.id;
      this.servers.delete(remoteId);
      console.log(`Server disconnected: ${remoteId}`);

      // Notify all clients connected to this server
      for (const [sessionId, clientData] of this.clients.entries()) {
        if (clientData.remoteId === remoteId) {
          clientData.ws.send(JSON.stringify({
            type: 'peer-disconnected',
          }));
          this.clients.delete(sessionId);
        }
      }
    } else if (metadata.type === 'client') {
      const sessionId = metadata.id;
      const clientData = this.clients.get(sessionId);

      if (clientData) {
        // Notify the server that the client disconnected
        const serverWs = this.servers.get(clientData.remoteId);
        if (serverWs) {
          serverWs.send(JSON.stringify({
            type: 'client-disconnected',
            sessionId: sessionId,
          }));
        }
        this.clients.delete(sessionId);
      }

      console.log(`Client disconnected: ${sessionId}`);
    }

    this.wsMetadata.delete(ws);
  }

  private sendError(ws: WebSocket, error: string): void {
    ws.send(JSON.stringify({
      type: 'error',
      error: error,
    }));
  }
}
