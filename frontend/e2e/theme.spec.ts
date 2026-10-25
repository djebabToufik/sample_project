import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

// Checks the source code against the theme. The theme is loaded in the browser
// through the dev server, exactly as the app loads it.
// Every `palette.x.y` / 'x.y' color key used in the app must exist in the theme,
// otherwise an OEM theme change would silently fall back to no color.

const GROUPS = 'primary|success|error|warning|info|secondary|chart';

function colorKeysUsedInApp(): string[] {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(new RegExp(`palette\\.((?:${GROUPS})\\.\\w+)`, 'g'))) keys.add(m[1]);
        for (const m of src.matchAll(new RegExp(`(?<!from )'((?:${GROUPS})\\.\\w+)'`, 'g'))) keys.add(m[1]);
      }
    }
  };
  walk(path.join(import.meta.dirname, '..', 'src', 'AppMain'));
  return [...keys];
}

// @dev-only: reads source files, which a production build does not serve.
test('all color keys used by the app exist in the theme @dev-only', async ({ page }) => {
  const keys = colorKeysUsedInApp();
  expect(keys.length).toBeGreaterThan(5);

  await page.goto('/');
  const palette: Record<string, Record<string, unknown>> = await page.evaluate(async () => {
    const themeModule = '/src/branding/theme.ts';
    const { default: theme } = await import(/* @vite-ignore */ themeModule);
    return JSON.parse(JSON.stringify(theme.palette));
  });
  const missing = keys.filter((key) => {
    const [group, shade] = key.split('.');
    return typeof palette[group]?.[shade] !== 'string';
  });
  expect(missing).toEqual([]);
});
