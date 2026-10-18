// node scripts/brand-images.cjs [preview|build]  (logo source: brand-inbox/nexus-forge-emblem.png or LOGO_SRC)
// Builds the Nexus Forge Gaming brand images from the emblem artwork.
const sharp = require("sharp");
const fs = require("fs");
const pngToIcoMod = require(require.resolve("png-to-ico", { paths: [__dirname, __dirname + "/../apps/desktop"] }));
const pngToIco = pngToIcoMod.default ?? pngToIcoMod;

const repo = require("path").resolve(__dirname, "..");
const src = process.env.LOGO_SRC || `${repo}/brand-inbox/nexus-forge-emblem.png`;
const brand = `${repo}/apps/web/public/brand/`;
const NAVY = { r: 4, g: 8, b: 18, alpha: 1 };
const mode = process.argv[2] || "preview";

async function mark(size) {
  // The N emblem only (above the "NEXUS" lettering), centred on a square navy tile,
  // with a soft round fade so no lettering edges show at the bottom corners.
  const box = { left: 395, top: 0, width: 750, height: 590 };
  const emblem = await sharp(src).extract(box).png().toBuffer();
  const side = 760;
  const tile = await sharp({ create: { width: side, height: side, channels: 4, background: NAVY } })
    .composite([{ input: emblem, left: Math.round((side - box.width) / 2), top: Math.round((side - box.height) / 2) + 20 }])
    .png()
    .toBuffer();
  const fade = Buffer.from(
    `<svg width="${side}" height="${side}"><defs><radialGradient id="g" cx="50%" cy="47%" r="50%">` +
      `<stop offset="80%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  const faded = await sharp(tile).composite([{ input: fade, blend: "dest-in" }]).png().toBuffer();
  // Put the faded emblem back on navy so the icon is a solid square (looks right everywhere).
  const solid = await sharp({ create: { width: side, height: side, channels: 4, background: NAVY } })
    .composite([{ input: faded }])
    .png()
    .toBuffer();
  return sharp(solid).resize(size, size).png().toBuffer();
}

(async () => {
  if (mode === "preview") {
    fs.writeFileSync(`${repo}/brand-inbox/try-mark.png`, await mark(512));
    console.log("preview written");
    return;
  }
  // Full logo (home page, sign-in, download page, emails, social previews).
  await sharp(src).resize(1200).png({ compressionLevel: 9 }).toFile(brand + "nexusforge-logo-full.png");
  await sharp(src).resize(600).png({ compressionLevel: 9 }).toFile(brand + "nexusforge-logo-600.png");
  // Square emblem (header, browser tab, app icon).
  const big = await mark(512);
  fs.writeFileSync(brand + "nexusforge-emblem.png", big);
  fs.writeFileSync(brand + "nexusforge-emblem-256.png", await sharp(big).resize(256).png().toBuffer());
  fs.writeFileSync(`${repo}/apps/web/src/app/apple-icon.png`, await sharp(big).resize(180).png().toBuffer());
  const sizes = [16, 32, 48, 256];
  const pngs = await Promise.all(sizes.map((s) => sharp(big).resize(s, s).png().toBuffer()));
  fs.writeFileSync(`${repo}/apps/web/src/app/favicon.ico`, await pngToIco(pngs.slice(0, 3)));
  fs.writeFileSync(`${repo}/apps/desktop/assets/app-icon.ico`, await pngToIco(pngs));
  // Social share card (1200x630): the full logo centred on navy.
  const logo = await sharp(src).resize({ height: 560 }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: NAVY } })
    .composite([{ input: logo, left: Math.round((1200 - meta.width) / 2), top: 35 }])
    .png({ compressionLevel: 9 })
    .toFile(`${repo}/apps/web/src/app/opengraph-image.png`);
  console.log("brand images written");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
