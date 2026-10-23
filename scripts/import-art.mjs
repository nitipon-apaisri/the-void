// Copies the sheets we use out of the licensed LimeZu "Modern Interiors" pack into
// client/src/assets/game/ and writes the office map (Tiled .tmj) that uses them.
//
// The pack is not redistributable, so neither the pack nor game/ is committed: everyone who
// builds the game needs their own copy (https://limezu.itch.io/moderninteriors). Put it at
// client/src/assets/art/limezu/moderninteriors-win, or pass another folder:
//   npm run assets:import -- /path/to/moderninteriors-win
//
// The map layout is ours and is committed (maps/office.tmj); only pictures come from the pack.
// The map is written only when it is missing or you pass --map, so edits made in Tiled survive
// a re-import. Tilesets keep their names (floors, walls, generic, conference).
// Keep COLS/ROWS/TILE in sync with shared/src/index.ts.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const TILE = 32;
const COLS = 90;
const ROWS = 67;

const root = new URL("../client/src/assets/", import.meta.url);
const args = process.argv.slice(2);
const writeMap = args.includes("--map");
const pack = path.resolve(
  args.find((a) => !a.startsWith("--")) ?? new URL("art/limezu/moderninteriors-win", root).pathname,
);
const outDir = new URL("game/", root).pathname;

if (!existsSync(path.join(pack, "LICENSE.txt"))) {
  console.error(`Art pack not found at ${pack}\nDownload Modern Interiors and pass its folder.`);
  process.exit(1);
}

const interiors = path.join(pack, "1_Interiors/32x32");
const SHEETS = {
  floors: path.join(interiors, "Room_Bulder_subfiles_32x32/Room_Builder_Floors_32x32.png"),
  walls: path.join(interiors, "Room_Bulder_subfiles_32x32/Room_Builder_Walls_32x32.png"),
  generic: path.join(interiors, "Theme_Sorter_32x32/1_Generic_32x32.png"),
  conference: path.join(interiors, "Theme_Sorter_32x32/13_Conference_Hall_32x32.png"),
};
// Layered character parts, in drawing order. Folder, file prefix, and the matching key in
// LOOK_COUNTS (shared/src/index.ts).
const GENERATOR = path.join(pack, "2_Characters/Character_Generator");
const LOOK_FOLDERS = {
  body: "Bodies",
  eyes: "Eyes",
  outfit: "Outfits",
  hair: "Hairstyles",
  accessory: "Accessories",
};

