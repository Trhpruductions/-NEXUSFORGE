/**
 * Checks for uploaded profile pictures (avatar and banner).
 *
 * Only PNG, JPEG and WebP are accepted, decided by the file's own leading bytes (the file name
 * and the client's Content-Type are never trusted on their own). Each format is walked chunk by
 * chunk or segment by segment, so a damaged file, or one with junk appended after its end
 * marker, is refused. Metadata that can carry personal data or hide content (EXIF, XMP, text
 * chunks, comments, trailing bytes) is dropped; colour profiles are kept so pictures keep their
 * colours. Animated images and unusual encodings are refused.
 *
 * This module does no I/O, so it can be unit tested with in-memory buffers.
 */

const MIB = 1024 * 1024;

export type ProfileImageKind = "avatar" | "banner";
export type ProfileImageFormat = "png" | "jpeg" | "webp";

export const PROFILE_IMAGE_LIMITS = {
  avatar: { maxBytes: 2 * MIB, minSide: 32, maxSide: 1024 },
  banner: { maxBytes: 6 * MIB, minWidth: 320, maxWidth: 2560, minHeight: 96, maxHeight: 1440 },
  /** Caps decoded size so a huge picture can't be used to exhaust memory later on. */
  maxPixels: 16_000_000,
} as const;

const FORMAT_BY_MIME: Record<string, ProfileImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

export const PROFILE_IMAGE_MIME: Record<ProfileImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const PROFILE_IMAGE_EXT: Record<ProfileImageFormat, string> = { png: "png", jpeg: "jpg", webp: "webp" };

export type ProfileImageCheck =
  | { ok: true; format: ProfileImageFormat; mime: string; ext: string; width: number; height: number; bytes: Buffer }
  | { ok: false; status: 400 | 413 | 415; error: string };

type Sanitized = { bytes: Buffer; width: number; height: number };

class ImageStructureError extends Error {
  constructor(readonly code: "malformed" | "unsupported" | "animated") {
    super(code);
  }
}

const malformed = () => new ImageStructureError("malformed");
const unsupported = () => new ImageStructureError("unsupported");

/** The format named by the file's leading bytes, or null for anything else (GIF, SVG, HTML, ...). */
export function detectImageFormat(bytes: Buffer): ProfileImageFormat | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * Validates and cleans an uploaded picture. `declaredMime` is the Content-Type the client sent,
 * if any; it must agree with the bytes but never decides the format on its own.
 */
export function checkProfileImage(input: Buffer, kind: ProfileImageKind, declaredMime?: string | null): ProfileImageCheck {
  const label = kind === "avatar" ? "Avatar" : "Banner";
  const limits = PROFILE_IMAGE_LIMITS[kind];

  if (input.length === 0) return fail(400, "The picture is empty.");
  if (input.length > limits.maxBytes) return fail(413, `${label} pictures can be up to ${limits.maxBytes / MIB} MB.`);

  const format = detectImageFormat(input);
  if (!format) return fail(415, "Only PNG, JPEG and WebP pictures are accepted.");
  if (declaredMime != null && FORMAT_BY_MIME[declaredMime.toLowerCase()] !== format) {
    return fail(415, "The file contents don't match its declared type.");
  }

  let clean: Sanitized;
  try {
    clean = SANITIZERS[format](input);
  } catch (error) {
    if (error instanceof ImageStructureError && error.code === "animated") {
      return fail(415, "Animated pictures aren't supported. Upload a still image.");
    }
    if (error instanceof ImageStructureError && error.code === "unsupported") {
      return fail(415, "This kind of PNG, JPEG or WebP can't be used. Save it again as a standard image and retry.");
    }
    return fail(400, "This picture is damaged or isn't a valid PNG, JPEG or WebP file.");
  }

  const { width, height } = clean;
  if (kind === "avatar") {
    const { minSide, maxSide } = PROFILE_IMAGE_LIMITS.avatar;
    if (width < minSide || height < minSide || width > maxSide || height > maxSide) {
      return fail(400, `Avatar pictures must be between ${minSide} and ${maxSide} pixels on each side.`);
    }
  } else {
    const b = PROFILE_IMAGE_LIMITS.banner;
    if (width < b.minWidth || width > b.maxWidth || height < b.minHeight || height > b.maxHeight) {
      return fail(400, `Banner pictures must be ${b.minWidth} to ${b.maxWidth} pixels wide and ${b.minHeight} to ${b.maxHeight} pixels tall.`);
    }
  }
  if (width * height > PROFILE_IMAGE_LIMITS.maxPixels) return fail(400, "That picture has too many pixels.");

  return { ok: true, format, mime: PROFILE_IMAGE_MIME[format], ext: PROFILE_IMAGE_EXT[format], width, height, bytes: clean.bytes };
}

