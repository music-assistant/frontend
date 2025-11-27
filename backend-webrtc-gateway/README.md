# Music Assistant WebRTC Gateway (Python)

WebRTC gateway module for enabling remote access to Music Assistant instances. This module should be integrated into the Music Assistant backend.

## Overview

The WebRTC Gateway enables users to access their Music Assistant server from anywhere without port forwarding or VPN setup. It works by:

1. Registering with a central signaling server using a unique Remote ID
2. Accepting incoming WebRTC connections from the hosted PWA
3. Bridging WebRTC DataChannel messages to the local WebSocket API

## Installation

```bash
pip install aiortc aiohttp websockets
```

## Usage

### Basic Usage

```python
import asyncio
from webrtc_gateway import WebRTCGateway

async def main():
    gateway = WebRTCGateway(
        signaling_url="wss://signaling.music-assistant.io/ws",
        local_ws_url="ws://localhost:8095/ws",
    )

    await gateway.start()

    # The gateway is now running
    # Remote ID is available at: gateway.remote_id

    # To stop:
    # await gateway.stop()

asyncio.run(main())
```

### Integration with Music Assistant

```python
from music_assistant.server import MusicAssistant
from webrtc_gateway import WebRTCGateway

class MusicAssistantWithRemoteAccess(MusicAssistant):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.webrtc_gateway = None

    async def enable_remote_access(self):
        """Enable WebRTC remote access."""
        self.webrtc_gateway = WebRTCGateway(
            signaling_url="wss://signaling.music-assistant.io/ws",
            local_ws_url=f"ws://localhost:{self.config.web_port}/ws",
            on_remote_id_ready=self._on_remote_id_ready,
        )
        await self.webrtc_gateway.start()

    def _on_remote_id_ready(self, remote_id: str):
        """Called when Remote ID is registered."""
        # Store in config or display to user
        self.config.remote_id = remote_id
        self.logger.info(f"Remote Access enabled. Remote ID: {remote_id}")

    async def disable_remote_access(self):
        """Disable WebRTC remote access."""
        if self.webrtc_gateway:
            await self.webrtc_gateway.stop()
            self.webrtc_gateway = None
```

## Configuration Options

```python
WebRTCGateway(
    # Signaling server URL
    signaling_url="wss://signaling.music-assistant.io/ws",

    # Local Music Assistant WebSocket URL
    local_ws_url="ws://localhost:8095/ws",

    # ICE servers for NAT traversal (optional, has defaults)
    ice_servers=[
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun.cloudflare.com:3478"},
        # Add TURN server for better connectivity:
        # {
        #     "urls": "turn:turn.example.com:3478",
        #     "username": "user",
        #     "credential": "pass"
        # }
    ],

    # Pre-defined Remote ID (optional, will be generated if not provided)
    remote_id="MA-XXXX-YYYY",

    # Callback when Remote ID is registered
    on_remote_id_ready=lambda remote_id: print(f"Remote ID: {remote_id}"),
)
```

## Using Home Assistant's TURN Server

If running as a Home Assistant add-on, you can use Home Assistant's TURN server:

```python
# Get TURN credentials from Home Assistant
turn_config = await hass.components.cloud.async_get_turn_servers()

gateway = WebRTCGateway(
    signaling_url="wss://signaling.music-assistant.io/ws",
    local_ws_url="ws://localhost:8095/ws",
    ice_servers=[
        {"urls": "stun:stun.l.google.com:19302"},
        *turn_config,  # Add HA TURN servers
    ],
)
```

## Architecture

```
                                 ┌─────────────────────────┐
                                 │   Signaling Server      │
                                 │ (Cloudflare Workers)    │
                                 └───────────┬─────────────┘
                                             │
                      ┌──────────────────────┼──────────────────────┐
                      │                      │                      │
                      ▼                      │                      ▼
         ┌────────────────────┐              │         ┌────────────────────┐
         │   MA Server        │              │         │   PWA Client       │
         │   (Your Network)   │              │         │   (app.music-     │
         │                    │              │         │    assistant.io)  │
         │ ┌────────────────┐ │              │         │                    │
         │ │ WebRTC Gateway │◄┼──────────────┼─────────┼─► WebRTC           │
         │ └───────┬────────┘ │   P2P via    │         │                    │
         │         │          │   WebRTC     │         └────────────────────┘
         │         │          │              │
         │         ▼          │              │
         │ ┌────────────────┐ │              │
         │ │  Local WS API  │ │              │
         │ │  (port 8095)   │ │              │
         │ └────────────────┘ │              │
         └────────────────────┘              │
```

## Remote ID

The Remote ID is a unique identifier for your Music Assistant instance. It's used by clients to connect to your server via the signaling server.

Format: `MA-XXXX-XXXX` (e.g., `MA-X7K9-P2M4`)

### Persistent Remote ID

To keep the same Remote ID across restarts:

```python
# Load from config
remote_id = config.get("remote_id")

# If not set, generate and save
if not remote_id:
    from webrtc_gateway import generate_remote_id
    remote_id = generate_remote_id()
    config.set("remote_id", remote_id)

gateway = WebRTCGateway(
    remote_id=remote_id,
    ...
)
```

## Security

1. **No Server Authentication on Signaling**: The signaling server only facilitates connection establishment. Actual authentication happens directly between the PWA and your MA server over the WebRTC connection.

2. **End-to-End Encryption**: WebRTC provides DTLS encryption, ensuring all traffic is encrypted even when relayed through TURN servers.

3. **Remote ID Privacy**: Keep your Remote ID private. Anyone with the ID can attempt to connect (though they still need valid credentials).

## Troubleshooting

### Connection fails immediately

- Check that the signaling server is reachable
- Verify your Remote ID is correctly registered

### Connection times out

- NAT traversal may be failing
- Try adding a TURN server to the ICE configuration

### Messages not being forwarded

- Verify the local WebSocket URL is correct
- Check that the local MA server is running

## Dependencies

- `aiortc` - WebRTC implementation for Python
- `aiohttp` - Async HTTP/WebSocket client
- `websockets` - WebSocket implementation (fallback)
