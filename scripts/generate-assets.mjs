// Generates the placeholder tileset (PNG) and the office map (Tiled .tmj).
// Replace either file with hand-made art/maps from Tiled at any time; the client only
// needs the layer names "floor" and "objects" and the `collides` tile property.
// Keep COLS/ROWS/TILE in sync with shared/src/index.ts (client/src/test/map.spec.ts checks it).
import { writeFileSync } from "node:fs";
import zlib from "node:zlib";

const TILE = 32;
const COLS = 40;
const ROWS = 30;
const OUT = new URL("../client/src/assets/maps/", import.meta.url);

// ---- tileset: floor, rug, wall, desk ----
const FLOOR = 1,
  RUG = 2,
  WALL = 3,
  DESK = 4; // gids (firstgid = 1)
const tiles = [
  { base: [42, 47, 58], accent: [48, 54, 66], style: "checker" },
  { base: [59, 63, 107], accent: [74, 79, 130], style: "border" },
  { base: [86, 96, 116], accent: [112, 124, 146], style: "top" },
  { base: [139, 94, 60], accent: [102, 68, 42], style: "edge" },
];

function pixel(t, x, y) {
  const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
  switch (t.style) {
    case "checker":
      return ((x >> 4) + (y >> 4)) & 1 ? t.accent : t.base;
    case "border":
      return edge ? t.accent : t.base;
    case "top":
      return y < 6 ? t.accent : t.base;
    default:
      return edge ? t.accent : t.base;
  }
}

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const imgW = TILE * tiles.length;
const rgba = Buffer.alloc(imgW * TILE * 4);
tiles.forEach((t, i) => {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const [r, g, b] = pixel(t, x, y);
      rgba.set([r, g, b, 255], (y * imgW + i * TILE + x) * 4);
    }
  }
});
writeFileSync(new URL("tileset.png", OUT), png(imgW, TILE, rgba));

// ---- map ----
const floor = Array.from({ length: COLS * ROWS }, () => FLOOR);
const objects = Array.from({ length: COLS * ROWS }, () => 0);
const at = (x, y) => y * COLS + x;

for (let x = 0; x < COLS; x++) objects[at(x, 0)] = objects[at(x, ROWS - 1)] = WALL;
for (let y = 0; y < ROWS; y++) objects[at(0, y)] = objects[at(COLS - 1, y)] = WALL;
for (let y = 1; y < ROWS - 1; y++) if (y !== 14 && y !== 15) objects[at(20, y)] = WALL; // divider with a door
for (const y of [6, 10]) for (let x = 4; x <= 9; x++) objects[at(x, y)] = DESK; // desk rows
for (let y = 10; y <= 16; y++) for (let x = 24; x <= 33; x++) floor[at(x, y)] = RUG;
for (let y = 12; y <= 14; y++) for (let x = 26; x <= 31; x++) objects[at(x, y)] = DESK; // meeting table

const layer = (id, name, data) => ({
  id,
  name,
  type: "tilelayer",
  width: COLS,
  height: ROWS,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  data,
});
const collides = (id) => ({ id, properties: [{ name: "collides", type: "bool", value: true }] });

const map = {
  compressionlevel: -1,
  infinite: false,
  orientation: "orthogonal",
  renderorder: "right-down",
  type: "map",
  version: "1.10",
  tiledversion: "1.10.2",
  nextlayerid: 3,
  nextobjectid: 1,
  width: COLS,
  height: ROWS,
  tilewidth: TILE,
  tileheight: TILE,
  layers: [layer(1, "floor", floor), layer(2, "objects", objects)],
  tilesets: [
    {
      firstgid: 1,
      name: "tiles",
      image: "tileset.png",
      imagewidth: imgW,
      imageheight: TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: tiles.length,
      columns: tiles.length,
      margin: 0,
      spacing: 0,
      tiles: [collides(WALL - 1), collides(DESK - 1)],
    },
  ],
};
writeFileSync(new URL("office.tmj", OUT), JSON.stringify(map));
console.log("wrote tileset.png and office.tmj");
