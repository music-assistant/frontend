# Music Assistant Signaling Server

WebRTC signaling server for Music Assistant remote connections. This server enables secure peer-to-peer connections between the hosted PWA and local Music Assistant instances without requiring port forwarding.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Signaling Server (Cloudflare Workers)            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Durable Object                            │   │
│  │  - Maintains WebSocket connections                          │   │
│  │  - Routes signaling messages                                │   │
│  │  - Manages Remote ID registry                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
              ↑                                    ↑
              │ WebSocket                          │ WebSocket
              │ (register-server)                  │ (connect-request)
              │                                    │
┌─────────────┴─────────────┐        ┌────────────┴────────────┐
│   MA Server Instance      │        │     PWA Client          │
│   (Local Network)         │        │   (app.music-assistant.io)│
│                           │        │                          │
│   Remote ID: MA-X7K9-P2M4 │◄──────►│   Connects to: MA-X7K9   │
└───────────────────────────┘  P2P   └──────────────────────────┘
                             WebRTC
```

## Deployment

### Prerequisites

1. Cloudflare account
2. Node.js 18+
3. Wrangler CLI

### Setup

```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

### Local Development

```bash
# Start local development server
npm run dev
```

The server will be available at `http://localhost:8787`

## API

### WebSocket Endpoint: `/ws`

Connect via WebSocket for signaling.

#### Messages from MA Server

**Register Server**
```json
{
  "type": "register-server",
  "remoteId": "MA-X7K9-P2M4"
}
```

Response:
```json
{
  "type": "registered",
  "remoteId": "MA-X7K9-P2M4"
}
```

**Signaling Messages (to client)**
```json
{
  "type": "answer|ice-candidate",
  "sessionId": "abc123",
  "data": { /* SDP or ICE candidate */ }
}
```

#### Messages from PWA Client

**Connect Request**
```json
{
  "type": "connect-request",
  "remoteId": "MA-X7K9-P2M4"
}
```

Response:
```json
{
  "type": "connected",
  "remoteId": "MA-X7K9-P2M4",
  "sessionId": "abc123"
}
```

**Signaling Messages (to server)**
```json
{
  "type": "offer|ice-candidate",
  "data": { /* SDP or ICE candidate */ }
}
```

### REST Endpoints

**Health Check**
```
GET /health
```

**Check Remote ID Status**
```
GET /api/check/:remoteId
```

Response:
```json
{
  "online": true
}
```

## Security Considerations

1. **No Authentication on Signaling**: The signaling server only facilitates connection establishment. Actual authentication happens over the WebRTC connection directly with the MA server.

2. **Remote ID Security**: Remote IDs should be sufficiently random to prevent guessing. The MA server generates these IDs.

3. **Rate Limiting**: Consider adding rate limiting for production deployments.

## Environment Variables

- `ENVIRONMENT`: Set to "production" or "development"

## Custom Domain

To use a custom domain (e.g., `signaling.music-assistant.io`):

1. Add the domain to Cloudflare
2. Update `wrangler.toml`:

```toml
routes = [
  { pattern = "signaling.music-assistant.io/*", zone_name = "music-assistant.io" }
]
```

3. Deploy with `npm run deploy`
