import test from "node:test";
import assert from "node:assert/strict";

// image-validation.ts has no I/O and no env dependency; every input here is an in-memory buffer.
const { checkProfileImage, crc32, detectImageFormat, PROFILE_IMAGE_LIMITS } = await import("../src/lib/image-validation.js");

type Check = ReturnType<typeof checkProfileImage>;

function accepted(result: Check) {
  if (!result.ok) assert.fail(`expected the picture to be accepted, got ${result.status}: ${result.error}`);
  return result;
}

function rejected(result: Check, status: number) {
  if (result.ok) assert.fail(`expected the picture to be refused with ${status}`);
  assert.equal(result.status, status, result.error);
  return result;
}

// ---- PNG -------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer, crcOverride?: number): Buffer {
  const typeBytes = Buffer.from(type, "latin1");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crcOverride ?? crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function pngHeader(width: number, height: number, colour = 2, depth = 8) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = depth;
  data[9] = colour;
  return data;
}

const PNG_IDAT = Buffer.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]);

function png(width: number, height: number, middle: Buffer[] = [], tail: Buffer[] = []) {
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", pngHeader(width, height)),
    ...middle,
    pngChunk("IDAT", PNG_IDAT),
    pngChunk("IEND", Buffer.alloc(0)),
    ...tail,
  ]);
}

test("crc32 matches the standard checksum used by PNG", () => {
  assert.equal(crc32(Buffer.from("IEND")), 0xae426082);
});

test("a clean PNG is accepted with its size and type", () => {
  const out = accepted(checkProfileImage(png(512, 512), "avatar", "image/png"));
  assert.equal(out.format, "png");
  assert.equal(out.mime, "image/png");
  assert.equal(out.ext, "png");
  assert.equal([out.width, out.height].join("x"), "512x512");
});

test("PNG text, EXIF-like and time chunks are dropped, and bytes after the end are ignored", () => {
  const dirty = png(
    512,
    512,
    [
      pngChunk("tEXt", Buffer.from("Author\0secret-person@example.com")),
      pngChunk("eXIf", Buffer.from("GPS 51.5N 0.1W")),
      pngChunk("tIME", Buffer.alloc(7)),
    ],
    [Buffer.from("<script>alert(1)</script>")],
  );
  const out = accepted(checkProfileImage(dirty, "avatar", "image/png"));
  assert.equal(out.bytes.includes(Buffer.from("secret-person")), false);
  assert.equal(out.bytes.includes(Buffer.from("GPS")), false);
  assert.equal(out.bytes.includes(Buffer.from("<script>")), false);
  // The cleaned file is still a valid PNG and is stable on a second pass.
  const again = accepted(checkProfileImage(out.bytes, "avatar", "image/png"));
  assert.deepEqual(again.bytes, out.bytes);
});

test("a PNG chunk with a wrong checksum is refused as damaged", () => {
  rejected(checkProfileImage(png(512, 512, [pngChunk("tEXt", Buffer.from("x"), 0x12345678)]), "avatar", "image/png"), 400);
});

test("animated PNG is refused", () => {
  rejected(checkProfileImage(png(512, 512, [pngChunk("acTL", Buffer.alloc(8))]), "avatar", "image/png"), 415);
});

test("a PNG with an unknown critical chunk is refused", () => {
  rejected(checkProfileImage(png(512, 512, [pngChunk("ZZZZ", Buffer.alloc(1))]), "avatar", "image/png"), 415);
});

test("a PNG missing its end chunk or its image data is refused as damaged", () => {
  const noEnd = Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", pngHeader(512, 512)), pngChunk("IDAT", PNG_IDAT)]);
  rejected(checkProfileImage(noEnd, "avatar", "image/png"), 400);
  const noData = Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", pngHeader(512, 512)), pngChunk("IEND", Buffer.alloc(0))]);
  rejected(checkProfileImage(noData, "avatar", "image/png"), 400);
});

// ---- Type detection: bytes decide, never the name or the declared type ---------

