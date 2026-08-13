import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  PALETTES,
  PALETTE_STORAGE_KEY,
  DEFAULT_PALETTE,
  isPaletteId,
  normalizePalette,
  applyPalette,
  readStoredPalette,
  persistPalette,
  type DatasetTarget,
  type StorageLike,
  type PaletteId,
} from "../src/lib/palette";

// ---- test doubles ------------------------------------------------------

function makeDataset(): DatasetTarget {
  return { dataset: {} };
}

function makeStorage(seed: Record<string, string> = {}): StorageLike & {
  store: Record<string, string>;
} {
  const store: Record<string, string> = { ...seed };
  return {
    store,
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = v;
    },
  };
}

// ---- 1. palette attribute application logic ----------------------------

describe("applyPalette (attribute application)", () => {
  it("writes a valid palette id onto dataset.palette", () => {
    const el = makeDataset();
    const result = applyPalette(el, "ocean");
    expect(el.dataset.palette).toBe("ocean");
    expect(result).toBe("ocean");
  });

  it("falls back to default for an unknown palette", () => {
    const el = makeDataset();
    const result = applyPalette(el, "not-a-real-palette");
    expect(el.dataset.palette).toBe(DEFAULT_PALETTE);
    expect(result).toBe(DEFAULT_PALETTE);
  });

  it("normalizes non-string input to default", () => {
    expect(normalizePalette(undefined)).toBe(DEFAULT_PALETTE);
    expect(normalizePalette(null)).toBe(DEFAULT_PALETTE);
    expect(normalizePalette(42)).toBe(DEFAULT_PALETTE);
  });

  it("isPaletteId recognises every catalogued palette", () => {
    for (const p of PALETTES) {
      expect(isPaletteId(p.id)).toBe(true);
    }
    expect(isPaletteId("bogus")).toBe(false);
  });
});

// ---- 2. persistence / restore round-trip -------------------------------

describe("persistence round-trip", () => {
  it("persists then restores the same palette", () => {
    const storage = makeStorage();
    persistPalette(storage, "sunset");
    expect(storage.store[PALETTE_STORAGE_KEY]).toBe("sunset");
    expect(readStoredPalette(storage)).toBe("sunset");
  });

  it("restores default when nothing is stored", () => {
    const storage = makeStorage();
    expect(readStoredPalette(storage)).toBe(DEFAULT_PALETTE);
  });

  it("restores default when a garbage value is stored", () => {
    const storage = makeStorage({ [PALETTE_STORAGE_KEY]: "💥" });
    expect(readStoredPalette(storage)).toBe(DEFAULT_PALETTE);
  });

  it("persist coerces invalid input to default before storing", () => {
    const storage = makeStorage();
    persistPalette(storage, "haxx");
    expect(storage.store[PALETTE_STORAGE_KEY]).toBe(DEFAULT_PALETTE);
  });

  it("swallows storage errors without throwing", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => persistPalette(throwing, "ocean")).not.toThrow();
    expect(readStoredPalette(throwing)).toBe(DEFAULT_PALETTE);
  });
});

// ---- 3. mode and palette compose independently -------------------------

describe("mode and palette compose independently", () => {
  it("changing palette never touches the mode class", () => {
    // Simulate <html class="dark"> as a plain object the palette logic can see.
    const el = makeDataset() as DatasetTarget & { classList: Set<string> };
    el.classList = new Set(["dark"]);
    applyPalette(el, "forest");
    // Palette applied…
    expect(el.dataset.palette).toBe("forest");
    // …and the dark mode marker is untouched.
    expect(el.classList.has("dark")).toBe(true);
  });

  it("selectors in theme.css scope dark overrides via .dark[data-palette]", () => {
    const css = readThemeCss();
    for (const p of PALETTES) {
      expect(css).toContain(`[data-palette="${p.id}"]`);
      expect(css).toContain(`.dark[data-palette="${p.id}"]`);
    }
  });
});

// ---- 4. assertion-based contrast over every palette --------------------

function readThemeCss(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "../src/styles/theme.css"), "utf8");
}

