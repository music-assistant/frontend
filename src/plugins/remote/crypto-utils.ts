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
 * Verify and sanitize an SDP's fingerprint(s) against the expected remote ID.
 *
 * @param sdp - The SDP string containing the fingerprint(s)
 * @param expectedRemoteId - The expected remote ID
 *   custom base32-encoded (with 9s instead of 2s) 128-bit truncated SHA-256 fingerprint
 * @returns Sanitized SDP with only verified SHA-256 fingerprints
 * @throws CertificateVerificationError if SDP is empty, no fingerprint found, or fingerprint doesn't match
 */
export function verifyAndSanitizeSdp(
  sdp: string | undefined,
  expectedRemoteId: string,
): string {
  if (!sdp) {
    throw new CertificateVerificationError("No SDP provided");
  }

  // Remote ID uses modified base32 with "9" instead of "2", reverse before decoding
  const expected = base32nopad.decode(expectedRemoteId.replace(/9/g, "2"));

  if (expected.length !== 16) {
    throw new CertificateVerificationError("Invalid remote ID format");
  }

  // Remove all non-SHA-256 fingerprints from SDP to prevent algorithm substitution attacks
  // The browser might prefer sha-384/sha-512 which we cannot verify
  const sanitizedSdp = sdp.replace(/^a=fingerprint:(?!sha-256).*$/gim, "");

  // Extract ALL SHA-256 fingerprints from the sanitized SDP
  const allSha256Matches = [
    ...sanitizedSdp.matchAll(/a=fingerprint:sha-256\s+([A-Fa-f0-9:]+)/gi),
  ];

  if (allSha256Matches.length === 0) {
    throw new CertificateVerificationError(
      "No SHA-256 fingerprint found in SDP",
    );
  }

  // Verify EVERY SHA-256 fingerprint matches the expected value
  // This prevents attacks where a valid fingerprint is placed at session level
  // but a malicious one at media level (which the browser would use)
  for (const match of allSha256Matches) {
    const hex = match[1].replace(/:/g, "");
    const fingerprint = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      fingerprint[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }

    for (let i = 0; i < 16; i++) {
      if (fingerprint[i] !== expected[i]) {
        throw new CertificateVerificationError("Fingerprint mismatch");
      }
    }
  }

  return sanitizedSdp;
}
