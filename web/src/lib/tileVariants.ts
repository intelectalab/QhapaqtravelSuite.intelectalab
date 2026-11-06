export const TILE_VARIANTS = ["stacked", "side", "inline", "watermark", "stripe", "bento-split", "bento", "bento-stack"] as const;

export type TileVariant = (typeof TILE_VARIANTS)[number];

export const isTileVariant = (value: unknown): value is TileVariant => typeof value === "string" && (TILE_VARIANTS as readonly string[]).includes(value);