test("GIF, SVG, HTML and plain text are refused whatever they claim to be", () => {
  rejected(checkProfileImage(Buffer.from("GIF89a" + "\0".repeat(200)), "avatar", "image/gif"), 415);
  rejected(checkProfileImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'), "avatar", "image/svg+xml"), 415);
  rejected(checkProfileImage(Buffer.from("<html><script>x</script></html>"), "avatar", "text/html"), 415);
  rejected(checkProfileImage(Buffer.from("hello world, not an image"), "avatar", "image/png"), 415);
});

test("a PNG declared as JPEG (or the other way round) is refused", () => {
  rejected(checkProfileImage(png(512, 512), "avatar", "image/jpeg"), 415);
});

test("a PNG signature followed by junk is damaged, not accepted", () => {
  rejected(checkProfileImage(Buffer.concat([PNG_SIGNATURE, Buffer.from("<?php system($_GET['x']); ?>")]), "avatar", "image/png"), 400);
});

test("detectImageFormat reads only the leading bytes", () => {
  assert.equal(detectImageFormat(PNG_SIGNATURE), "png");
  assert.equal(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
  assert.equal(detectImageFormat(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")), "webp");
  assert.equal(detectImageFormat(Buffer.from("GIF89a")), null);
  assert.equal(detectImageFormat(Buffer.from("MZ")), null);
  assert.equal(detectImageFormat(Buffer.alloc(0)), null);
});

test("empty and oversized files are refused before they are parsed", () => {
  rejected(checkProfileImage(Buffer.alloc(0), "avatar", "image/png"), 400);
  const oversized = Buffer.concat([png(512, 512), Buffer.alloc(PROFILE_IMAGE_LIMITS.avatar.maxBytes)]);
  rejected(checkProfileImage(oversized, "avatar", "image/png"), 413);
});

// ---- Dimensions -----------------------------------------------------------------

test("avatar dimensions are enforced at both ends", () => {
  accepted(checkProfileImage(png(32, 32), "avatar", "image/png"));
  accepted(checkProfileImage(png(1024, 1024), "avatar", "image/png"));
  rejected(checkProfileImage(png(31, 31), "avatar", "image/png"), 400);
  rejected(checkProfileImage(png(1025, 1025), "avatar", "image/png"), 400);
});

test("banner dimensions are enforced at both ends", () => {
  accepted(checkProfileImage(png(1500, 500), "banner", "image/png"));
  accepted(checkProfileImage(png(320, 96), "banner", "image/png"));
  accepted(checkProfileImage(png(2560, 1440), "banner", "image/png"));
  rejected(checkProfileImage(png(319, 500), "banner", "image/png"), 400);
  rejected(checkProfileImage(png(2561, 500), "banner", "image/png"), 400);
  rejected(checkProfileImage(png(1500, 1441), "banner", "image/png"), 400);
});

// ---- JPEG -----------------------------------------------------------------------

function jpegSegment(code: number, payload: Buffer): Buffer {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, code]), length, payload]);
}

function frameHeader(code: number, width: number, height: number, precision = 8) {
  return jpegSegment(code, Buffer.from([precision, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]));
}

const JPEG_SOI = Buffer.from([0xff, 0xd8]);
const JPEG_EOI = Buffer.from([0xff, 0xd9]);
const JPEG_JFIF = jpegSegment(0xe0, Buffer.from("JFIF\0\x01\x01\x00\x00\x01\x00\x01\x00\x00", "latin1"));
const JPEG_DQT = jpegSegment(0xdb, Buffer.concat([Buffer.from([0]), Buffer.alloc(64, 1)]));
const JPEG_DHT = jpegSegment(0xc4, Buffer.alloc(17));
const JPEG_SOS = jpegSegment(0xda, Buffer.from([1, 1, 0x00, 0, 63, 0]));
/** Stuffed 0xFF00, a restart marker, and plain data. */
const JPEG_ENTROPY = Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78]);

function jpeg(width: number, height: number, extra: Buffer[] = [], tail: Buffer[] = []) {
  return Buffer.concat([JPEG_SOI, JPEG_JFIF, ...extra, JPEG_DQT, frameHeader(0xc0, width, height), JPEG_DHT, JPEG_SOS, JPEG_ENTROPY, JPEG_EOI, ...tail]);
}

test("a clean JPEG is accepted with its size", () => {
  const out = accepted(checkProfileImage(jpeg(512, 512), "avatar", "image/jpeg"));
  assert.equal(out.format, "jpeg");
  assert.equal(out.ext, "jpg");
  assert.equal([out.width, out.height].join("x"), "512x512");
});

test("JPEG EXIF, comments and trailing data are dropped while the picture and JFIF header stay", () => {
  const dirty = jpeg(
    512,
    512,
    [jpegSegment(0xe1, Buffer.from("Exif\0\0GPS-SECRET-LOCATION", "latin1")), jpegSegment(0xfe, Buffer.from("a private comment"))],
    [Buffer.from("<script>evil()</script>")],
  );
  const out = accepted(checkProfileImage(dirty, "avatar", "image/jpeg"));
  assert.equal(out.bytes.includes(Buffer.from("GPS-SECRET")), false);
  assert.equal(out.bytes.includes(Buffer.from("private comment")), false);
  assert.equal(out.bytes.includes(Buffer.from("<script>")), false);
  assert.ok(out.bytes.includes(Buffer.from("JFIF\0", "latin1")));
  assert.deepEqual(out.bytes.subarray(-2), JPEG_EOI);
  const again = accepted(checkProfileImage(out.bytes, "avatar", "image/jpeg"));
  assert.deepEqual(again.bytes, out.bytes);
});

test("a progressive JPEG with several scans is kept whole", () => {
  const sof2 = frameHeader(0xc2, 512, 512);
  const scan1 = Buffer.from([0x11, 0x22, 0xff, 0x00]);
  const scan2 = Buffer.from([0x33, 0xff, 0xd1, 0x44]);
  const data = Buffer.concat([JPEG_SOI, sof2, JPEG_DHT, JPEG_SOS, scan1, JPEG_DHT, JPEG_SOS, scan2, JPEG_EOI]);
  const out = accepted(checkProfileImage(data, "avatar", "image/jpeg"));
  assert.deepEqual(out.bytes, data);
});

