import type { CompressedPosePayload, PoseSequencePayload } from "@/types/onDevicePose";

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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

export async function gzipBytes(input: Uint8Array): Promise<Uint8Array> {
  if (!isCompressionStreamAvailable()) {
    throw new Error("CompressionStream is not available in this runtime.");
  }

  const CompressionStream = (globalThis as { CompressionStream: StreamConstructor })
    .CompressionStream;
  const cs = new CompressionStream("gzip");

  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

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
    }
  }

  return {
    encoding: "none",
    data: uint8ArrayToBase64(rawBytes),
    original_size_bytes: originalSize,
    compressed_size_bytes: originalSize,
  };
}

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

export function estimatePayloadSize(payload: PoseSequencePayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[idx]!;
}
