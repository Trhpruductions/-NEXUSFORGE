/**
 * Video-call grid sizing: how many columns, and how wide each 16:9 tile, so that every tile fits in the room's area
 * (width and height) as large as possible. Below a readable minimum the tiles keep that size and the area scrolls.
 */
export type GridFit = { columns: number; tileWidth: number };

export function fitGrid(count: number, width: number, height: number, options: { gap?: number; aspect?: number; minTile?: number; maxTile?: number } = {}): GridFit {
  const { gap = 12, aspect = 16 / 9, minTile = 200, maxTile = 1280 } = options;
  if (count <= 0 || width <= 0 || height <= 0) return { columns: 1, tileWidth: 0 };
  const fits: GridFit[] = [];
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const byWidth = (width - gap * (columns - 1)) / columns;
    const byHeight = ((height - gap * (rows - 1)) / rows) * aspect;
    fits.push({ columns, tileWidth: Math.floor(Math.min(byWidth, byHeight, maxTile)) });
  }
  const biggest = Math.max(...fits.map((fit) => fit.tileWidth));
  // Screens are wide: when side by side is nearly as big (within 10%), use more columns rather than stacking.
  const best = [...fits].reverse().find((fit) => fit.tileWidth >= biggest * 0.9) ?? fits[0];
  if (best.tileWidth >= minTile) return best;
  // Too many people for the space: keep tiles readable and let the area scroll.
  const tileWidth = Math.min(Math.floor(width), minTile);
  const columns = Math.max(1, Math.min(count, Math.floor((width + gap) / (tileWidth + gap))));
  return { columns, tileWidth };
}