function fail(status: 400 | 413 | 415, error: string): ProfileImageCheck {
  return { ok: false, status, error };
}

const SANITIZERS: Record<ProfileImageFormat, (bytes: Buffer) => Sanitized> = {
  png: sanitizePng,
  jpeg: sanitizeJpeg,
  webp: sanitizeWebp,
};

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Chunks needed to draw the picture. Everything else (text, EXIF, time, private chunks) is dropped. */
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD"]);
const PNG_ANIMATION_CHUNKS = new Set(["acTL", "fcTL", "fdAT"]);
/** Legal bit depths per colour type. */
const PNG_DEPTHS: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

function sanitizePng(bytes: Buffer): Sanitized {
  if (bytes.length < 8 + 12 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw malformed();
  const kept: Buffer[] = [PNG_SIGNATURE];
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawData = false;
  let sawEnd = false;
  let pos = 8;

  while (pos < bytes.length && !sawEnd) {
    if (pos + 12 > bytes.length) throw malformed();
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString("latin1", pos + 4, pos + 8);
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (!/^[A-Za-z]{4}$/.test(type) || end > bytes.length) throw malformed();
    if (crc32(bytes.subarray(pos + 4, dataEnd)) !== bytes.readUInt32BE(dataEnd)) throw malformed();
    if (!sawHeader && type !== "IHDR") throw malformed();
    if (PNG_ANIMATION_CHUNKS.has(type)) throw new ImageStructureError("animated");
    // An unknown critical chunk (upper-case first letter) can't be dropped safely.
    if (!PNG_KEEP.has(type) && type[0] === type[0].toUpperCase()) throw unsupported();

    if (type === "IHDR") {
      if (sawHeader || length !== 13) throw malformed();
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      const depth = bytes[dataStart + 8];
      const colour = bytes[dataStart + 9];
      const legalDepth = PNG_DEPTHS[colour]?.includes(depth) ?? false;
      if (!width || !height || !legalDepth || bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || bytes[dataStart + 12] > 1) {
        throw malformed();
      }
      sawHeader = true;
    }
    if (type === "IDAT") sawData = true;
    if (type === "IEND") sawEnd = true;
    if (PNG_KEEP.has(type)) kept.push(bytes.subarray(pos, end));
    pos = end;
  }

  if (!sawHeader || !sawData || !sawEnd) throw malformed();
  return { bytes: Buffer.concat(kept), width, height };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 as used by PNG chunks. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

/** Baseline, extended and progressive Huffman frames: the kinds browsers decode. */
const JPEG_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2]);
/** Lossless, hierarchical and arithmetic-coded frames, which browsers can't draw. */
const JPEG_UNSUPPORTED_MARKERS = new Set([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf, 0xcc]);

function sanitizeJpeg(bytes: Buffer): Sanitized {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw malformed();
  const kept: Buffer[] = [bytes.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let sawFrame = false;
  let sawScan = false;
  let sawEnd = false;
  let pos = 2;

  while (!sawEnd) {
    if (pos >= bytes.length || bytes[pos] !== 0xff) throw malformed();
    // Skip fill bytes (0xFF repeated before a marker code).
    let at = pos;
    while (at + 1 < bytes.length && bytes[at + 1] === 0xff) at++;
    if (at + 1 >= bytes.length) throw malformed();
    const code = bytes[at + 1];
    const start = at;
    pos = at + 2;

    if (code === 0xd9) {
      kept.push(bytes.subarray(start, pos));
      sawEnd = true;
      break;
    }
    // Standalone markers (SOI, TEM, RST) can't appear between segments here.
    if (code === 0xd8 || code === 0x01 || (code >= 0xd0 && code <= 0xd7)) throw malformed();
    if (pos + 2 > bytes.length) throw malformed();
    const segmentLength = bytes.readUInt16BE(pos);
    const segmentEnd = pos + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.length) throw malformed();

    if (JPEG_UNSUPPORTED_MARKERS.has(code)) throw unsupported();
    if (JPEG_FRAME_MARKERS.has(code)) {
      if (sawFrame || segmentLength < 8) throw malformed();
      if (bytes[pos + 2] !== 8) throw unsupported();
      height = bytes.readUInt16BE(pos + 3);
      width = bytes.readUInt16BE(pos + 5);
      if (!width || !height || !bytes[pos + 7]) throw malformed();
      sawFrame = true;
    }

    if (jpegSegmentKept(code, bytes, pos, segmentEnd)) kept.push(bytes.subarray(start, segmentEnd));
    pos = segmentEnd;

    if (code === 0xda) {
      // Start of scan: entropy-coded data runs until the next real marker.
      if (!sawFrame) throw malformed();
      sawScan = true;
      const scanEnd = jpegScanEnd(bytes, pos);
      kept.push(bytes.subarray(pos, scanEnd));
      pos = scanEnd;
    }
  }

  if (!sawFrame || !sawScan) throw malformed();
  // Anything after the end marker is dropped.
  return { bytes: Buffer.concat(kept), width, height };
}

