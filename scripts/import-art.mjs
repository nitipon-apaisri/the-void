// Copies the sheets we use out of the licensed LimeZu "Modern Interiors" pack into
// client/src/assets/game/ and writes the maps (Tiled .tmj) that use them: one per space template
// and size.
//
// The pack is not redistributable, so neither the pack nor game/ is committed: everyone who
// builds the game needs their own copy (https://limezu.itch.io/moderninteriors). Put it at
// client/src/assets/art/limezu/moderninteriors-win, or pass another folder:
//   npm run assets:import -- /path/to/moderninteriors-win
//
// The map layouts are ours and are committed (maps/<template>.tmj for medium, maps/<template>-<size>.tmj
// for the others); only pictures come from the pack.
// The map is written only when it is missing or you pass --map, so edits made in Tiled survive
// a re-import. Tilesets keep their names (floors, walls, generic, conference).
// Keep TILE and SIZES in sync with shared/src/index.ts (SPACE_SIZE_DIMENSIONS, mapName).
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
const SIZES = {
  small: { cols: 60, rows: 45 },
  medium: { cols: 90, rows: 67 },
  large: { cols: 130, rows: 96 },
};
// Medium keeps the plain template name, so the maps that existed before sizes did stay valid.
const mapName = (template, size) => (size === "medium" ? template : `${template}-${size}`);

