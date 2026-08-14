/**
 * Named-palette theme logic — framework-free so it can be unit tested and
 * shared between the pre-paint script, the React provider and the picker.
 *
 * A palette only changes colour identity (primary/accent ramps + ring). It is
 * applied via `document.documentElement.dataset.palette` and COMPOSES with the
 * light/dark mode (the `.dark` class), so the two axes are fully independent.
 */

export type PaletteId =
  | 'default'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'midnight'
  | 'emerald'
  | 'cherry'
  | 'slate';

export interface PaletteDef {
  /** Value written to `data-palette`. */
  id: PaletteId;
  /** Human label shown in the picker. */
  label: string;
  /** Primary colour as a hex string, for rendering the swatch. */
  swatch: string;
}

/**
 * The eight selectable palettes. `swatch` is the light-mode primary base
 * colour, matching the `--primary` token each palette defines in theme.css.
 */
export const PALETTES: PaletteDef[] = [
  { id: 'default', label: 'Default', swatch: '#2563eb' },
  { id: 'ocean', label: 'Ocean', swatch: '#0aa3c2' },
  { id: 'forest', label: 'Forest', swatch: '#1ba74e' },
  { id: 'sunset', label: 'Sunset', swatch: '#eb640a' },
  { id: 'midnight', label: 'Midnight', swatch: '#762cdd' },
  { id: 'emerald', label: 'Emerald', swatch: '#10b27c' },
  { id: 'cherry', label: 'Cherry', swatch: '#d31740' },
  { id: 'slate', label: 'Slate', swatch: '#49658d' },
];

export const PALETTE_STORAGE_KEY = 'zerosky-palette';
export const DEFAULT_PALETTE: PaletteId = 'ocean';

const VALID_IDS = new Set<string>(PALETTES.map((p) => p.id));

/** Type guard: is the value one of the known palette ids? */
export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && VALID_IDS.has(value);
}

/** Coerce any stored/user value to a valid palette, falling back to default. */
export function normalizePalette(value: unknown): PaletteId {
  return isPaletteId(value) ? value : DEFAULT_PALETTE;
}

/** Minimal shape of an element with a writable dataset (DOM or a test stub). */
export interface DatasetTarget {
  dataset: Record<string, string | undefined>;
}

/** Minimal shape of a Storage-like backing store (localStorage or a stub). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Apply a palette by writing `data-palette` onto the target element. Returns
 * the normalized id that was written. Never touches mode (the `.dark` class).
 */
export function applyPalette(target: DatasetTarget, palette: unknown): PaletteId {
  const id = normalizePalette(palette);
  target.dataset.palette = id;
  return id;
}

/** Read + validate the persisted palette, defaulting when absent/invalid. */
export function readStoredPalette(storage: StorageLike): PaletteId {
  try {
    return normalizePalette(storage.getItem(PALETTE_STORAGE_KEY));
  } catch {
    return DEFAULT_PALETTE;
  }
}

/** Persist a palette id (validated first). Swallows storage errors. */
export function persistPalette(storage: StorageLike, palette: unknown): PaletteId {
  const id = normalizePalette(palette);
  try {
    storage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    // Private mode or storage unavailable — palette still applies in-memory.
  }
  return id;
}
