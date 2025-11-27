"""
Music Assistant WebRTC Gateway

This module provides WebRTC-based remote access to Music Assistant instances.
It connects to a signaling server and handles incoming WebRTC connections,
bridging them to the local WebSocket API.

Requirements:
    pip install aiortc aiohttp websockets

Usage:
    from webrtc_gateway import WebRTCGateway

    gateway = WebRTCGateway(
        signaling_url="wss://signaling.music-assistant.io/ws",
        local_ws_url="ws://localhost:8095/ws",
    )
    await gateway.start()
"""

import asyncio
import json
import logging
import secrets
import string
from dataclasses import dataclass, field
from typing import Optional, Callable, Dict, Any

import aiohttp
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCConfiguration, RTCIceServer
from aiortc.contrib.signaling import object_to_string, object_from_string

logger = logging.getLogger(__name__)


def generate_remote_id() -> str:
    """Generate a unique Remote ID in the format MA-XXXX-XXXX."""
    chars = string.ascii_uppercase + string.digits
    part1 = ''.join(secrets.choice(chars) for _ in range(4))
    part2 = ''.join(secrets.choice(chars) for _ in range(4))
    return f"MA-{part1}-{part2}"


@dataclass
class WebRTCSession:
    """Represents an active WebRTC session with a remote client."""
    session_id: str
    peer_connection: RTCPeerConnection
    data_channel: Any = None
    local_ws: Any = None  # WebSocket connection to local MA API
    message_queue: asyncio.Queue = field(default_factory=asyncio.Queue)