test("damaged JPEGs (no end marker, cut short) are refused", () => {
  rejected(checkProfileImage(Buffer.concat([JPEG_SOI, frameHeader(0xc0, 512, 512), JPEG_SOS, JPEG_ENTROPY]), "avatar", "image/jpeg"), 400);
  rejected(checkProfileImage(Buffer.concat([JPEG_SOI, JPEG_JFIF, JPEG_DQT.subarray(0, 10)]), "avatar", "image/jpeg"), 400);
});

test("arithmetic-coded and 12-bit JPEGs are refused as unsupported", () => {
  const arithmetic = Buffer.concat([JPEG_SOI, frameHeader(0xc9, 512, 512), JPEG_SOS, JPEG_ENTROPY, JPEG_EOI]);
  rejected(checkProfileImage(arithmetic, "avatar", "image/jpeg"), 415);
  const twelveBit = Buffer.concat([JPEG_SOI, frameHeader(0xc0, 512, 512, 12), JPEG_SOS, JPEG_ENTROPY, JPEG_EOI]);
  rejected(checkProfileImage(twelveBit, "avatar", "image/jpeg"), 415);
});

// ---- WebP -----------------------------------------------------------------------

function webpChunk(fourcc: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(fourcc, 0, "latin1");
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat(data.length & 1 ? [header, data, Buffer.alloc(1)] : [header, data]);
}

function webpFile(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from("WEBP", "latin1"), ...chunks]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function vp8Keyframe(width: number, height: number) {
  const data = Buffer.alloc(10);
  data[0] = 0x10; // key frame, shown
  data[3] = 0x9d;
  data[4] = 0x01;
  data[5] = 0x2a;
  data.writeUInt16LE(width, 6);
  data.writeUInt16LE(height, 8);
  return data;
}

function vp8lHeader(width: number, height: number) {
  const data = Buffer.alloc(5);
  data[0] = 0x2f;
  data.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 1);
  return data;
}

function vp8xData(flags: number, width: number, height: number) {
  const data = Buffer.alloc(10);
  data[0] = flags;
  data.writeUIntLE(width - 1, 4, 3);
  data.writeUIntLE(height - 1, 7, 3);
  return data;
}

const WEBP_ICC = 0x20;
const WEBP_ALPHA = 0x10;
const WEBP_EXIF = 0x08;
const WEBP_XMP = 0x04;
const WEBP_ANIMATION = 0x02;

test("WebP keeps colour data and drops EXIF and XMP, clearing their flags", () => {
  const file = webpFile(
    webpChunk("VP8X", vp8xData(WEBP_ICC | WEBP_ALPHA | WEBP_EXIF | WEBP_XMP, 1500, 500)),
    webpChunk("ICCP", Buffer.from("icc-profile-bytes")),
    webpChunk("VP8 ", vp8Keyframe(1500, 500)),
    webpChunk("EXIF", Buffer.from("GPS-SECRET")),
    webpChunk("XMP ", Buffer.from("<x:xmpmeta>secret</x:xmpmeta>")),
  );
  const out = accepted(checkProfileImage(file, "banner", "image/webp"));
  assert.equal(out.format, "webp");
  assert.equal([out.width, out.height].join("x"), "1500x500");
  assert.equal(out.bytes.includes(Buffer.from("GPS-SECRET")), false);
  assert.equal(out.bytes.includes(Buffer.from("xmpmeta")), false);
  assert.ok(out.bytes.includes(Buffer.from("ICCP")));
  assert.equal(out.bytes.readUInt32LE(4) + 8, out.bytes.length, "RIFF size must match the cleaned file");
  const vp8xAt = out.bytes.indexOf(Buffer.from("VP8X"));
  assert.equal(out.bytes[vp8xAt + 8], WEBP_ICC | WEBP_ALPHA);
  const again = accepted(checkProfileImage(out.bytes, "banner", "image/webp"));
  assert.deepEqual(again.bytes, out.bytes);
});

test("lossless WebP is measured from its header", () => {
  const out = accepted(checkProfileImage(webpFile(webpChunk("VP8L", vp8lHeader(800, 600))), "avatar", "image/webp"));
  assert.equal([out.width, out.height].join("x"), "800x600");
});

test("animated WebP is refused", () => {
  const animatedFlag = webpFile(webpChunk("VP8X", vp8xData(WEBP_ANIMATION, 512, 512)), webpChunk("ANIM", Buffer.alloc(6)), webpChunk("ANMF", Buffer.alloc(16)));
  rejected(checkProfileImage(animatedFlag, "avatar", "image/webp"), 415);
  const animatedChunks = webpFile(webpChunk("ANIM", Buffer.alloc(6)), webpChunk("VP8 ", vp8Keyframe(512, 512)));
  rejected(checkProfileImage(animatedChunks, "avatar", "image/webp"), 415);
});

test("WebP without a picture is damaged", () => {
  rejected(checkProfileImage(webpFile(webpChunk("EXIF", Buffer.from("x"))), "avatar", "image/webp"), 400);
});
