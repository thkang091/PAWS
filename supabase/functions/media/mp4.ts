/**
 * The small part of MP4 / QuickTime a reel needs: is it a movie, how long is it, how big is the picture, and the same
 * file without its metadata boxes (`udta`, `meta`: where location, device and owner text live). Pure, no I/O.
 *
 * Removing boxes from `moov` shifts every byte after them. When the movie data (`mdat`) comes after `moov`, the chunk
 * offsets in `stco` / `co64` point into that shifted data, so they are moved back by the same amount.
 */

export type Mp4Info = { durationMs: number; width: number; height: number };
export type CleanMp4 = { bytes: Uint8Array; info: Mp4Info; removed: string[] };

type Box = { type: string; start: number; size: number; header: number };

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf"]);
const STRIP = new Set(["udta", "meta"]);

const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u64 = (b: Uint8Array, i: number) => u32(b, i) * 2 ** 32 + u32(b, i + 4);
const typeAt = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

/** The boxes directly inside [from, to). Null when a size doesn't fit (not a movie, or a damaged one). */
const boxes = (b: Uint8Array, from: number, to: number): Box[] | null => {
  const out: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    let size = u32(b, i);
    let header = 8;
    if (size === 1) {
      if (i + 16 > to) return null;
      size = u64(b, i + 8);
      header = 16;
    } else if (size === 0) size = to - i;
    if (size < header || i + size > to) return null;
    out.push({ type: typeAt(b, i + 4), start: i, size, header });
    i += size;
  }
  return i === to ? out : null;
};

const writeU32 = (b: Uint8Array, i: number, v: number) => {
  b[i] = (v >>> 24) & 255;
  b[i + 1] = (v >>> 16) & 255;
  b[i + 2] = (v >>> 8) & 255;
  b[i + 3] = v & 255;
};

/** Rebuilds a container without its metadata boxes. Returns the new bytes and the box types removed. */
const rebuild = (b: Uint8Array, box: Box, removed: string[]): Uint8Array | null => {
  const kids = boxes(b, box.start + box.header, box.start + box.size);
  if (!kids) return null;
  const parts: Uint8Array[] = [];
  for (const k of kids) {
    if (STRIP.has(k.type)) {
      removed.push(k.type);
      continue;
    }
    if (CONTAINERS.has(k.type)) {
      const inner = rebuild(b, k, removed);
      if (!inner) return null;
      parts.push(inner);
    } else parts.push(b.subarray(k.start, k.start + k.size));
  }
  const body = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(8 + body);
  writeU32(out, 0, 8 + body);
  out.set(b.subarray(box.start + 4, box.start + 8), 4);
  let at = 8;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** Every box of a type inside a container tree (depth first). */
const find = (b: Uint8Array, from: number, to: number, type: string, acc: Box[] = []): Box[] => {
  for (const k of boxes(b, from, to) ?? []) {
    if (k.type === type) acc.push(k);
    if (CONTAINERS.has(k.type)) find(b, k.start + k.header, k.start + k.size, type, acc);
  }
  return acc;
};

const readInfo = (moov: Uint8Array): Mp4Info | null => {
  const mvhd = find(moov, 8, moov.length, "mvhd")[0];
  if (!mvhd) return null;
  const p = mvhd.start + mvhd.header;
  const version = moov[p];
  const timescale = version === 1 ? u32(moov, p + 20) : u32(moov, p + 12);
  const duration = version === 1 ? u64(moov, p + 24) : u32(moov, p + 16);
  if (!timescale) return null;
  let width = 0;
  let height = 0;
  for (const tkhd of find(moov, 8, moov.length, "tkhd")) {
    const q = tkhd.start + tkhd.header;
    const end = tkhd.start + tkhd.size;
    // Width and height are the last 8 bytes, 16.16 fixed point.
    const w = u32(moov, end - 8) / 65536;
    const h = u32(moov, end - 4) / 65536;
    if (w > width) {
      width = Math.round(w);
      height = Math.round(h);
    }
    void q;
  }
  return { durationMs: Math.round((duration / timescale) * 1000), width, height };
};

/** Moves chunk offsets by `delta` (negative: data moved earlier). */
const shiftOffsets = (moov: Uint8Array, delta: number) => {
  for (const stco of find(moov, 8, moov.length, "stco")) {
    const p = stco.start + stco.header + 4;
    const n = u32(moov, p);
    for (let i = 0; i < n; i++) writeU32(moov, p + 4 + i * 4, u32(moov, p + 4 + i * 4) + delta);
  }
  for (const co64 of find(moov, 8, moov.length, "co64")) {
    const p = co64.start + co64.header + 4;
    const n = u32(moov, p);
    for (let i = 0; i < n; i++) {
      const at = p + 4 + i * 8;
      const v = u64(moov, at) + delta;
      writeU32(moov, at, Math.floor(v / 2 ** 32));
      writeU32(moov, at + 4, v >>> 0);
    }
  }
};

/** The movie without metadata, its length and picture size; null if it isn't a readable MP4 / QuickTime movie. */
export const cleanMp4 = (input: Uint8Array): CleanMp4 | null => {
  const top = boxes(input, 0, input.length);
  if (!top || top[0]?.type !== "ftyp") return null;
  const moovBox = top.find((t) => t.type === "moov");
  const mdatBox = top.find((t) => t.type === "mdat");
  if (!moovBox || !mdatBox) return null;
  const removed: string[] = [];
  const moov = rebuild(input, moovBox, removed);
  if (!moov) return null;
  const info = readInfo(moov);
  if (!info) return null;
  const delta = moov.length - moovBox.size;
  if (moovBox.start < mdatBox.start && delta !== 0) shiftOffsets(moov, delta);

  const parts: Uint8Array[] = [];
  for (const t of top) {
    if (STRIP.has(t.type)) {
      removed.push(t.type);
      continue;
    }
    parts.push(t === moovBox ? moov : input.subarray(t.start, t.start + t.size));
  }
  // A top-level metadata box before mdat also shifts the data.
  const before = top.filter((t) => STRIP.has(t.type) && t.start < mdatBox.start).reduce((n, t) => n + t.size, 0);
  if (before && moovBox.start > mdatBox.start) return null; // offsets live in moov after the data: can't fix them safely here
  if (before && moovBox.start < mdatBox.start) shiftOffsets(moov, -before);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  return { bytes, info, removed };
};
