# Music Assistant Remote Access

This document describes how to set up and use remote access to your Music Assistant server from anywhere, without requiring port forwarding or VPN setup.

## Overview

Remote Access uses WebRTC to establish direct peer-to-peer connections between your browser and your home Music Assistant server. This works through NAT (Network Address Translation) using STUN/TURN servers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐         ┌──────────────┐ │
│   │  Your Browser   │         │ Signaling Server │         │  Your Home   │ │
│   │ (anywhere)      │         │ (Cloudflare)     │         │  MA Server   │ │
│   │                 │         │                  │         │              │ │
│   │ app.music-     ◄──────────►                 ◄──────────►              │ │
│   │ assistant.io   │  Signal   │                │  Signal  │              │ │
│   │                 │          └────────────────┘          │              │ │
│   │                 │                                       │              │ │
│   │                 ◄═══════════════════════════════════════►              │ │
│   │                 │     Direct P2P (WebRTC DataChannel)  │              │ │
│   │                 │          Encrypted (DTLS)            │              │ │
│   └─────────────────┘                                       └──────────────┘ │
│                                                                             │
│   NAT Traversal via STUN/TURN servers                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Hosted PWA (Frontend)

The Music Assistant PWA can be hosted publicly at `app.music-assistant.io` or similar. This allows users to access it from any browser without installing anything.

### 2. Signaling Server

A lightweight server that helps establish WebRTC connections. It exchanges SDP offers/answers and ICE candidates between peers.

### 3. STUN/TURN Servers

Help with NAT traversal:
- **STUN**: Discovers your public IP and helps establish direct connections (~85% of cases)
- **TURN**: Relays traffic when direct connection isn't possible (~15% of cases)

### 4. WebRTC Gateway (Backend)

Runs on your Music Assistant server and handles incoming WebRTC connections.

## Setup Guide

### Step 1: Deploy the Signaling Server

The signaling server can be deployed to Cloudflare Workers (free tier is sufficient):

```bash
cd signaling-server
npm install
npx wrangler login
npm run deploy
```

This will deploy to a URL like `https://ma-signaling-server.your-account.workers.dev`

For a custom domain:
1. Add your domain to Cloudflare
2. Update `wrangler.toml` with your domain
3. Redeploy

### Step 2: Configure STUN/TURN Servers

#### Option A: Use Public STUN Servers (Free, Basic)

For basic connectivity, public STUN servers are sufficient:

```javascript
// Frontend configuration (already default)
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
```

```python
# Backend configuration (already default)
ice_servers = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
    {"urls": "stun:stun.cloudflare.com:3478"},
]
```

**Limitations**: ~15% of users behind restrictive NATs won't be able to connect.

#### Option B: Use Home Assistant's TURN Server (If Available)

If Music Assistant is running as a Home Assistant add-on, you can use HA's TURN server:

```python
# In the backend
turn_config = await hass.components.cloud.async_get_turn_servers()
ice_servers = [
    {"urls": "stun:stun.l.google.com:19302"},
    *turn_config,
]
```

#### Option C: Use Cloudflare TURN (Recommended for Production)

Cloudflare offers TURN as part of their Calls product:

1. Sign up for Cloudflare Calls: https://developers.cloudflare.com/calls/
2. Create a TURN app and get credentials
3. Configure:

```javascript
// Frontend
const iceServers = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:turn.cloudflare.com:3478',
    username: 'your-username',
    credential: 'your-credential',
  },
];
```

#### Option D: Self-Host TURN Server

For full control, you can self-host a TURN server using coturn:

```bash
# Install coturn
sudo apt install coturn

# Configure /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=your-secret-key
realm=turn.yourdomain.com
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
```

### Step 3: Host the Frontend PWA

#### Option A: GitHub Pages (Free)

1. Fork the repository
2. Enable GitHub Pages in repository settings
3. Configure the build:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install

      - name: Build
        run: yarn build
        env:
          VITE_REMOTE_MODE: 'true'
          VITE_SIGNALING_URL: 'wss://signaling.music-assistant.io/ws'

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

4. Configure custom domain (optional):
   - Add a CNAME file to the `public` folder with your domain
   - Configure DNS to point to GitHub Pages

#### Option B: Cloudflare Pages (Recommended)

1. Connect your repository to Cloudflare Pages
2. Configure build settings:
   - Build command: `yarn build`
   - Build output directory: `dist`
3. Add environment variables:
   - `VITE_REMOTE_MODE`: `true`
   - `VITE_SIGNALING_URL`: `wss://signaling.music-assistant.io/ws`
4. Configure custom domain

#### Option C: Netlify

Similar to Cloudflare Pages, with automatic deployments from GitHub.

### Step 4: Enable Remote Access on Your Server

In the Music Assistant backend:

```python
from webrtc_gateway import WebRTCGateway

# During server startup
gateway = WebRTCGateway(
    signaling_url="wss://signaling.music-assistant.io/ws",
    local_ws_url=f"ws://localhost:{config.port}/ws",
    ice_servers=[
        {"urls": "stun:stun.l.google.com:19302"},
        # Add TURN if configured
    ],
)
await gateway.start()

# Display Remote ID to user
print(f"Remote ID: {gateway.remote_id}")
```

### Step 5: Connect Remotely

1. Open `app.music-assistant.io` in your browser
2. Enter your Remote ID (displayed in your MA server settings)
3. Enter your MA username and password
4. You're connected!

## Security Considerations

### Authentication

- Authentication happens directly between your browser and your MA server over the encrypted WebRTC connection
- The signaling server never sees your credentials
- Use strong passwords for your MA accounts

### Encryption

- All WebRTC traffic is encrypted using DTLS
- Even TURN-relayed traffic is encrypted end-to-end
- The signaling server only sees connection metadata

### Remote ID

- Treat your Remote ID like a semi-private identifier
- Anyone with your Remote ID can attempt to connect (but still needs valid credentials)
- You can regenerate your Remote ID in settings if needed

## Troubleshooting

### "Server not found"

- Make sure your MA server is running
- Check that Remote Access is enabled in settings
- Verify the Remote ID is correct

### Connection times out

- Check your internet connection
- Try connecting from a different network
- If you're behind a strict firewall, a TURN server may be required

### "DataChannel failed"

- NAT traversal may be failing
- Add a TURN server to the configuration
- Check firewall settings

### Slow performance

- Check your upload speed at home (needed for streaming)
- If using TURN, consider self-hosting for better latency
- Reduce audio quality in settings if needed

## Performance Considerations

- **Direct P2P**: Best performance, typical latency < 100ms
- **TURN Relay**: Higher latency (depends on TURN server location), but still usable
- **Audio Streaming**: Requires sufficient upload bandwidth at your home

## Future Improvements

- [ ] Integration with Home Assistant Cloud TURN servers
- [ ] Automatic TURN server selection based on location
- [ ] Remote Access status indicator in UI
- [ ] QR code for easy Remote ID sharing
- [ ] Multiple client connections
