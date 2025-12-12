/**
 * Cryptographic Utilities
 *
 * Provides utilities for certificate fingerprint verification used in
 * WebRTC DTLS certificate pinning for server authentication.
 */

import { base32nopad } from "@scure/base";

export class CertificateVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateVerificationError";
  }
}

/**
 * Verify that an SDP's SHA-256 fingerprint matches the expected remote ID.
 * Throws CertificateVerificationError if verification fails.
 *
 * @param sdp - The SDP string containing the fingerprint
 * @param expectedRemoteId - The expected remote ID
 *   custom base32-encoded (with 9s instead of 2s) 128-bit truncated SHA-256 fingerprint
 * @throws CertificateVerificationError if no fingerprint found or if fingerprint doesn't match
 */
export function verifySdpFingerprint(
  sdp: string,
  expectedRemoteId: string,
): void {
  // Extract fingerprint from SDP
  const match = sdp.match(/a=fingerprint:sha-256\s+([A-Fa-f0-9:]+)/);
  if (!match) {
    throw new CertificateVerificationError(
      "No SHA-256 fingerprint found in SDP",
    );
  }

  // Parse fingerprint hex to bytes and truncate to 128 bits
  const hex = match[1].replace(/:/g, "");
  const fingerprint = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    fingerprint[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  // Remote ID uses modified base32 with "9" instead of "2", reverse before decoding
  const expected = base32nopad.decode(expectedRemoteId.replace(/9/g, "2"));

  if (expected.length !== 16) {
    throw new CertificateVerificationError("Invalid remote ID format");
  }

  for (let i = 0; i < 16; i++) {
    if (fingerprint[i] !== expected[i]) {
      throw new CertificateVerificationError("Fingerprint mismatch");
    }
  }
}
