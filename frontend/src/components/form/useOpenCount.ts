import { useState } from 'react';

/**
 * A number that goes up each time `open` turns true. Used as the `key` of a form,
 * so every opening starts with fresh values (and closing keeps the content while
 * the drawer slides out).
 */
export function useOpenCount(open: boolean): number {
  const [count, setCount] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCount((c) => c + 1);
  }
  return count;
}