// PNG width and height live at fixed offsets in the IHDR chunk.
const size = (file) => {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

// ---- sheets and tilesets ----
const tilesets = [];
let nextGid = 1;
const sheet = {};
for (const [name, file] of Object.entries(SHEETS)) {
  copyFileSync(file, path.join(outDir, `${name}.png`));
  const { w, h } = size(file);
  const columns = w / TILE;
  const count = columns * (h / TILE);
  sheet[name] = { firstgid: nextGid, columns };
  tilesets.push({
    firstgid: nextGid,
    name,
    image: `${name}.png`,
    imagewidth: w,
    imageheight: h,
    tilewidth: TILE,
    tileheight: TILE,
    tilecount: count,
    columns,
    margin: 0,
    spacing: 0,
  });
  nextGid += count;
}

// ---- character parts ----
// A part's index is its place in the sorted file list, so the same pack always gives the same
// numbers. The manifest tells the client how files group into styles and colours:
// "Outfit_03_32x32_02.png" is style 3, colour 2; parts without a style number are style 1.
const looksDir = path.join(outDir, "looks");
rmSync(looksDir, { recursive: true, force: true });
const manifest = {};
for (const [part, folder] of Object.entries(LOOK_FOLDERS)) {
  const dir = path.join(GENERATOR, folder, "32x32");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort((x, y) => x.localeCompare(y));
  mkdirSync(path.join(looksDir, part), { recursive: true });
  manifest[part] = files.map((file, i) => {
    copyFileSync(
      path.join(dir, file),
      path.join(looksDir, part, `${String(i).padStart(3, "0")}.png`),
    );
    const match = /^[A-Za-z]+_(?:(\d+)_)?(?:([A-Za-z_]+?)_)?32x32_(\d+)\.png$/.exec(file);
    return {
      style: match?.[1] ? Number(match[1]) : 1,
      name: (match?.[2] ?? "").replaceAll("_", " "),
      variant: match ? Number(match[3]) : i + 1,
    };
  });
}
writeFileSync(path.join(looksDir, "manifest.json"), JSON.stringify(manifest));

// The server validates against the counts in shared; flag a pack that disagrees with them.
const shared = readFileSync(new URL("../shared/src/index.ts", import.meta.url), "utf8");
for (const [part, list] of Object.entries(manifest)) {
  const declared = Number(new RegExp(`\\b${part}: (\\d+),`).exec(shared)?.[1]);
  if (declared !== list.length) {
    console.warn(
      `LOOK_COUNTS.${part} is ${declared} but the pack has ${list.length}; update shared/src/index.ts`,
    );
  }
}

// ---- map ----
const blank = () => Array.from({ length: COLS * ROWS }, () => 0);
const floor = blank();
const decor = blank();
const objects = blank();
// Drawn over players, for the tops of tall things people can walk behind.
const above = blank();
// Never drawn. Any tile here blocks movement, so what you see and what you bump into can differ
// (the art is not tile-aligned: a table can be 2.4 tiles wide inside a 4 tile stamp).
const collision = blank();
const at = (x, y) => y * COLS + x;
const gid = (name, col, row) => sheet[name].firstgid + row * sheet[name].columns + col;

const put = (layer, name, col, row, x, y) => {
  if (x >= 0 && y >= 0 && x < COLS && y < ROWS) layer[at(x, y)] = gid(name, col, row);
};
// Copies a w x h block of a sheet to the map, top-left at (x, y).
const stamp = (layer, name, col, row, w, h, x, y) => {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) put(layer, name, col + dx, row + dy, x + dx, y + dy);
};
const block = (x, y, w = 1, h = 1) => {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) collision[at(x + dx, y + dy)] = 1;
};
// Something taller than its footprint: only the bottom `solid` rows block and sit under
// players; the rows above it are drawn over them, so you can walk behind it.
const tall = (name, col, row, w, h, x, y, solid = 1) => {
  stamp(above, name, col, row, w, h - solid, x, y);
  stamp(objects, name, col, row + h - solid, w, solid, x, y + h - solid);
  block(x, y + h - solid, w, solid);
};
// The middle tile of a floor pattern is plain, so it repeats without visible seams.
const carpet = (name, col, row, x0, y0, x1, y1) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(floor, name, col, row, x, y);
};

// Wall style: grey (rows 4-5 of the wall sheet). Horizontal walls are two tiles tall.
const W = { row: 4 };
const hwall = (x0, x1, y) => {
  for (let x = x0; x <= x1; x++) {
    const col = x === x0 ? 0 : x === x1 ? 3 : 1 + (x % 2);
    put(objects, "walls", col, W.row, x, y);
    put(objects, "walls", col, W.row + 1, x, y + 1);
    block(x, y, 1, 2);
  }
};
const vwall = (x, y0, y1) => {
  for (let y = y0; y <= y1; y++) {
    put(objects, "walls", 5, W.row + 1, x, y);
    block(x, y);
  }
};

// ---- the floor plan ----
// A 3 x 3 grid of rooms (about 30 x 20 tiles each) with doorways between them:
//   open office | open office | meeting rooms
//   lounge      | plaza       | open office
//   cafeteria   | event lounge| open office
// Walls sit on x = 30 and 60 and on rows 22-23 and 44-45; the gaps in them are the doors.

const stampDesk = (x, y) => {
  stamp(objects, "generic", 0, 5, 4, 3, x, y);
  block(x + 1, y, 2, 3);
  stamp(objects, "generic", 2, 11, 1, 2, x + 1, y + 3);
  block(x + 1, y + 3);
};
// A sofa, table, TV and sideboard; 11 wide and 5 tall.
const lounge = (x, y) => {
  stamp(decor, "generic", 9, 4, 4, 3, x, y);
  stamp(objects, "generic", 6, 11, 3, 2, x + 1, y + 3);
  block(x + 1, y + 3, 3, 1);
  tall("generic", 6, 0, 1, 3, x + 6, y);
  tall("generic", 0, 11, 2, 2, x + 9, y + 2);
};
// A table with six chairs; 5 wide and 7 tall, plus a whiteboard 4 rows above when it has one.
const meeting = (x, y, board = true) => {
  stamp(objects, "conference", 0, 1, 5, 3, x, y + 2);
  block(x + 1, y + 2, 3, 3);
  for (const cy of [y, y + 6])
    for (const cx of [x, x + 2, x + 4]) {
      stamp(objects, "conference", 11, 6, 1, 1, cx, cy);
      block(cx, cy);
    }
  if (board) {
    stamp(objects, "conference", 10, 1, 2, 2, x + 2, y - 4);
    block(x + 2, y - 4, 2, 2);
  }
};
const plant = (x, y) => {
  stamp(objects, "conference", 13, 7, 1, 1, x, y);
  block(x, y);
};
const desks = (xs, ys) => ys.forEach((y) => xs.forEach((x) => stampDesk(x, y)));

