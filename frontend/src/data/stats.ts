import type { Asset, MaintenancePlan } from './types';

// Numbers shown on the CMMS dashboards, computed once from the loaded lists.

/** Whole percent of `part` in `total` (0 when there is nothing to count). */
export const percent = (part: number, total: number) => (total ? Math.trunc((part / total) * 100) : 0);

/** Missing amounts (null / '') count as 0; the API sends decimals as strings. */
const amount = (value: string | null | undefined) => Number(value) || 0;

export function assetStats(assets: Asset[]) {
  const now = Date.now();
  const count = (status: Asset['status']) => assets.filter((a) => a.status === status).length;

  const active = count('Active');
  const underMaintenance = count('Under Maintenance');
  const inactive = count('Inactive');
  const retired = count('Retired');
  // An asset without an end date counts as out of warranty.
  const outOfWarranty = assets.filter(
    (a) => a.status !== 'Retired' && new Date(a.warranty_expiration_date ?? 0).getTime() < now,
  ).length;
  const inUse = active + underMaintenance;
  const purchaseValue = assets.reduce((sum, a) => sum + amount(a.cost), 0);
  const currentValue = assets.reduce((sum, a) => sum + amount(a.current_value), 0);

  return {
    total: assets.length,
    active,
    underMaintenance,
    inactive,
    retired,
    outOfWarranty,
    inUse,
    purchaseValue,
    currentValue,
    depreciation: purchaseValue - currentValue,
  };
}

export function maintenanceStats(maintenances: MaintenancePlan[]) {
  const count = (status: MaintenancePlan['status']) => maintenances.filter((m) => m.status === status).length;
  return {
    total: maintenances.length,
    pending: count('Pending'),
    inProgress: count('In Progress'),
    completed: count('Completed'),
    cancelled: count('Cancelled'),
  };
}
