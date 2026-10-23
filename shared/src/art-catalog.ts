import type { SheetName } from "./furniture.js";

// Pieces cut from the art sheets, grouped for the "Browse all art" section of the decorate panel.
// Rectangles were read off the sheets by eye (the asset browser shows how); an entry that looks
// off by a tile only needs its numbers changed here. `solid` is each group's default for
// "Blocks walking".

export interface ArtPiece {
  name: string;
  sheet: SheetName;
  sx: number;
  sy: number;
  w: number;
  h: number;
}

export interface ArtCategory {
  name: string;
  solid: boolean;
  /** Ready-made catalogue pieces (`FURNITURE` ids, with seats and walls set) that belong here. */
  items?: readonly string[];
  pieces: readonly ArtPiece[];
}

export const ART_CATALOG: readonly ArtCategory[] = [
  {
    name: "Tables",
    items: ["desk", "coffee-table", "meeting-table"],
    solid: true,
    pieces: [
      { name: "Table, dark", sheet: "generic", sx: 0, sy: 5, w: 4, h: 3 },
      { name: "Table, light", sheet: "generic", sx: 0, sy: 8, w: 4, h: 3 },
      { name: "Big table, light", sheet: "generic", sx: 0, sy: 37, w: 4, h: 3 },
      { name: "Big table, dark", sheet: "generic", sx: 5, sy: 37, w: 4, h: 3 },
      { name: "Counter strip", sheet: "generic", sx: 11, sy: 37, w: 4, h: 2 },
      { name: "Bench", sheet: "generic", sx: 5, sy: 6, w: 3, h: 2 },
      { name: "Bench, light", sheet: "generic", sx: 0, sy: 15, w: 2, h: 2 },
      { name: "Bench, dark", sheet: "generic", sx: 2, sy: 15, w: 2, h: 2 },
      { name: "Desk", sheet: "generic", sx: 1, sy: 52, w: 1, h: 2 },
      { name: "Desk, monitor", sheet: "generic", sx: 2, sy: 52, w: 1, h: 2 },
      { name: "Desk, monitor dark", sheet: "generic", sx: 5, sy: 52, w: 1, h: 2 },
      { name: "Desk, dark", sheet: "generic", sx: 4, sy: 52, w: 1, h: 2 },
    ],
  },
  {
    name: "Chairs",
    items: ["chair", "desk-chair"],
    solid: true,
    pieces: [
      { name: "Stool", sheet: "generic", sx: 5, sy: 5, w: 1, h: 1 },
      { name: "Stool, orange", sheet: "generic", sx: 0, sy: 17, w: 1, h: 2 },
      { name: "Stool, red", sheet: "generic", sx: 1, sy: 17, w: 1, h: 2 },
      { name: "Stool, beige", sheet: "generic", sx: 2, sy: 17, w: 1, h: 2 },
      { name: "Chair, red", sheet: "generic", sx: 9, sy: 50, w: 1, h: 2 },
      { name: "Chair, dark", sheet: "generic", sx: 10, sy: 50, w: 1, h: 2 },
      { name: "Chair, light", sheet: "generic", sx: 11, sy: 50, w: 1, h: 2 },
      { name: "Chair, side", sheet: "generic", sx: 9, sy: 52, w: 1, h: 2 },
      { name: "Chair, side dark", sheet: "generic", sx: 11, sy: 52, w: 1, h: 2 },
      { name: "Swivel, grey", sheet: "generic", sx: 4, sy: 63, w: 1, h: 1 },
      { name: "Swivel, brown", sheet: "generic", sx: 4, sy: 64, w: 1, h: 1 },
      { name: "Swivel, blue", sheet: "generic", sx: 4, sy: 65, w: 1, h: 1 },
      { name: "Swivel, green", sheet: "generic", sx: 7, sy: 65, w: 1, h: 1 },
      { name: "Sofa, beige", sheet: "generic", sx: 0, sy: 56, w: 2, h: 3 },
      { name: "Sofa, grey", sheet: "generic", sx: 2, sy: 56, w: 2, h: 3 },
      { name: "Sofa, blue", sheet: "generic", sx: 4, sy: 56, w: 2, h: 3 },
      { name: "Sofa, red", sheet: "generic", sx: 6, sy: 11, w: 3, h: 2 },
      { name: "Chair, brown", sheet: "conference", sx: 7, sy: 0, w: 1, h: 2 },
      { name: "Chair, black", sheet: "conference", sx: 8, sy: 0, w: 1, h: 2 },
    ],
  },
  {
    name: "Office",
    items: ["whiteboard"],
    solid: true,
    pieces: [
      { name: "Phone", sheet: "generic", sx: 10, sy: 39, w: 2, h: 2 },
      { name: "Phone, blue", sheet: "generic", sx: 12, sy: 39, w: 2, h: 2 },
      { name: "Phone, red", sheet: "generic", sx: 12, sy: 41, w: 2, h: 2 },
      { name: "Phone, white", sheet: "generic", sx: 10, sy: 41, w: 2, h: 2 },
      { name: "Vending machine", sheet: "conference", sx: 5, sy: 1, w: 2, h: 3 },
      { name: "Water cooler", sheet: "conference", sx: 14, sy: 7, w: 2, h: 3 },
      { name: "Fire extinguisher", sheet: "conference", sx: 13, sy: 7, w: 1, h: 2 },
      { name: "Black bag", sheet: "conference", sx: 14, sy: 0, w: 1, h: 2 },
      { name: "Lamp", sheet: "conference", sx: 7, sy: 2, w: 1, h: 2 },
    ],
  },
  {
    name: "Kitchen",
    solid: true,
    pieces: [
      { name: "Kitchen island", sheet: "generic", sx: 0, sy: 0, w: 3, h: 4 },
      { name: "Fridge", sheet: "generic", sx: 3, sy: 0, w: 1, h: 3 },
      { name: "Cabinet", sheet: "generic", sx: 4, sy: 1, w: 1, h: 2 },
      { name: "Monitor counter", sheet: "generic", sx: 6, sy: 0, w: 1, h: 3 },
      { name: "Reception desk", sheet: "generic", sx: 0, sy: 29, w: 9, h: 3 },
      { name: "Glass counter", sheet: "generic", sx: 4, sy: 54, w: 6, h: 2 },
    ],
  },
  {
    name: "Storage",
    items: ["bookshelf", "sideboard"],
    solid: true,
    pieces: [
      { name: "Drawers, orange", sheet: "generic", sx: 3, sy: 20, w: 1, h: 2 },
      { name: "Drawers, dark", sheet: "generic", sx: 4, sy: 20, w: 1, h: 2 },
      { name: "Drawers, beige", sheet: "generic", sx: 5, sy: 20, w: 1, h: 2 },
      { name: "Glass cabinet", sheet: "generic", sx: 0, sy: 21, w: 3, h: 2 },
      { name: "Wardrobe, grey", sheet: "generic", sx: 0, sy: 66, w: 3, h: 3 },
      { name: "Wardrobe narrow", sheet: "generic", sx: 3, sy: 66, w: 1, h: 3 },
      { name: "Wardrobe, brown", sheet: "generic", sx: 1, sy: 72, w: 3, h: 3 },
      { name: "Nightstand, orange", sheet: "generic", sx: 7, sy: 63, w: 1, h: 2 },
      { name: "Nightstand, grey", sheet: "generic", sx: 8, sy: 63, w: 1, h: 2 },
      { name: "Crate", sheet: "generic", sx: 7, sy: 3, w: 1, h: 1 },
      { name: "Crates", sheet: "generic", sx: 12, sy: 60, w: 2, h: 1 },
    ],
  },
  {
    name: "Bedroom",
    solid: true,
    pieces: [
      { name: "Large bed", sheet: "generic", sx: 12, sy: 0, w: 4, h: 4 },
      { name: "Four-poster bed", sheet: "generic", sx: 11, sy: 14, w: 4, h: 6 },
      { name: "Bed frame", sheet: "generic", sx: 4, sy: 15, w: 4, h: 3 },
      { name: "Bed", sheet: "generic", sx: 7, sy: 0, w: 4, h: 2 },
    ],
  },
  {
    name: "Bathroom",
    solid: true,
    pieces: [
      { name: "Toilet, teal", sheet: "generic", sx: 11, sy: 67, w: 1, h: 3 },
      { name: "Toilet, purple", sheet: "generic", sx: 12, sy: 67, w: 1, h: 3 },
      { name: "Toilet, white", sheet: "generic", sx: 13, sy: 67, w: 1, h: 3 },
      { name: "Vanity", sheet: "generic", sx: 11, sy: 72, w: 2, h: 3 },
      { name: "Plunger", sheet: "generic", sx: 13, sy: 70, w: 1, h: 2 },
    ],
  },
  {
    name: "Plants",
    items: ["plant"],
    solid: true,
    pieces: [
      { name: "Palm", sheet: "generic", sx: 13, sy: 25, w: 2, h: 3 },
      { name: "Potted tree", sheet: "generic", sx: 13, sy: 28, w: 2, h: 3 },
      { name: "Potted tree 2", sheet: "generic", sx: 15, sy: 28, w: 1, h: 3 },
      { name: "Small plant", sheet: "generic", sx: 6, sy: 57, w: 1, h: 2 },
      { name: "Plant", sheet: "generic", sx: 7, sy: 56, w: 1, h: 3 },
      { name: "Big plant", sheet: "generic", sx: 8, sy: 56, w: 2, h: 3 },
      { name: "Shrub", sheet: "generic", sx: 14, sy: 63, w: 1, h: 2 },
      { name: "Fern", sheet: "generic", sx: 15, sy: 63, w: 1, h: 3 },
    ],
  },
  {
    name: "Rugs",
    items: ["rug"],
    solid: false,
    pieces: [
      { name: "Red rug", sheet: "generic", sx: 9, sy: 4, w: 4, h: 3 },
      { name: "Blue rug", sheet: "generic", sx: 9, sy: 7, w: 4, h: 3 },
      { name: "Blue rug, tall", sheet: "generic", sx: 13, sy: 5, w: 3, h: 4 },
      { name: "Small rug, red", sheet: "generic", sx: 9, sy: 10, w: 2, h: 2 },
      { name: "Small rug, green", sheet: "generic", sx: 11, sy: 10, w: 2, h: 2 },
      { name: "Grey rug", sheet: "generic", sx: 8, sy: 13, w: 3, h: 2 },
      { name: "Blue mat", sheet: "generic", sx: 11, sy: 12, w: 2, h: 2 },
      { name: "Red carpet", sheet: "generic", sx: 3, sy: 22, w: 3, h: 2 },
      { name: "Green rug", sheet: "generic", sx: 6, sy: 24, w: 3, h: 2 },
      { name: "Blue rug 2", sheet: "generic", sx: 3, sy: 25, w: 3, h: 2 },
      { name: "Red rug 2", sheet: "generic", sx: 6, sy: 27, w: 3, h: 2 },
      { name: "Tatami", sheet: "generic", sx: 0, sy: 44, w: 3, h: 2 },
      { name: "Blue tatami", sheet: "generic", sx: 0, sy: 46, w: 3, h: 2 },
      { name: "Bath mat", sheet: "generic", sx: 8, sy: 67, w: 2, h: 2 },
      { name: "White rug", sheet: "conference", sx: 0, sy: 8, w: 5, h: 3 },
    ],
  },
  {
    name: "Wall",
    solid: false,
    pieces: [
      { name: "Landscape picture", sheet: "generic", sx: 0, sy: 13, w: 2, h: 2 },
      { name: "Sunset picture", sheet: "generic", sx: 2, sy: 13, w: 2, h: 2 },
      { name: "Seaside picture", sheet: "generic", sx: 4, sy: 13, w: 2, h: 2 },
      { name: "Window", sheet: "generic", sx: 6, sy: 43, w: 2, h: 2 },
      { name: "Window, light", sheet: "generic", sx: 8, sy: 43, w: 2, h: 2 },
      { name: "Window, dark", sheet: "generic", sx: 10, sy: 43, w: 2, h: 2 },
      { name: "Window, four panes", sheet: "generic", sx: 14, sy: 43, w: 2, h: 2 },
      { name: "Curtains, red", sheet: "generic", sx: 5, sy: 45, w: 3, h: 3 },
      { name: "Curtains, blue", sheet: "generic", sx: 8, sy: 45, w: 3, h: 3 },
      { name: "Curtains, beige", sheet: "generic", sx: 11, sy: 45, w: 3, h: 3 },
      { name: "Curtains, open", sheet: "generic", sx: 5, sy: 48, w: 3, h: 2 },
      { name: "Blackboard", sheet: "generic", sx: 3, sy: 44, w: 2, h: 2 },
      { name: "Wall mirror", sheet: "generic", sx: 11, sy: 29, w: 1, h: 2 },
      { name: "Wall window", sheet: "generic", sx: 9, sy: 29, w: 2, h: 2 },
      { name: "Mirror, oval", sheet: "generic", sx: 14, sy: 66, w: 1, h: 2 },
      { name: "Mirror", sheet: "generic", sx: 15, sy: 66, w: 1, h: 2 },
      { name: "Photo frame", sheet: "conference", sx: 14, sy: 2, w: 1, h: 2 },
      { name: "Photo frame 2", sheet: "conference", sx: 15, sy: 2, w: 1, h: 2 },
    ],
  },
  {
    name: "Doors",
    solid: false,
    pieces: [
      { name: "Door, light", sheet: "generic", sx: 0, sy: 40, w: 1, h: 2 },
      { name: "Door, orange", sheet: "generic", sx: 1, sy: 40, w: 1, h: 2 },
      { name: "Door, red", sheet: "generic", sx: 2, sy: 40, w: 1, h: 2 },
      { name: "Glass door", sheet: "generic", sx: 0, sy: 42, w: 1, h: 2 },
      { name: "Double door", sheet: "generic", sx: 3, sy: 40, w: 3, h: 2 },
      { name: "Glass double door", sheet: "generic", sx: 3, sy: 42, w: 3, h: 2 },
      { name: "Staircase", sheet: "generic", sx: 10, sy: 54, w: 3, h: 4 },
      { name: "Escalator", sheet: "generic", sx: 13, sy: 54, w: 3, h: 5 },
    ],
  },
];
