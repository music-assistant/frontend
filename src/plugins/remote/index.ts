/**
 * Remote Connection Module
 *
 * Provides WebRTC-based remote connections to Music Assistant instances.
 * Enables users to connect to their home MA server from anywhere without
 * port forwarding or VPN setup.
 */

export * from "./transport";
export * from "./websocket-transport";
export * from "./webrtc-transport";
export * from "./signaling";
export * from "./connection-manager";

// Re-export the singleton manager as default
export { remoteConnectionManager as default } from "./connection-manager";