class WebRTCGateway:
    """
    WebRTC Gateway for Music Assistant Remote Access.

    This gateway:
    1. Connects to a signaling server
    2. Registers with a unique Remote ID
    3. Handles incoming WebRTC connections from remote PWA clients
    4. Bridges WebRTC DataChannel messages to the local WebSocket API
    """

    def __init__(
        self,
        signaling_url: str = "wss://signaling.music-assistant.io/ws",
        local_ws_url: str = "ws://localhost:8095/ws",
        ice_servers: Optional[list] = None,
        remote_id: Optional[str] = None,
        on_remote_id_ready: Optional[Callable[[str], None]] = None,
    ):
        """
        Initialize the WebRTC Gateway.

        Args:
            signaling_url: URL of the signaling server
            local_ws_url: URL of the local Music Assistant WebSocket API
            ice_servers: List of ICE server configurations
            remote_id: Optional pre-defined Remote ID (will be generated if not provided)
            on_remote_id_ready: Callback when Remote ID is registered
        """
        self.signaling_url = signaling_url
        self.local_ws_url = local_ws_url
        self.remote_id = remote_id or generate_remote_id()
        self.on_remote_id_ready = on_remote_id_ready

        # ICE servers configuration
        self.ice_servers = ice_servers or [
            {"urls": "stun:stun.l.google.com:19302"},
            {"urls": "stun:stun1.l.google.com:19302"},
            {"urls": "stun:stun.cloudflare.com:3478"},
        ]

        # Active sessions
        self.sessions: Dict[str, WebRTCSession] = {}

        # Signaling WebSocket
        self._signaling_ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self._signaling_session: Optional[aiohttp.ClientSession] = None

        # Control
        self._running = False
        self._reconnect_delay = 5

    @property
    def is_running(self) -> bool:
        """Check if the gateway is running."""
        return self._running

    async def start(self) -> None:
        """Start the WebRTC gateway."""
        logger.info(f"Starting WebRTC Gateway with Remote ID: {self.remote_id}")
        self._running = True

        # Start the main loop
        asyncio.create_task(self._run())

    async def stop(self) -> None:
        """Stop the WebRTC gateway."""
        logger.info("Stopping WebRTC Gateway")
        self._running = False

        # Close all sessions
        for session_id, session in list(self.sessions.items()):
            await self._close_session(session_id)

        # Close signaling connection
        if self._signaling_ws:
            await self._signaling_ws.close()

        if self._signaling_session:
            await self._signaling_session.close()

    async def _run(self) -> None:
        """Main run loop with reconnection logic."""
        while self._running:
            try:
                await self._connect_to_signaling()
            except Exception as e:
                logger.error(f"Signaling connection error: {e}")

            if self._running:
                logger.info(f"Reconnecting to signaling server in {self._reconnect_delay}s")
                await asyncio.sleep(self._reconnect_delay)

    async def _connect_to_signaling(self) -> None:
        """Connect to the signaling server."""
        logger.info(f"Connecting to signaling server: {self.signaling_url}")

        self._signaling_session = aiohttp.ClientSession()

        try:
            self._signaling_ws = await self._signaling_session.ws_connect(
                self.signaling_url,
                heartbeat=30,
            )

            # Register with the signaling server
            await self._register()

            # Handle incoming messages
            async for msg in self._signaling_ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    await self._handle_signaling_message(json.loads(msg.data))
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error(f"Signaling WebSocket error: {self._signaling_ws.exception()}")
                    break
                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    logger.info("Signaling WebSocket closed")
                    break

        finally:
            if self._signaling_session:
                await self._signaling_session.close()
                self._signaling_session = None
            self._signaling_ws = None

    async def _register(self) -> None:
        """Register with the signaling server."""
        if not self._signaling_ws:
            return

        await self._signaling_ws.send_json({
            "type": "register-server",
            "remoteId": self.remote_id,
        })

    async def _handle_signaling_message(self, message: dict) -> None:
        """Handle incoming signaling messages."""
        msg_type = message.get("type")
        logger.debug(f"Received signaling message: {msg_type}")

        if msg_type == "registered":
            logger.info(f"Registered with signaling server as: {message.get('remoteId')}")
            if self.on_remote_id_ready:
                self.on_remote_id_ready(self.remote_id)

        elif msg_type == "client-connected":
            session_id = message.get("sessionId")
            logger.info(f"Client connected: {session_id}")
            await self._create_session(session_id)

        elif msg_type == "client-disconnected":
            session_id = message.get("sessionId")
            logger.info(f"Client disconnected: {session_id}")
            await self._close_session(session_id)

        elif msg_type == "offer":
            session_id = message.get("sessionId")
            offer = message.get("data")
            await self._handle_offer(session_id, offer)

        elif msg_type == "ice-candidate":
            session_id = message.get("sessionId")
            candidate = message.get("data")
            await self._handle_ice_candidate(session_id, candidate)

        elif msg_type == "error":
            logger.error(f"Signaling error: {message.get('error')}")

    async def _create_session(self, session_id: str) -> None:
        """Create a new WebRTC session for a client."""
        # Create RTCPeerConnection with ICE servers
        config = RTCConfiguration(
            iceServers=[RTCIceServer(**server) for server in self.ice_servers]
        )
        pc = RTCPeerConnection(configuration=config)

        session = WebRTCSession(
            session_id=session_id,
            peer_connection=pc,
        )
        self.sessions[session_id] = session

        # Set up event handlers
        @pc.on("datachannel")
        def on_datachannel(channel):
            logger.info(f"DataChannel received: {channel.label}")
            session.data_channel = channel
            asyncio.create_task(self._setup_data_channel(session))

        @pc.on("icecandidate")
        async def on_icecandidate(candidate):
            if candidate and self._signaling_ws:
                await self._signaling_ws.send_json({
                    "type": "ice-candidate",
                    "sessionId": session_id,
                    "data": {
                        "candidate": candidate.candidate,
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                    },
                })

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"Connection state: {pc.connectionState}")
            if pc.connectionState == "failed":
                await self._close_session(session_id)

    async def _handle_offer(self, session_id: str, offer: dict) -> None:
        """Handle an SDP offer from a client."""
        session = self.sessions.get(session_id)
        if not session:
            logger.error(f"Session not found: {session_id}")
            return

        pc = session.peer_connection

        # Set remote description
        await pc.setRemoteDescription(RTCSessionDescription(
            sdp=offer.get("sdp"),
            type=offer.get("type"),
        ))

        # Create and send answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        if self._signaling_ws:
            await self._signaling_ws.send_json({
                "type": "answer",
                "sessionId": session_id,
                "data": {
                    "sdp": pc.localDescription.sdp,
                    "type": pc.localDescription.type,
                },
            })

    async def _handle_ice_candidate(self, session_id: str, candidate: dict) -> None:
        """Handle an ICE candidate from a client."""
        session = self.sessions.get(session_id)
        if not session:
            return

        if candidate and candidate.get("candidate"):
            await session.peer_connection.addIceCandidate(RTCIceCandidate(
                candidate=candidate.get("candidate"),
                sdpMid=candidate.get("sdpMid"),
                sdpMLineIndex=candidate.get("sdpMLineIndex"),
            ))

    async def _setup_data_channel(self, session: WebRTCSession) -> None:
        """Set up the DataChannel for a session."""
        channel = session.data_channel
        if not channel:
            return

        # Connect to local WebSocket API
        local_session = aiohttp.ClientSession()
        try:
            session.local_ws = await local_session.ws_connect(self.local_ws_url)
            logger.info(f"Connected to local WebSocket for session {session.session_id}")

            # Start message forwarding tasks
            asyncio.create_task(self._forward_to_local(session))
            asyncio.create_task(self._forward_from_local(session, local_session))

            @channel.on("message")
            def on_message(message):
                # Queue message to be forwarded to local WS
                session.message_queue.put_nowait(message)

            @channel.on("close")
            def on_close():
                logger.info(f"DataChannel closed for session {session.session_id}")
                asyncio.create_task(self._close_session(session.session_id))

        except Exception as e:
            logger.error(f"Failed to connect to local WebSocket: {e}")
            await local_session.close()

    async def _forward_to_local(self, session: WebRTCSession) -> None:
        """Forward messages from DataChannel to local WebSocket."""
        try:
            while session.local_ws and not session.local_ws.closed:
                message = await session.message_queue.get()
                if session.local_ws and not session.local_ws.closed:
                    await session.local_ws.send_str(message)
        except Exception as e:
            logger.error(f"Error forwarding to local: {e}")

    async def _forward_from_local(self, session: WebRTCSession, local_session: aiohttp.ClientSession) -> None:
        """Forward messages from local WebSocket to DataChannel."""
        try:
            async for msg in session.local_ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    if session.data_channel and session.data_channel.readyState == "open":
                        session.data_channel.send(msg.data)
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error(f"Local WebSocket error")
                    break
                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    break
        except Exception as e:
            logger.error(f"Error forwarding from local: {e}")
        finally:
            await local_session.close()

    async def _close_session(self, session_id: str) -> None:
        """Close and clean up a session."""
        session = self.sessions.pop(session_id, None)
        if not session:
            return

        logger.info(f"Closing session: {session_id}")

        if session.local_ws and not session.local_ws.closed:
            await session.local_ws.close()

        if session.data_channel:
            session.data_channel.close()

        await session.peer_connection.close()


# Example usage
async def main():
    """Example of running the WebRTC Gateway."""
    logging.basicConfig(level=logging.INFO)

    gateway = WebRTCGateway(
        signaling_url="wss://signaling.music-assistant.io/ws",
        local_ws_url="ws://localhost:8095/ws",
        on_remote_id_ready=lambda remote_id: print(f"\n*** Remote ID: {remote_id} ***\n"),
    )

    await gateway.start()

    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await gateway.stop()


if __name__ == "__main__":
    asyncio.run(main())
