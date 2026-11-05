export type MotifId = "tocapu" | "inti" | "personas" | "chakana" | "llamas" | "montanas" | "condor" | "rombo" | "greca" | "sombreros" | "lagartija";

export const DEFAULT_MOTIF: MotifId = "tocapu";

const GRIDS: Record<Exclude<MotifId, "tocapu">, string[]> = {
  inti: [
    ".......X.......",
    ".X.....X.....X.",
    "..X..XXXXX..X..",
    "...XXXXXXXXX...",
    "...XX..X..XX...",
    "..XXX..X..XXX..",
    "XXXXXXXXXXXXXXX",
    "..XXXXXXXXXXX..",
    "..XXX.....XXX..",
    "...XXXXXXXXX...",
    "..X..XXXXX..X..",
    ".X.....X.....X.",
    ".......X.......",
  ],
  personas: ["....XX....", "....XX....", "..XXXXXX..", "XX.XXXX.XX", "...XXXX...", "...XXXX...", "..XXXXXX..", ".XXXXXXXX.", "...X..X...", "...X..X..."],
  chakana: ["....XXX....", "....XXX....", "..XXXXXXX..", "..XXXXXXX..", "XXXX...XXXX", "XXXX...XXXX", "XXXX...XXXX", "..XXXXXXX..", "..XXXXXXX..", "....XXX....", "....XXX...."],
  llamas: [".........X.X", ".........XXX", ".........XX.", ".........XX.", ".........XX.", ".XXXXXXXXXX.", "XXX.....XXX.", "XXX.....XXX.", ".XXXXXXXXX..", ".X.X....X.X.", ".X.X....X.X.", ".X.X....X.X."],
  montanas: [".......XX.......", "......X..X......", ".....XXXXXX.....", "....XXXXXXXX....", "...XXXXXXXXXX...", "..XXXXXXXXXXXX..", ".XXXXXXXXXXXXXX.", "XXXXXXXXXXXXXXXX"],
  condor: ["........X........", ".......XXX.......", "X......X.X......X", "XX....XXXXX....XX", "XXXX.XXXXXXX.XXXX", ".XXXXXXXXXXXXXXX.", "...XXXXXXXXXXX...", ".......XXX.......", "......X...X......"],
  rombo: ["......X......", ".....XXX.....", "....XX.XX....", "...XX.X.XX...", "..XX.XXX.XX..", ".XX.XX.XX.XX.", "XX.XX.X.XX.XX", ".XX.XX.XX.XX.", "..XX.XXX.XX..", "...XX.X.XX...", "....XX.XX....", ".....XXX.....", "......X......"],
  greca: ["XXXXXXXXX..", "........X..", ".XXXXXX.X..", ".X....X.X..", ".X.XX.X.X..", ".X.X..X.X..", ".X.XXXX.X..", ".X......X..", ".XXXXXXXX.."],
  sombreros: ["....XXXX....", "...XXXXXX...", "...XXXXXX...", "...X....X...", "XXXXXXXXXXXX", ".XXXXXXXXXX."],
  lagartija: ["..X.....X..", "...X...X...", "....XXX....", "...XXXXX...", "....X.X....", "....XXX....", "...XXXXX...", "..X.XXX.X..", "....XXX....", ".....X.....", ".....X....."],
};

const CELL = 4;
const GAP = 3;

function gridRects(grid: string[], offsetX: number, offsetY: number): string {
  return grid
    .flatMap((line, y) => [...line].map((char, x) => (char === "X" ? `<rect x='${offsetX + x * CELL}' y='${offsetY + y * CELL}' width='${CELL}' height='${CELL}'/>` : "")))
    .join("");
}

export interface MotifTile {
  image: string;
  size: string;
}

export function motifTile(id: MotifId): MotifTile | null {
  if (id === "tocapu") return null;
  const grid = GRIDS[id];
  const width = (grid[0].length + GAP) * CELL;
  const height = (grid.length + GAP) * CELL;
  const rects = gridRects(grid, 0, 0) + gridRects(grid, width / 2, height) + gridRects(grid, -width / 2, height);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height * 2}' viewBox='0 0 ${width} ${height * 2}'>${rects}</svg>`;
  return { image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, size: `${width}px ${height * 2}px` };
}
