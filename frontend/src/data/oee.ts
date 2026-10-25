import type { DowntimeCount, DowntimeData, OeeSummary } from './types';

// Figures for the OEE, Downtimes and Energy dashboards, computed from /api/downtime/.
// The formulas are the ones the dashboards always used; a duration that cannot be computed
// (missing data) is shown as 0, an OEE ratio as null (no data: the line didn't produce).

/** Missing number -> NaN, so the result of a formula becomes 0 (see orZero / fixed2). */
const n = (value: number | undefined | null) => value ?? NaN;
const orZero = (value: number) => (Number.isNaN(value) ? 0 : value);

/** Two decimals ("12.30"), or 0 when the value cannot be computed. */
export const fixed2 = (value: number): string | number => (Number.isNaN(value) ? 0 : value.toFixed(2));

/** Hours as text: "45 second(s)", "3 minute(s) and 12 seconds", "2 hour(s) and 5 minutes", "1 day(s) and 3.0 hours". */
export function formatHours(hours: number): string {
  const minutes = hours * 60;
  if (minutes > 1 && minutes <= 60) {
    return `${Math.floor(minutes)} minute(s) and ${Math.trunc((minutes - Math.floor(minutes)) * 60)} seconds`;
  }
  if (minutes > 60 && minutes <= 1440) {
    return `${Math.floor(minutes / 60)} hour(s) and ${Math.floor(minutes % 60)} minutes`;
  }
  if (minutes > 1440) {
    const days = minutes / 1440;
    const hoursLeft = (days - Math.floor(days)) * 24;
    return `${Math.floor(days)} day(s) and ${Math.trunc(hoursLeft).toFixed(1)} hours`;
  }
  return `${Math.trunc(minutes * 60)} second(s)`;
}

/** A ratio (0-1) in whole percent, or null (no data). */
const percent = (value: number | null | undefined) => (value == null ? null : Math.trunc(value * 100));

/** Availability, performance and quality in whole percent, and the OEE (percent, unrounded); null = no data. */
export function oeeRatios(data: DowntimeData | undefined) {
  const s = data?.oee_selected_period;
  return {
    availability: percent(s?.availability),
    performance: percent(s?.performance),
    quality: percent(s?.quality),
    oee: s?.oee ?? null,
  };
}

/** Durations in hours. */
export function oeeDurations(data: DowntimeData | undefined) {
  const s = data?.oee_selected_period;
  const outOfOrder = n(s?.out_of_order_duration);
  const failure = n(s?.machine_failure_duration);
  const fault = n(s?.machine_fault_duration);
  return {
    on: orZero(n(s?.machine_on_duration)),
    run: orZero(n(s?.machine_run_duration)),
    breaks: orZero(n(s?.machine_break_in_duration) + n(s?.machine_break_out_duration)),
    allFaults: orZero(outOfOrder + failure + fault),
    outOfOrder: orZero(outOfOrder),
    failure: orZero(failure),
    fault: orZero(fault),
  };
}

/** Selected period minus the last 24 hours, per figure (two decimals); null when either has no data. */
/**
 * Change of each figure against the last 24 hours, in percentage points rounded to 0.1
 * (null = no data). The backend sends availability, performance and quality as ratios (0-1)
 * and the OEE in percent (0-100): all four are compared on the same percent scale.
 */
export function oeeComparison(data: DowntimeData | undefined) {
  const selected = data?.oee_selected_period;
  const last24h = data?.oee_last_24h;
  const delta = (key: keyof OeeSummary, toPercent: number) => {
    const value = selected?.[key];
    const reference = last24h?.[key];
    if (value == null || reference == null) return null;
    return Math.round((value - reference) * toPercent * 10) / 10;
  };
  return {
    availability: delta('availability', 100),
    performance: delta('performance', 100),
    quality: delta('quality', 100),
    oee: delta('oee', 1),
  };
}

/**
 * Split of the line's energy (kW) or cost ($) over the period. `perHour` gives the
 * line's rate while running and while only switched on.
 */
function split(data: DowntimeData | undefined, perHour: { running?: number; on?: number }) {
  const s = data?.oee_selected_period;
  const running = n(perHour.running);
  const on = n(perHour.on);

  const fault = running * n(s?.machine_fault_duration);
  const failure = on * n(s?.machine_failure_duration);
  const faulty = fault + failure;
  const run = running * n(s?.machine_run_duration) - fault;
  const onOnly = on * (n(s?.machine_on_duration) - n(s?.machine_run_duration)) - failure;
  const total = onOnly + run + faulty;
  return { faulty, run, on: onOnly, total };
}

export function energySplit(data: DowntimeData | undefined) {
  const machine = data?.machine;
  const energy = split(data, {
    running: machine?.running_hour_consumption_kw,
    on: machine?.on_hour_consumption_kw,
  });
  // Shares are taken of the rounded total, as the dashboard always did.
  const roundedTotal = Number(energy.total.toFixed(2));
  const share = (part: number) => Number(fixed2((part / roundedTotal) * 100));
  return {
    total: fixed2(energy.total),
    on: fixed2(energy.on),
    run: fixed2(energy.run),
    faulty: fixed2(energy.faulty),
    /** Percent of the total spent on net production */
    efficiency: share(energy.run),
    onShare: share(energy.on),
    faultyShare: share(energy.faulty),
  };
}

export function costSplit(data: DowntimeData | undefined) {
  const machine = data?.machine;
  const costs = split(data, { running: machine?.running_hour_cost, on: machine?.on_hour_cost });
  return {
    total: fixed2(costs.total),
    on: fixed2(costs.on),
    run: fixed2(costs.run),
    faulty: fixed2(costs.faulty),
  };
}

/** Number of downtimes per fault type and per cell (counted by the backend). */
export function downtimeCounts(data: DowntimeData | undefined) {
  const toBars = (items: DowntimeCount[] | undefined) =>
    (items ?? []).map((item) => ({ label: item.name, count: item.count }));
  return { perFault: toBars(data?.downtime_per_fault), perCell: toBars(data?.downtime_per_cell) };
}
