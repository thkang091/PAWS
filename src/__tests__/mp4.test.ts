import { cleanMp4 } from "../../supabase/functions/media/mp4";

/** Builds a box: 4-byte size, 4-byte type, body. */
const box = (type: string, ...body: Uint8Array[]) => {
  const len = 8 + body.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(len);
  new DataView(out.buffer).setUint32(0, len);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let at = 8;
  for (const b of body) {
    out.set(b, at);
    at += b.length;
  }
  return out;
};
const u32s = (...v: number[]) => {
  const out = new Uint8Array(v.length * 4);
  v.forEach((n, i) => new DataView(out.buffer).setUint32(i * 4, n));
  return out;
};
const text = (s: string) => new TextEncoder().encode(s);

const mvhd = (timescale: number, duration: number) => box("mvhd", new Uint8Array(4), u32s(0, 0, timescale, duration), new Uint8Array(80));
/** tkhd v0: ends with width and height in 16.16 fixed point. */
const tkhd = (w: number, h: number) => box("tkhd", new Uint8Array(4), new Uint8Array(72), u32s(w * 65536, h * 65536));
const stco = (...offsets: number[]) => box("stco", new Uint8Array(4), u32s(offsets.length, ...offsets));
const location = () => box("udta", box("©xyz", text("+37.7840-122.4090/")));
const ftyp = () => box("ftyp", text("qt  "), u32s(0), text("qt  "));

/** Reads the first stco offset of a cleaned file and the payload byte there. */
const firstChunk = (bytes: Uint8Array) => {
  const find = (type: string) => {
    for (let i = 0; i + 8 <= bytes.length; i++) if (String.fromCharCode(...bytes.subarray(i, i + 4)) === type) return i - 4;
    return -1;
  };
  const at = find("stco");
  const offset = new DataView(bytes.buffer, bytes.byteOffset).getUint32(at + 16);
  return { offset, byte: bytes[offset] };
};

describe("cleanMp4", () => {
  const payload = new Uint8Array([0xab, 1, 2, 3, 4, 5, 6, 7]);

  it("removes location metadata, reads length and size (movie data first, as iPhone records)", () => {
    const head = ftyp();
    const mdat = box("mdat", payload);
    const chunk = head.length + 8; // first payload byte
    const moov = box("moov", mvhd(600, 600 * 14.5), box("trak", tkhd(720, 1280), box("mdia", box("minf", box("stbl", stco(chunk))))), location());
    const file = new Uint8Array([...head, ...mdat, ...moov]);
    const out = cleanMp4(file)!;
    expect(out).not.toBeNull();
    expect(out.info).toEqual({ durationMs: 14500, width: 720, height: 1280 });
    expect(out.removed).toContain("udta");
    expect(new TextDecoder().decode(out.bytes)).not.toContain("+37.7840");
    expect(firstChunk(out.bytes)).toEqual({ offset: chunk, byte: 0xab });
  });

  it("moves chunk offsets when the movie header comes first (fast start)", () => {
    const head = ftyp();
    const build = (offset: number) => box("moov", mvhd(1000, 9000), box("trak", tkhd(1080, 1920), box("mdia", box("minf", box("stbl", stco(offset))))), location());
    const moovLen = build(0).length;
    const chunk = head.length + moovLen + 8;
    const file = new Uint8Array([...head, ...build(chunk), ...box("mdat", payload)]);
    expect(file[chunk]).toBe(0xab);
    const out = cleanMp4(file)!;
    expect(out.info.durationMs).toBe(9000);
    expect(out.bytes.length).toBeLessThan(file.length);
    const c = firstChunk(out.bytes);
    expect(c.byte).toBe(0xab);
    expect(c.offset).toBe(chunk - (file.length - out.bytes.length));
  });

  it("refuses files that aren't movies", () => {
    expect(cleanMp4(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).toBeNull();
    expect(cleanMp4(box("ftyp", text("isom")))).toBeNull();
  });
});
