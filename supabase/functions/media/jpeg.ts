/**
 * JPEG cleaning for player photos, run on the server before anyone else can see a photo.
 *
 * Phone photos carry EXIF and XMP metadata: the location the photo was taken, the device, the time. Every APP1
 * (EXIF, XMP), APP3 to APP13 (including IPTC), APP15 and comment segment is dropped. The one thing worth keeping is
 * the orientation, or an upright photo would show sideways, so it is written back as a minimal EXIF block holding
 * only that value. Pixel data is copied untouched. Pure, so the app's tests and the edge function share it.
 */

export type JpegInfo = { width: number; height: number; orientation: number };

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

export const isJpeg = (b: Uint8Array) => b.length > 4 && b[0] === 0xff && b[1] === SOI && b[2] === 0xff;

/** Segments with no length after the marker. */
const standalone = (m: number) => m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === SOI || m === EOI;
/** Start-of-frame markers carry the image size. C4 (DHT), C8 (JPG) and CC (DAC) do not. */
const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
/** Kept: APP0 (JFIF), APP2 (colour profile), APP14 (Adobe colour transform). */
const isDroppedMeta = (m: number) => m === 0xe1 || (m >= 0xe3 && m <= 0xed) || m === 0xef || m === 0xfe;

type Segment = { marker: number; start: number; end: number };

/** Walks the header segments up to the start of scan. Returns null for anything that isn't a well-formed JPEG. */
const segments = (b: Uint8Array): { list: Segment[]; scanStart: number } | null => {
  if (!isJpeg(b)) return null;
  const list: Segment[] = [];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let m = b[i + 1];
    // Fill bytes: any number of 0xFF before a marker.
    while (m === 0xff && i + 2 < b.length) {
      i += 1;
      m = b[i + 1];
    }
    if (m === undefined) return null;
    if (standalone(m)) {
      list.push({ marker: m, start: i, end: i + 2 });
      i += 2;
      if (m === EOI) return { list, scanStart: i };
      continue;
    }
    if (i + 4 > b.length) return null;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    list.push({ marker: m, start: i, end: i + 2 + len });
    if (m === SOS) return { list, scanStart: i + 2 + len };
    i += 2 + len;
  }
  return null;
};

/** The EXIF orientation (1 to 8) from an APP1 segment's bytes, or 1. */
export const readOrientation = (b: Uint8Array, seg: Segment): number => {
  const p = seg.start + 4;
  // "Exif\0\0"
  if (seg.end - p < 14 || b[p] !== 0x45 || b[p + 1] !== 0x78 || b[p + 2] !== 0x69 || b[p + 3] !== 0x66) return 1;
  const t = p + 6;
  const little = b[t] === 0x49 && b[t + 1] === 0x49;
  const big = b[t] === 0x4d && b[t + 1] === 0x4d;
  if (!little && !big) return 1;
  const u16 = (o: number) => (o + 1 >= seg.end ? -1 : little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) => (o + 3 >= seg.end ? -1 : little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000 : b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]));
  const ifd = u32(t + 4);
  if (ifd < 0) return 1;
  const count = u16(t + ifd);
  if (count < 0 || count > 500) return 1;
  for (let k = 0; k < count; k += 1) {
    const e = t + ifd + 2 + k * 12;
    if (e + 12 > seg.end) return 1;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
};

/** A minimal big-endian EXIF APP1 segment holding only the orientation tag. */
export const orientationSegment = (orientation: number): Uint8Array => {
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // MM, 42, first IFD at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation & 0xff, 0x00, 0x00, // orientation, SHORT, 1, value
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const len = payload.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
};

/** Size and orientation, without changing anything. Width and height are as displayed (after rotation). */
export const jpegInfo = (b: Uint8Array): JpegInfo | null => {
  const parsed = segments(b);
  if (!parsed) return null;
  let width = 0;
  let height = 0;
  let orientation = 1;
  for (const s of parsed.list) {
    if (s.marker === 0xe1 && orientation === 1) orientation = readOrientation(b, s);
    if (isSof(s.marker) && s.end - s.start >= 9) {
      height = (b[s.start + 5] << 8) | b[s.start + 6];
      width = (b[s.start + 7] << 8) | b[s.start + 8];
    }
  }
  if (!width || !height) return null;
  return orientation >= 5 ? { width: height, height: width, orientation } : { width, height, orientation };
};

/** The same photo without its metadata. Returns null when the bytes aren't a JPEG the server can read. */
export const stripJpegMetadata = (b: Uint8Array): { bytes: Uint8Array; info: JpegInfo; removed: number } | null => {
  const parsed = segments(b);
  const info = jpegInfo(b);
  if (!parsed || !info) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let removed = 0;
  let wroteOrientation = false;
  for (const s of parsed.list) {
    if (isDroppedMeta(s.marker)) {
      removed += 1;
      continue;
    }
    // Put the orientation right after JFIF (or first, if there's no JFIF), before any frame data.
    if (!wroteOrientation && s.marker !== 0xe0 && info.orientation !== 1) {
      parts.push(orientationSegment(info.orientation));
      wroteOrientation = true;
    }
    parts.push(b.subarray(s.start, s.end));
  }
  parts.push(b.subarray(parsed.scanStart));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { bytes: out, info, removed };
};