// Floors: grey carpet everywhere, wood in the rooms people gather in.
carpet("floors", 1, 5, 1, 2, COLS - 2, ROWS - 3);
for (const [x0, y0, x1, y1] of [
  [61, 2, 88, 21], // meeting rooms
  [1, 24, 29, 43], // lounge
  [1, 46, 29, 64], // cafeteria
  [31, 46, 59, 64], // event lounge
])
  carpet("floors", 1, 13, x0, y0, x1, y1);

// Outer walls, then the dividers. Door gaps: columns 13-16, 43-46, 73-76 across the horizontal
// walls, rows 10-12, 32-34, 54-56 through the vertical ones.
hwall(0, COLS - 1, 0);
hwall(0, COLS - 1, ROWS - 2);
vwall(0, 2, ROWS - 3);
vwall(COLS - 1, 2, ROWS - 3);
for (const y of [22, 44])
  for (const [x0, x1] of [
    [0, 12],
    [17, 42],
    [47, 72],
    [77, COLS - 1],
  ])
    hwall(x0, x1, y);
for (const x of [30, 60])
  for (const [y0, y1] of [
    [2, 9],
    [13, 21],
    [24, 31],
    [35, 43],
    [46, 53],
    [57, 64],
  ])
    vwall(x, y0, y1);

// Top row
desks([3, 8, 13, 18, 23], [4, 10, 16]);
desks([33, 38, 43, 48, 53], [4, 10, 16]);
meeting(64, 6);
meeting(76, 6);
lounge(64, 15);
for (const [x, y] of [
  [62, 3],
  [87, 3],
  [62, 20],
  [87, 20],
])
  plant(x, y);

// Middle row
lounge(2, 26);
lounge(18, 26);
lounge(2, 35);
lounge(18, 35);
for (const [x, y] of [
  [33, 26],
  [53, 26],
  [33, 36],
  [53, 36],
])
  meeting(x, y, false);
for (const [x, y] of [
  [40, 27],
  [50, 27],
  [40, 39],
  [50, 39],
])
  plant(x, y);
desks([63, 68, 73, 78, 83], [26, 32, 38]);

// Bottom row
for (const [x, y] of [
  [3, 48],
  [18, 48],
  [3, 57],
  [18, 57],
])
  meeting(x, y, false);
for (const [x, y] of [
  [33, 48],
  [47, 48],
  [33, 57],
  [47, 57],
])
  lounge(x, y);
desks([63, 68, 73, 78, 83], [48, 54, 60]);

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

const map = {
  compressionlevel: -1,
  infinite: false,
  orientation: "orthogonal",
  renderorder: "right-down",
  type: "map",
  version: "1.10",
  tiledversion: "1.10.2",
  nextlayerid: 6,
  nextobjectid: 1,
  width: COLS,
  height: ROWS,
  tilewidth: TILE,
  tileheight: TILE,
  layers: [
    layer(1, "floor", floor),
    layer(2, "decor", decor),
    layer(3, "objects", objects),
    layer(5, "above", above),
    { ...layer(4, "collision", collision), visible: false },
  ],
  tilesets,
};
const mapFile = new URL("maps/office.tmj", root);
const mapWritten = writeMap || !existsSync(mapFile);
if (mapWritten) writeFileSync(mapFile, JSON.stringify(map));
console.log(
  `copied ${Object.keys(SHEETS).length} sheets and the character parts; ` +
    (mapWritten ? "wrote office.tmj" : "kept office.tmj (pass --map to regenerate it)"),
);
