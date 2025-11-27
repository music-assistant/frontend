#!/usr/bin/env node
/**
 * Simple Standalone Signaling Server for Testing
 *
 * Run with: node standalone.js
 * Or: npx ts-node standalone.js
 *
 * Default port: 8787
 * Custom port: PORT=9000 node standalone.js
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8787;

// Storage
const servers = new Map(); // remoteId -> ws
const clients = new Map(); // sessionId -> { ws, remoteId }
const wsMetadata = new Map(); // ws -> { type, id }

function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sendError(ws, error) {
  ws.send(JSON.stringify({ type: 'error', error }));
}

function handleMessage(ws, message) {
  let msg;
  try {
    msg = JSON.parse(message);
  } catch (e) {
    sendError(ws, 'Invalid JSON');
    return;
  }

  console.log(`[${new Date().toISOString()}] Received: ${msg.type}`);

  switch (msg.type) {
    case 'register-server': {
      const remoteId = msg.remoteId?.toUpperCase();
      if (!remoteId) {
        sendError(ws, 'Remote ID required');
        return;
      }

      // Replace existing connection
      if (servers.has(remoteId)) {
        const oldWs = servers.get(remoteId);
        oldWs.close(4000, 'Replaced');
        servers.delete(remoteId);
      }

      servers.set(remoteId, ws);
      wsMetadata.set(ws, { type: 'server', id: remoteId });

      console.log(`✓ Server registered: ${remoteId}`);
      ws.send(JSON.stringify({ type: 'registered', remoteId }));
      break;
    }

    case 'connect-request': {
      const remoteId = msg.remoteId?.toUpperCase();
      if (!remoteId) {
        sendError(ws, 'Remote ID required');
        return;
      }

      const serverWs = servers.get(remoteId);
      if (!serverWs) {
        sendError(ws, 'Server not found');
        return;
      }

      const sessionId = generateSessionId();
      clients.set(sessionId, { ws, remoteId });
      wsMetadata.set(ws, { type: 'client', id: sessionId });

      console.log(`✓ Client connected to ${remoteId} (session: ${sessionId})`);

      ws.send(JSON.stringify({ type: 'connected', remoteId, sessionId }));
      serverWs.send(JSON.stringify({ type: 'client-connected', sessionId }));
      break;
    }

    case 'offer':
    case 'answer':
    case 'ice-candidate': {
      const metadata = wsMetadata.get(ws);
      if (!metadata) {
        sendError(ws, 'Not registered');
        return;
      }

      if (metadata.type === 'client') {
        // Client -> Server
        const clientData = clients.get(metadata.id);
        if (!clientData) return;

        const serverWs = servers.get(clientData.remoteId);
        if (serverWs) {
          serverWs.send(JSON.stringify({ ...msg, sessionId: metadata.id }));
        }
      } else if (metadata.type === 'server') {
        // Server -> Client
        const sessionId = msg.sessionId;
        const clientData = clients.get(sessionId);
        if (clientData) {
          clientData.ws.send(JSON.stringify(msg));
        }
      }
      break;
    }

    default:
      console.log(`Unknown message type: ${msg.type}`);
  }
}

function handleDisconnect(ws) {
  const metadata = wsMetadata.get(ws);
  if (!metadata) return;

  if (metadata.type === 'server') {
    const remoteId = metadata.id;
    servers.delete(remoteId);
    console.log(`✗ Server disconnected: ${remoteId}`);

    // Notify connected clients
    for (const [sessionId, clientData] of clients.entries()) {
      if (clientData.remoteId === remoteId) {
        clientData.ws.send(JSON.stringify({ type: 'peer-disconnected' }));
        clients.delete(sessionId);
      }
    }
  } else if (metadata.type === 'client') {
    const sessionId = metadata.id;
    const clientData = clients.get(sessionId);

    if (clientData) {
      const serverWs = servers.get(clientData.remoteId);
      if (serverWs) {
        serverWs.send(JSON.stringify({ type: 'client-disconnected', sessionId }));
      }
      clients.delete(sessionId);
    }
    console.log(`✗ Client disconnected: ${sessionId}`);
  }

  wsMetadata.delete(ws);
}

// Create HTTP server
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', servers: servers.size, clients: clients.size }));
  } else if (req.url?.startsWith('/api/check/')) {
    const remoteId = req.url.split('/').pop()?.toUpperCase();
    const online = remoteId ? servers.has(remoteId) : false;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ online }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Music Assistant Signaling Server

Status: Running
Connected servers: ${servers.size}
Connected clients: ${clients.size}

Endpoints:
  WebSocket: ws://localhost:${PORT}/ws
  Health:    http://localhost:${PORT}/health
  Check:     http://localhost:${PORT}/api/check/:remoteId
`);
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  console.log(`[${new Date().toISOString()}] New connection`);

  ws.on('message', (data) => handleMessage(ws, data.toString()));
  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    handleDisconnect(ws);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Music Assistant Signaling Server (Test Mode)          ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  WebSocket URL:  ws://localhost:${PORT}/ws                   ║
║  Health Check:   http://localhost:${PORT}/health             ║
║                                                           ║
║  For remote testing with ngrok:                           ║
║    ngrok http ${PORT}                                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
});