/** Parse an `--token: H S% L%;` declaration out of a given selector block. */
function readToken(block: string, token: string): [number, number, number] {
  const re = new RegExp(
    `--${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`
  );
  const m = block.match(re);
  if (!m) throw new Error(`token --${token} not found in block`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Extract the body of a CSS rule for an exact selector. */
function ruleBlock(css: string, selector: string): string {
  const idx = css.indexOf(selector + " {");
  if (idx === -1) throw new Error(`selector ${selector} not found`);
  const start = css.indexOf("{", idx);
  const end = css.indexOf("}", start);
  return css.slice(start + 1, end);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const L1 = relLuminance(hslToRgb(...a));
  const L2 = relLuminance(hslToRgb(...b));
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

describe("WCAG AA contrast — every palette primary/primary-foreground pair", () => {
  const css = readThemeCss();

  for (const p of PALETTES) {
    it(`light: ${p.id} primary vs primary-foreground >= 4.5:1`, () => {
      const block = ruleBlock(css, `[data-palette="${p.id}"]`);
      const prim = readToken(block, "primary");
      const fg = readToken(block, "primary-foreground");
      expect(contrast(prim, fg)).toBeGreaterThanOrEqual(4.5);
    });

    it(`dark: ${p.id} primary vs primary-foreground >= 4.5:1`, () => {
      const block = ruleBlock(css, `.dark[data-palette="${p.id}"]`);
      const prim = readToken(block, "primary");
      const fg = readToken(block, "primary-foreground");
      expect(contrast(prim, fg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("WCAG AA contrast — primary text on primary tint (every palette)", () => {
  const css = readThemeCss();

  // The app renders primary-coloured text/icons on a primary-tinted surface in
  // several places (dashboard quick actions & stat cards, order status chips,
  // cart modifier chips, reports rank badges). The token-level contract is:
  //   text = --primary-800, surface = --primary-100 (base), --primary-200 (hover)
  // Because each palette redefines the whole 50..950 ramp and the .dark blocks
  // invert it, asserting the pair per palette per mode guards every surface at
  // once and cannot silently regress when a palette hue is retuned.
  for (const p of PALETTES) {
    it(`light: ${p.id} primary-800 text on primary-100 tint >= 4.5:1`, () => {
      const block = ruleBlock(css, `[data-palette="${p.id}"]`);
      expect(
        contrast(readToken(block, "primary-800"), readToken(block, "primary-100"))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`light: ${p.id} primary-800 text on primary-200 hover tint >= 4.5:1`, () => {
      const block = ruleBlock(css, `[data-palette="${p.id}"]`);
      expect(
        contrast(readToken(block, "primary-800"), readToken(block, "primary-200"))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`dark: ${p.id} primary-800 text on primary-100 tint >= 4.5:1`, () => {
      const block = ruleBlock(css, `.dark[data-palette="${p.id}"]`);
      expect(
        contrast(readToken(block, "primary-800"), readToken(block, "primary-100"))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`dark: ${p.id} primary-800 text on primary-200 hover tint >= 4.5:1`, () => {
      const block = ruleBlock(css, `.dark[data-palette="${p.id}"]`);
      expect(
        contrast(readToken(block, "primary-800"), readToken(block, "primary-200"))
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("WCAG AA contrast — repaired base tokens", () => {
  const css = readThemeCss();
  const rootBlock = ruleBlock(css, ":root");
  const darkBlock = ruleBlock(css, ".dark");

  it("light destructive text clears 4.5:1 on white background", () => {
    const dest = readToken(rootBlock, "destructive");
    const bg = readToken(rootBlock, "background");
    expect(contrast(dest, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("light muted-foreground clears 4.5:1 on muted background", () => {
    const mf = readToken(rootBlock, "muted-foreground");
    const muted = readToken(rootBlock, "muted");
    expect(contrast(mf, muted)).toBeGreaterThanOrEqual(4.5);
  });

  it("dark destructive text clears 4.5:1 on dark background", () => {
    const dest = readToken(darkBlock, "destructive");
    const bg = readToken(darkBlock, "background");
    expect(contrast(dest, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("dark destructive button pair (fg on destructive) clears 4.5:1", () => {
    const dest = readToken(darkBlock, "destructive");
    const fg = readToken(darkBlock, "destructive-foreground");
    expect(contrast(dest, fg)).toBeGreaterThanOrEqual(4.5);
  });

  it("dark muted-foreground clears 4.5:1 on muted background", () => {
    const mf = readToken(darkBlock, "muted-foreground");
    const muted = readToken(darkBlock, "muted");
    expect(contrast(mf, muted)).toBeGreaterThanOrEqual(4.5);
  });
});

// ---- 5. PALETTES catalogue integrity -----------------------------------

describe("PALETTES catalogue", () => {
  it("has 8 palettes including an explicit default", () => {
    expect(PALETTES).toHaveLength(8);
    expect(PALETTES.map((p) => p.id)).toContain(DEFAULT_PALETTE);
  });

  it("every entry has a hex swatch and a label", () => {
    for (const p of PALETTES) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.swatch).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("swatch matches the light-mode --primary defined for that palette", () => {
    const css = readThemeCss();
    for (const p of PALETTES) {
      const block = ruleBlock(css, `[data-palette="${p.id}"]`);
      const prim = readToken(block, "primary");
      const swatchHsl = hexToHslApprox(p.swatch);
      // Compare via rendered RGB (round-trip hex->hsl is lossy), allow small delta.
      const a = hslToRgb(...prim);
      const b = hslToRgb(...swatchHsl);
      const dist = Math.max(
        Math.abs(a[0] - b[0]),
        Math.abs(a[1] - b[1]),
        Math.abs(a[2] - b[2])
      );
      expect(dist).toBeLessThanOrEqual(4);
    }
  });
});

function hexToHslApprox(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

// keep the PaletteId type referenced so the test doubles above type-check
const _typecheck: PaletteId = DEFAULT_PALETTE;
void _typecheck;
