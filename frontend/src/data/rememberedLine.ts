import { useState } from 'react';

import type { Asset } from './types';

// The line a user last worked with, remembered in the browser. Shared by the OEE
// dashboards, the Live cards and the operator view ('asset_uuid' is the key the app
// always used, so existing choices are kept).

const LINE_KEY = 'asset_uuid';

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the choice is just not remembered.
  }
}

/** Remember `uuid` as the current line (e.g. before opening a line's dashboard). */
export const rememberLine = (uuid: string) => writeStorage(LINE_KEY, uuid);

/**
 * The remembered line among `lines` (the first one when none is remembered or it
 * no longer exists), and a setter that remembers the choice.
 */
export function useRememberedLine(lines: Asset[]) {
  const [stored, setStored] = useState(() => readStorage(LINE_KEY));
  const line = lines.find((a) => a.uuid === stored)?.uuid ?? lines[0]?.uuid;
  const selectLine = (uuid: string) => {
    rememberLine(uuid);
    setStored(uuid);
  };
  return [line, selectLine] as const;
}