/** Keeps tables, frame and scan headers, the JFIF header, the Adobe colour marker and the ICC profile. */
function jpegSegmentKept(code: number, bytes: Buffer, pos: number, segmentEnd: number): boolean {
  if (code === 0xdb || code === 0xc4 || code === 0xdd || code === 0xdc || code === 0xda) return true;
  if (JPEG_FRAME_MARKERS.has(code)) return true;
  if (code === 0xe0) return bytes.toString("latin1", pos + 2, Math.min(segmentEnd, pos + 7)) === "JFIF\0";
  if (code === 0xee) return true;
  if (code === 0xe2) return bytes.toString("latin1", pos + 2, Math.min(segmentEnd, pos + 14)) === "ICC_PROFILE\0";
  return false; // EXIF/XMP (APP1), other application data, comments and unknown segments
}

/** Index of the marker that ends the entropy-coded data starting at `start`. */
function jpegScanEnd(bytes: Buffer, start: number): number {
  let i = start;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    if (i + 1 >= bytes.length) return bytes.length;
    const next = bytes[i + 1];
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
      i += 2; // stuffed byte or restart marker
      continue;
    }
    if (next === 0xff) {
      i++; // fill byte
      continue;
    }
    return i;
  }
  return bytes.length;
}

// ---------------------------------------------------------------------------
// WebP (RIFF container)
// ---------------------------------------------------------------------------

const WEBP_VP8X_EXIF = 0x08;
const WEBP_VP8X_XMP = 0x04;
const WEBP_VP8X_ANIMATION = 0x02;

function webpChunk(fourcc: string, data: Buffer): Buffer {
  const pad = data.length & 1;
  const header = Buffer.alloc(8);
  header.write(fourcc, 0, "latin1");
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat(pad ? [header, data, Buffer.alloc(1)] : [header, data]);
}

function sanitizeWebp(bytes: Buffer): Sanitized {
  if (bytes.length < 20 || bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WEBP") throw malformed();
  const riffEnd = bytes.readUInt32LE(4) + 8;
  if (riffEnd > bytes.length || riffEnd < 20) throw malformed();

  const kept: Buffer[] = [];
  let width = 0;
  let height = 0;
  let hasImage = false;
  let pos = 12;

  while (pos < riffEnd) {
    if (pos + 8 > riffEnd) throw malformed();
    const fourcc = bytes.toString("latin1", pos, pos + 4);
    const size = bytes.readUInt32LE(pos + 4);
    const dataStart = pos + 8;
    const dataEnd = dataStart + size;
    const next = dataEnd + (size & 1);
    if (dataEnd > riffEnd || next > riffEnd) throw malformed();
    const data = bytes.subarray(dataStart, dataEnd);

    if (fourcc === "ANIM" || fourcc === "ANMF") throw new ImageStructureError("animated");
    if (fourcc === "VP8X") {
      if (size < 10) throw malformed();
      if (data[0] & WEBP_VP8X_ANIMATION) throw new ImageStructureError("animated");
      // Clear the flags for the metadata chunks that are dropped below.
      const copy = Buffer.from(data);
      copy[0] &= ~(WEBP_VP8X_EXIF | WEBP_VP8X_XMP);
      kept.push(webpChunk("VP8X", copy));
    } else if (fourcc === "ICCP" || fourcc === "ALPH") {
      kept.push(webpChunk(fourcc, data));
    } else if (fourcc === "VP8 ") {
      if (hasImage || data.length < 10) throw malformed();
      // Key frame: start code 9d 01 2a, then 14-bit width and height (little endian).
      if ((data[0] & 0x01) !== 0 || data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) throw malformed();
      width = data.readUInt16LE(6) & 0x3fff;
      height = data.readUInt16LE(8) & 0x3fff;
      hasImage = true;
      kept.push(webpChunk(fourcc, data));
    } else if (fourcc === "VP8L") {
      if (hasImage || data.length < 5 || data[0] !== 0x2f) throw malformed();
      const bits = data.readUInt32LE(1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
      hasImage = true;
      kept.push(webpChunk(fourcc, data));
    }
    // EXIF, XMP and unknown chunks are dropped.
    pos = next;
  }

  if (!hasImage) throw malformed();
  const payload = Buffer.concat(kept);
  // RIFF header: "RIFF", the size of everything after it ("WEBP" plus the chunks), then "WEBP".
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(4 + payload.length, 4);
  header.write("WEBP", 8, "latin1");
  return { bytes: Buffer.concat([header, payload]), width, height };
}