const root = new URL("../client/src/assets/", import.meta.url);
const args = process.argv.slice(2);
const writeMap = args.includes("--map");
// --out <dir> writes the maps there instead, to compare a layout change with what is committed.
const outFlag = args.indexOf("--out");
const mapsDir =
  outFlag === -1 ? new URL("maps/", root) : new URL(`${path.resolve(args[outFlag + 1])}/`, "file:");
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
const pack = path.resolve(
  positional[0] ?? new URL("art/limezu/moderninteriors-win", root).pathname,
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

// Plans below get the map size and the drawing helpers. Positions are in tiles; every plan keeps
// the middle of the map walkable enough for findSpawn (shared) to find a spot near it.
const range = (n) => Array.from({ length: n }, (_, i) => i);

// Office: a grid of rooms (about 30 x 20 tiles each) with a doorway between neighbours. Medium is
// the 3 x 3 grid it started as; small is 2 x 2 and large 4 x 4, so a room stays the same size.
//   desks | desks   | meeting rooms
//   lounge| plaza   | desks
//   cafeteria | event lounge | desks
const OFFICE_KINDS = {
  small: [
    ["desks", "meeting"],
    ["lounge", "desks"],
  ],
  medium: [
    ["desks", "desks", "meeting"],
    ["lounge", "plaza", "desks"],
    ["cafeteria", "events", "desks"],
  ],
  large: [
    ["desks", "desks", "meeting", "lounge"],
    ["lounge", "plaza", "desks", "desks"],
    ["cafeteria", "events", "desks", "meeting"],
    ["desks", "desks", "lounge", "plaza"],
  ],
};
// Wood floors in the rooms people gather in, grey carpet elsewhere.
const WOOD_ROOMS = new Set(["meeting", "lounge", "cafeteria", "events"]);

// What goes in one room, placed from its top left tile (x0, y0); the room is w x h tiles.
const officeRooms = {
  desks: ({ desks, x0, y0, w, h }) =>
    desks(
      range(Math.floor((w - 2) / 5)).map((k) => x0 + 2 + 5 * k),
      range(Math.floor((h - 1) / 6)).map((k) => y0 + 2 + 6 * k),
    ),
  meeting: ({ meeting, lounge, plant, x0, y0, w, h }) => {
    meeting(x0 + 3, y0 + 4);
    meeting(x0 + 15, y0 + 4);
    lounge(x0 + 3, y0 + 13);
    for (const [x, y] of [
      [x0 + 1, y0 + 1],
      [x0 + w - 2, y0 + 1],
      [x0 + 1, y0 + h - 2],
      [x0 + w - 2, y0 + h - 2],
    ])
      plant(x, y);
  },
  lounge: ({ lounge, x0, y0 }) => {
    for (const dy of [2, 11]) for (const dx of [1, 17]) lounge(x0 + dx, y0 + dy);
  },
  plaza: ({ meeting, plant, x0, y0 }) => {
    for (const dy of [2, 12]) for (const dx of [2, 22]) meeting(x0 + dx, y0 + dy, false);
    for (const dy of [3, 15]) for (const dx of [9, 19]) plant(x0 + dx, y0 + dy);
  },
  cafeteria: ({ meeting, x0, y0 }) => {
    for (const dy of [2, 11]) for (const dx of [2, 17]) meeting(x0 + dx, y0 + dy, false);
  },
  events: ({ lounge, x0, y0 }) => {
    for (const dy of [2, 11]) for (const dx of [2, 16]) lounge(x0 + dx, y0 + dy);
  },
};

const officePlan = (ctx) => {
  const { size, cols, rows, carpet, hwall, vwall } = ctx;
  const kinds = OFFICE_KINDS[size];
  const nr = kinds.length;
  const nc = kinds[0].length;
  // Walls sit on these columns and rows (the horizontal ones are two tiles tall).
  const wallX = (i) => Math.floor((i * cols) / nc);
  const wallY = (i) => Math.floor((i * rows) / nr);
  const rooms = kinds.map((row, r) =>
    row.map((kind, c) => {
      const x0 = c === 0 ? 1 : wallX(c) + 1;
      const x1 = c === nc - 1 ? cols - 2 : wallX(c + 1) - 1;
      const y0 = r === 0 ? 2 : wallY(r) + 2;
      const y1 = r === nr - 1 ? rows - 3 : wallY(r + 1) - 1;
      return { kind, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }),
  );

  carpet("floors", 1, 5, 1, 2, cols - 2, rows - 3);
  for (const room of rooms.flat())
    if (WOOD_ROOMS.has(room.kind)) carpet("floors", 1, 13, room.x0, room.y0, room.x1, room.y1);

  hwall(0, cols - 1, 0);
  hwall(0, cols - 1, rows - 2);
  vwall(0, 2, rows - 3);
  vwall(cols - 1, 2, rows - 3);
  // Doorways: 4 wide through the horizontal walls and 3 tall through the vertical ones, each in
  // the middle of the room it opens into.
  for (const r of range(nr - 1)) {
    let start = 0;
    for (const room of rooms[0]) {
      const middle = Math.ceil((room.x0 + room.x1) / 2);
      hwall(start, middle - 3, wallY(r + 1));
      start = middle + 2;
    }
    hwall(start, cols - 1, wallY(r + 1));
  }
  for (const c of range(nc - 1)) {
    for (const [first] of rooms) {
      const middle = Math.floor((first.y0 + first.y1) / 2);
      vwall(wallX(c + 1), first.y0, middle - 2);
      vwall(wallX(c + 1), middle + 2, first.y1);
    }
  }

  for (const room of rooms.flat()) officeRooms[room.kind]({ ...ctx, ...room });
};

// Open plan: one big light room with tidy desk blocks, glass-free meeting rooms and a lounge.
// How much of each fits depends on the size: meeting rooms across the top right, desk rows,
// then lounges and meeting tables below, in columns and rows.
const OPEN_PLAN = {
  small: { meetings: 1, deskRows: 2, loungeCols: 1, loungeRows: 2, tableCols: 2 },
  medium: { meetings: 2, deskRows: 4, loungeCols: 2, loungeRows: 2, tableCols: 2 },
  large: { meetings: 3, deskRows: 6, loungeCols: 3, loungeRows: 4, tableCols: 3 },
};
const openPlan = ({ size, cols, rows, W, carpet, hwall, vwall, desks, meeting, lounge, plant }) => {
  const cfg = OPEN_PLAN[size];
  W.row = 2;
  // The meeting rooms fill a block on the right from the top wall down to row 21.
  const zone = cols - (12 * cfg.meetings + 5);
  const lowerY = 5 + 7 * cfg.deskRows + 1;
  carpet("floors", 5, 31, 1, 2, cols - 2, rows - 3);
  carpet("floors", 5, 3, zone + 1, 2, cols - 2, 20);
  carpet("floors", 5, 3, 1, lowerY, zone - 2, rows - 3);
  hwall(0, cols - 1, 0);
  hwall(0, cols - 1, rows - 2);
  vwall(0, 2, rows - 3);
  vwall(cols - 1, 2, rows - 3);
  // One doorway into the open floor between each pair of rooms (under the room when there is one).
  vwall(zone, 2, 9);
  vwall(zone, 13, 20);
  let start = zone;
  for (const gap of cfg.meetings === 1 ? [4] : range(cfg.meetings - 1).map((j) => 12 * (j + 1))) {
    hwall(start, zone + gap - 1, 21);
    start = zone + gap + 4;
  }
  hwall(start, cols - 1, 21);
  for (const k of range(cfg.meetings)) meeting(zone + 3 + 12 * k, 8);

  // Desk blocks, with an aisle through the middle of the left side.
  const ys = range(cfg.deskRows).map((k) => 5 + 7 * k);
  const xs = [];
  for (let x = 4; x <= zone - 7; x += 6) xs.push(x);
  const middle = Math.round(zone * 0.56);
  const aisle = xs.reduce((best, x) => (Math.abs(x - middle) < Math.abs(best - middle) ? x : best));
  desks(
    xs.filter((x) => x < aisle),
    ys,
  );
  desks(
    xs.filter((x) => x > aisle),
    ys,
  );
  const rightXs = [];
  for (let x = zone + 3; x <= cols - 8; x += 6) rightXs.push(x);
  desks(
    rightXs,
    range(cfg.deskRows - 1).map((k) => 30 + 7 * k),
  );

  for (const j of range(cfg.loungeRows))
    for (const k of range(cfg.loungeCols)) lounge(3 + 13 * k, lowerY + 4 + 10 * j);
  const tableRows = Math.floor((rows - 3 - (lowerY + 6) - 6) / 12) + 1;
  for (const j of range(tableRows))
    for (const k of range(cfg.tableCols))
      meeting(zone - 9 - 12 * (cfg.tableCols - 1 - k), lowerY + 6 + 12 * j, false);
  for (const [x, y] of [
    [2, 3],
    [aisle + 3, 3],
    [zone - 2, 3],
    [aisle + 3, lowerY - 1],
    [zone - 2, lowerY - 1],
    [2, rows - 5],
    [aisle + 3, rows - 5],
    [zone - 2, rows - 5],
    [cols - 3, rows - 5],
    [cols - 3, 26],
  ])
    plant(x, y);
};

// Empty: a bare hall with nothing in it, for owners who want to decorate everything themselves.
const emptyPlan = ({ cols, rows, W, carpet, hwall, vwall }) => {
  W.row = 2;
  carpet("floors", 5, 31, 1, 2, cols - 2, rows - 3);
  hwall(0, cols - 1, 0);
  hwall(0, cols - 1, rows - 2);
  vwall(0, 2, rows - 3);
  vwall(cols - 1, 2, rows - 3);
};

// Studio: a small team's office in the middle of the map (50 x 39 tiles at medium). The rest is
// solid. The room grows with the map: more desks and lounges, never a different shape.
const STUDIO_ROOMS = { small: [40, 31], medium: [50, 39], large: [70, 53] };
const studioPlan = ({
  size,
  cols,
  rows,
  W,
  carpet,
  hwall,
  vwall,
  desks,
  meeting,
  lounge,
  plant,
  fillOutside,
}) => {
  const [rw, rh] = STUDIO_ROOMS[size];
  const rx = Math.floor((cols - rw) / 2);
  const ry = Math.floor((rows - rh) / 2);
  W.row = 2;
  carpet("floors", 5, 3, rx + 1, ry + 2, rx + rw - 2, ry + rh - 3);
  hwall(rx, rx + rw - 1, ry);
  hwall(rx, rx + rw - 1, ry + rh - 2);
  vwall(rx, ry + 2, ry + rh - 3);
  vwall(rx + rw - 1, ry + 2, ry + rh - 3);
  fillOutside(rx, ry, rx + rw - 1, ry + rh - 1);
  // Desk blocks either side of a gap down the middle, then lounges and a meeting table below.
  const perSide = Math.floor((rw - 14) / 12);
  const deskRows = Math.min(4, Math.floor((rh - 23) / 7));
  const ys = range(deskRows).map((k) => ry + 4 + 7 * k);
  desks(
    range(perSide).map((k) => rx + 4 + 6 * k),
    ys,
  );
  desks(
    range(perSide).map((k) => rx + rw - 6 - 6 * (perSide - 1 - k)),
    ys,
  );
  const lower = ry + 10 + 7 * deskRows;
  meeting(rx + rw - 18, lower);
  lounge(rx + 4, lower);
  if (rw >= 50) lounge(rx + 16, lower + 6);
  const centre = rx + Math.floor(rw / 2) + 2;
  for (const [x, y] of [
    [rx + 2, ry + 2],
    [rx + rw - 3, ry + 2],
    [rx + 2, ry + rh - 4],
    [rx + rw - 3, ry + rh - 4],
    [centre, ry + 3],
    [centre, ry + rh - 4],
  ])
    plant(x, y);
};

const build = (plan, size) => {
  const { cols: COLS, rows: ROWS } = SIZES[size];
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

  // Every desk is a claimable table (see TABLES_LAYER in @void/shared). The rectangle includes
  // the chair, so you claim it from where you sit.
  const tables = [];
  // Places you can sit (the SEATS_LAYER in @void/shared): a point in pixels and the way you face.
  // A desk chair is drawn by the client, lifted so it tucks under the desk, so it has no tiles.
  const seats = [];
  const SEAT_LIFT = 28;
  const stampDesk = (x, y) => {
    tables.push({ x: x * TILE, y: y * TILE, width: 4 * TILE, height: 5 * TILE });
    stamp(objects, "generic", 0, 5, 4, 3, x, y);
    block(x + 1, y, 2, 3);
    seats.push({
      x: (x + 1) * TILE + TILE / 2,
      y: (y + 3) * TILE + TILE - SEAT_LIFT,
      facing: "up",
      art: "desk-chair",
    });
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
        // Far-side chairs face up, so they show their back.
        if (cy === y) stamp(objects, "conference", 11, 6, 1, 1, cx, cy);
        else stamp(objects, "conference", 12, 7, 1, 1, cx, cy);
        block(cx, cy);
        // Chairs on the near side of the table face down towards it, the far side face up.
        seats.push({
          x: cx * TILE + TILE / 2,
          y: cy * TILE + TILE / 2 + 4,
          facing: cy === y ? "down" : "up",
        });
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

  const api = {
    size,
    cols: COLS,
    rows: ROWS,
    W,
    carpet,
    hwall,
    vwall,
    desks,
    meeting,
    lounge,
    plant,
    tall,
  };
  api.fillOutside = (x0, y0, x1, y1) => {
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (x < x0 || x > x1 || y < y0 || y > y1) collision[at(x, y)] = 1;
  };
  plan(api);
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
    nextlayerid: 8,
    nextobjectid: tables.length + seats.length + 1,
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
      {
        id: 6,
        name: "tables",
        type: "objectgroup",
        draworder: "topdown",
        opacity: 1,
        visible: false,
        x: 0,
        y: 0,
        objects: tables.map((t, i) => ({
          id: i + 1,
          name: `Desk ${i + 1}`,
          type: "table",
          rotation: 0,
          visible: true,
          ...t,
        })),
      },
      {
        id: 7,
        name: "seats",
        type: "objectgroup",
        draworder: "topdown",
        opacity: 1,
        visible: false,
        x: 0,
        y: 0,
        objects: seats.map((s, i) => ({
          id: tables.length + i + 1,
          name: `Seat ${i + 1}`,
          type: "seat",
          rotation: 0,
          visible: true,
          width: 0,
          height: 0,
          x: s.x,
          y: s.y,
          properties: [
            { name: "facing", type: "string", value: s.facing },
            ...(s.art ? [{ name: "art", type: "string", value: s.art }] : []),
          ],
        })),
      },
    ],
    tilesets,
  };
  return map;
};

// Each template and size is one map file; medium keeps the plain template name.
const PLANS = { office: officePlan, "open-plan": openPlan, studio: studioPlan, empty: emptyPlan };
const written = [];
for (const [id, plan] of Object.entries(PLANS)) {
  for (const size of Object.keys(SIZES)) {
    const name = mapName(id, size);
    const mapFile = new URL(`${name}.tmj`, mapsDir);
    if (!writeMap && existsSync(mapFile)) continue;
    writeFileSync(mapFile, JSON.stringify(build(plan, size)));
    written.push(name);
  }
}
console.log(
  `copied ${Object.keys(SHEETS).length} sheets and the character parts; ` +
    (written.length
      ? `wrote ${written.join(", ")}`
      : "kept the maps (pass --map to regenerate them)"),
);
