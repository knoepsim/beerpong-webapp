// The raster files of the logo (run after make-logo.py, see `pnpm brand`): the PNG sizes of the icons in public/brand,
// and what Next.js picks up by convention in app/: icon.svg (favicon), favicon.ico (16/32/48), apple-icon.png.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const web = path.resolve(import.meta.dirname, "../..");
const brand = path.join(web, "public/brand");
const app = path.join(web, "app");

const png = (file, size) => sharp(path.join(brand, file), { density: 300 }).resize(size, size).png().toBuffer();

/** An .ico with PNG images inside (what every browser reads): header, one directory entry per image, the images. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

await (async () => {
  const sizes = [
    ["icon.svg", "icon-512.png", 512],
    ["icon.svg", "icon-192.png", 192],
    ["icon-maskable.svg", "icon-maskable-512.png", 512],
    ["icon-maskable.svg", "icon-maskable-192.png", 192],
    ["icon-maskable.svg", "apple-touch-icon.png", 180],
    ["favicon.svg", "favicon-48.png", 48],
    ["favicon.svg", "favicon-32.png", 32],
    ["favicon.svg", "favicon-16.png", 16],
  ];
  await Promise.all(sizes.map(async ([src, dst, size]) => fs.writeFileSync(path.join(brand, dst), await png(src, size))));

  fs.copyFileSync(path.join(brand, "favicon.svg"), path.join(app, "icon.svg"));
  fs.copyFileSync(path.join(brand, "apple-touch-icon.png"), path.join(app, "apple-icon.png"));
  const icons = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png("favicon.svg", size) })));
  fs.writeFileSync(path.join(app, "favicon.ico"), ico(icons));
  console.log("brand: icons written");
})();
