'use client';

import { useRef } from 'react';
import { Check } from 'lucide-react';
import { useTheme, PALETTES } from './theme-provider';
import type { PaletteId } from './theme-provider';

/**
 * Premium, Apple-clean palette picker. Implemented as an ARIA radiogroup:
 * roving tabindex, arrow-key navigation, aria-checked state and a visible
 * focus ring. Selecting a swatch applies the palette instantly.
 */
export function PalettePicker() {
  const { palette, setPalette } = useTheme();
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusIndex = (index: number) => {
    const count = PALETTES.length;
    const next = ((index % count) + count) % count;
    const el = swatchRefs.current[next];
    if (el) {
      el.focus();
      setPalette(PALETTES[next].id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        focusIndex(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        focusIndex(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        focusIndex(PALETTES.length - 1);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        setPalette(PALETTES[index].id);
        break;
      default:
        break;
    }
  };

  const select = (id: PaletteId) => setPalette(id);

  return (
    <div
      role="radiogroup"
      aria-label="Colour palette"
      className="grid grid-cols-4 gap-3 sm:grid-cols-8"
    >
      {PALETTES.map((p, index) => {
        const checked = p.id === palette;
        return (
          <button
            key={p.id}
            ref={(el) => {
              swatchRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={p.label}
            tabIndex={checked ? 0 : -1}
            onClick={() => select(p.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="group flex flex-col items-center gap-1.5 rounded-xl p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <span
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 transition-transform duration-150 dark:ring-white/10',
                checked ? 'scale-100' : 'group-hover:scale-105',
              ].join(' ')}
              style={{ backgroundColor: p.swatch }}
            >
              {checked && (
                <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />
              )}
            </span>
            <span
              className={[
                'text-[11px] leading-none transition-colors',
                checked
                  ? 'font-semibold text-card-foreground'
                  : 'text-muted-foreground group-hover:text-card-foreground',
              ].join(' ')}
            >
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
