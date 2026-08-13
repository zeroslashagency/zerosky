'use client';

import { useTheme } from './theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@zerosky/ui';
import { useEffect, useRef, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
      if (!items?.length) return;

      const currentIndex = Array.from(items).findIndex(
        (item) => item === document.activeElement
      );

      let nextIndex: number;
      if (e.key === 'ArrowDown') {
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }

      (items[nextIndex] as HTMLElement).focus();
    }
  };

  const selectTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Current theme: ${themeLabel}. Click to change theme.`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Icon className="h-5 w-5" />
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-40 bg-popover border border-border rounded-md shadow-lg py-1 z-50"
          onKeyDown={handleKeyDown}
        >
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset flex items-center gap-2"
            onClick={() => selectTheme('light')}
            tabIndex={0}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset flex items-center gap-2"
            onClick={() => selectTheme('dark')}
            tabIndex={0}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset flex items-center gap-2"
            onClick={() => selectTheme('system')}
            tabIndex={0}
          >
            <Monitor className="h-4 w-4" />
            System
          </button>
        </div>
      )}
    </div>
  );
}
