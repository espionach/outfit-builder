// Data model from BUILD_SPEC.md §5.1

export type ID = string;

export interface Category {
  id: ID;
  name: string;
  order: number;
  createdAt: number;
}

export interface Piece {
  id: ID;
  name?: string;
  categoryId: ID;
  image: Blob; // downscaled original (long edge ≤ 1200px)
  thumb: Blob; // ~256px for wardrobe tiles
  width: number; // natural size of `image`
  height: number;
  createdAt: number;
  deletedAt?: number;
}

export interface Folder {
  id: ID;
  name: string;
  color: string;
  order: number;
  createdAt: number;
}

export interface PlacedPiece {
  pieceId: ID;
  // fractions of the canvas size (0–1)
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export interface Outfit {
  id: ID;
  name: string;
  folderId: ID | null;
  layout: PlacedPiece[];
  snapshot: Blob;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Draft {
  id: 'current';
  layout: PlacedPiece[];
  updatedAt: number;
}

export interface AllData {
  categories: Category[];
  pieces: Piece[];
  folders: Folder[];
  outfits: Outfit[];
  draft: Draft | null;
}
