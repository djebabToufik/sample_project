import { useState } from 'react';

import { useAssets, useDowntime, type DateRange } from '../../../data/queries';
import { readStorage, useRememberedLine, writeStorage } from '../../../data/rememberedLine';

// Line + time window of the OEE, Downtimes and Energy dashboards, and the data for it.
// The choices are remembered in the browser under the keys the app always used.

const PERIOD_KEY = 'prefered_period';
const SCALE_KEY = 'prefered_scale';

export interface Preset {
  label: string;
  value: number;
  /** 'h' = hours back from now, 'd' = days back */
  scale: 'h' | 'd';
}

export const presets: Preset[] = [
  { label: 'Last hour', value: 1, scale: 'h' },
  { label: 'Last day', value: 24, scale: 'h' },
  { label: 'Last week', value: 7, scale: 'd' },
  { label: 'Last month', value: 30, scale: 'd' },
];

function storedPreset(): Preset {
  const value = Number(readStorage(PERIOD_KEY));
  const scale = readStorage(SCALE_KEY);
  return presets.find((p) => p.value === value && p.scale === scale) ?? presets[0];
}

/** A moment as ISO date with time zone (UTC), so the backend reads it right in any time zone. */
export function toBackendDate(date: Date): string {
  return date.toISOString();
}

/** From `preset` back from now, until one hour from now. */
function presetRange(preset: Preset): DateRange {
  const from = new Date();
  if (preset.scale === 'h') from.setHours(from.getHours() - preset.value);
  else from.setDate(from.getDate() - preset.value);
  const to = new Date();
  to.setHours(to.getHours() + 1);
  return { from: toBackendDate(from), to: toBackendDate(to) };
}

// The window last computed for a preset. Opening another dashboard shortly after
// reuses it, so the same filter is answered from the cache instead of loaded again.
let lastWindow: { preset: Preset; range: DateRange; at: number } | null = null;
const REUSE_MS = 60_000;

function windowFor(preset: Preset, fresh = false): DateRange {
  if (!fresh && lastWindow?.preset === preset && Date.now() - lastWindow.at < REUSE_MS) {
    return lastWindow.range;
  }
  const range = presetRange(preset);
  lastWindow = { preset, range, at: Date.now() };
  return range;
}

export function useLineFilter() {
  const assets = useAssets();
  const lines = assets.data ?? [];

  const [line, selectLine] = useRememberedLine(lines);

  /** null = a custom range is shown */
  const [preset, setPreset] = useState<Preset | null>(storedPreset);
  const [range, setRange] = useState<DateRange>(() => windowFor(storedPreset()));

  const downtime = useDowntime(line, range);

  const choosePreset = (next: Preset) => {
    writeStorage(PERIOD_KEY, String(next.value));
    writeStorage(SCALE_KEY, next.scale);
    setPreset(next);
    setRange(windowFor(next, true));
  };

  const applyRange = (custom: DateRange) => {
    setPreset(null);
    setRange(custom);
  };

  /** Reload: a preset moves its window up to now, a custom range stays as it is. */
  const refresh = () => {
    const next = preset ? windowFor(preset, true) : range;
    if (next.from === range.from && next.to === range.to) downtime.refetch();
    else setRange(next);
  };

  return {
    lines,
    line,
    selectLine,
    preset,
    choosePreset,
    range,
    applyRange,
    refresh,
    downtime,
    data: downtime.data,
    /** Lines loaded and there are none */
    noLines: assets.isSuccess && lines.length === 0,
    /** First load of the lines or of this filter */
    loading: assets.isPending || downtime.isLoading,
  };
}

export type LineFilterState = ReturnType<typeof useLineFilter>;
