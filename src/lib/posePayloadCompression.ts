/**
 * Compression utilities for PoseSequencePayload.
 *
 * Strategy
 * --------
 * 1. JSON-stringify the payload.
 * 2. Encode to UTF-8 bytes.
 * 3. Attempt gzip via the Web Streams CompressionStream API
 *    (available in React Native 0.74+ via the Hermes engine).
 * 4. If CompressionStream is unavailable, fall back to uncompressed base64.
 * 5. Return a CompressedPosePayload envelope with encoding metadata.
 *
 * The server checks the `encoding` field and decompresses if necessary.
 *
 * Typical compression ratio for pose JSON is 8-12x (keypoint coordinates
 * and timestamps are highly repetitive), so gzip saves significant bandwidth.
 */

import type { CompressedPosePayload, PoseSequencePayload } from "@/types/onDevicePose";

// ---------------------------------------------------------------------------
// Byte / base64 helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Uint8Array to a base64 string without relying on `btoa` (which
 * chokes on bytes > 127). Uses a chunked approach to avoid stack overflow on
 * large arrays.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 */
export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Gzip via CompressionStream (React Native / Web Streams)
// ---------------------------------------------------------------------------

/**
 * Returns true when the runtime exposes the Web Streams CompressionStream API.
 * In React Native 0.74+ with Hermes this is available.
 * In Expo Go it may not be available depending on the build.
 */
// Typed interface for the runtime CompressionStream / DecompressionStream globals
// that exist in React Native / browser but not in the Node.js type lib.
type StreamConstructor = new (format: string) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

export function isCompressionStreamAvailable(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { CompressionStream?: unknown }).CompressionStream === "function"
  );
}

/**
 * Gzip-compress a Uint8Array using the Web Streams CompressionStream API.
 * Rejects if CompressionStream is not available.
 */
export async function gzipBytes(input: Uint8Array): Promise<Uint8Array> {
  if (!isCompressionStreamAvailable()) {
    throw new Error("CompressionStream is not available in this runtime.");
  }

  const CompressionStream = (globalThis as { CompressionStream: StreamConstructor })
    .CompressionStream;
  const cs = new CompressionStream("gzip");

  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  // Write all input then close the stream.
  void writer.write(input).then(() => writer.close());

  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compress a PoseSequencePayload into a CompressedPosePayload envelope.
 *
 * Tries gzip first; falls back to uncompressed if CompressionStream is absent.
 */
export async function compressPayload(
  payload: PoseSequencePayload,
): Promise<CompressedPosePayload> {
  const json = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(json);
  const originalSize = rawBytes.length;

  if (isCompressionStreamAvailable()) {
    try {
      const compressed = await gzipBytes(rawBytes);
      return {
        encoding: "gzip",
        data: uint8ArrayToBase64(compressed),
        original_size_bytes: originalSize,
        compressed_size_bytes: compressed.length,
      };
    } catch {
      // Fall through to uncompressed.
    }
  }

  return {
    encoding: "none",
    data: uint8ArrayToBase64(rawBytes),
    original_size_bytes: originalSize,
    compressed_size_bytes: originalSize,
  };
}

/**
 * Decompress a CompressedPosePayload back to a PoseSequencePayload.
 * Used in tests and diagnostics.
 */
export async function decompressPayload(
  envelope: CompressedPosePayload,
): Promise<PoseSequencePayload> {
  const bytes = base64ToUint8Array(envelope.data);

  if (envelope.encoding === "gzip") {
    if (!isCompressionStreamAvailable()) {
      throw new Error("Cannot decompress: DecompressionStream is not available.");
    }
    const DecompressionStream = (globalThis as { DecompressionStream: StreamConstructor })
      .DecompressionStream;
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    void writer.write(bytes).then(() => writer.close());
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const raw = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { raw.set(c, off); off += c.length; }
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(raw)) as PoseSequencePayload;
  }

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(bytes)) as PoseSequencePayload;
}

/**
 * Compute a rough estimate of payload size before compression.
 * Used by the benchmark module without needing async.
 */
export function estimatePayloadSize(payload: PoseSequencePayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

/**
 * Compute percentile from a sorted array of numbers.
 * Used by the benchmark module.
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[idx]!;
}
