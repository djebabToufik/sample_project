import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import api from '../api';
import { errorMessage } from './errors';
import type { Asset, Cell, DowntimeData, Fault, MaintenancePlan, Product, UserProfile } from './types';

// Data hooks for the backend lists. Each list has one cache key, so every page
// that shows it shares the data, and a change anywhere reloads it everywhere.

export const queryKeys = {
  assets: ['assets'],
  maintenances: ['maintenances'],
  myMaintenances: ['my-maintenances'],
  users: ['profile-users'],
  cells: ['cells'],
  faults: ['faults'],
  products: ['products'],
  downtime: ['downtime'],
} as const satisfies Record<string, QueryKey>;

function useList<T>(queryKey: QueryKey, path: string) {
  return useQuery({
    queryKey,
    queryFn: async () => (await api.get<T[]>(path)).data,
  });
}

export const useAssets = () => useList<Asset>(queryKeys.assets, '/api/assets/');
export const useMaintenances = () =>
  useList<MaintenancePlan>(queryKeys.maintenances, '/api/maintenance-plans/');
/** Plans assigned to the logged-in user (operator schedule). */
export const useMyMaintenances = () =>
  useList<MaintenancePlan>(queryKeys.myMaintenances, '/api/maintenance-plans/mine/');
export const useUsers = () => useList<UserProfile>(queryKeys.users, '/api/users/');
export const useCells = () => useList<Cell>(queryKeys.cells, '/api/cells/');
export const useFaults = () => useList<Fault>(queryKeys.faults, '/api/faults/');
export const useProducts = () => useList<Product>(queryKeys.products, '/api/products/');

/** Time window for the OEE dashboards, as ISO dates with time zone (e.g. `2026-01-05T07:00:00.000Z`). */
export interface DateRange {
  from: string;
  to: string;
}

/** OEE figures, events, faults and cells of one line over a time window (one cache entry per filter). */
export function useDowntime(line: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: [...queryKeys.downtime, line, range.from, range.to],
    queryFn: async () =>
      (
        await api.get<DowntimeData>('/api/downtime/', {
          params: { machine: line, created_at__gte: range.from, created_at__lte: range.to },
        })
      ).data,
    enabled: Boolean(line),
    // Switching between the OEE dashboards with the same filter reuses the data;
    // the Refresh button reloads it.
    staleTime: 30_000,
  });
}

/** Reload one or more lists, e.g. after a form saved an item. */
export function useRefresh(...queryKeys: QueryKey[]) {
  const queryClient = useQueryClient();
  return () => Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

interface DeleteOptions {
  /** Collection URL; each item is deleted at `${path}${id}/` */
  path: string;
  /** Lists to reload afterwards */
  invalidate: QueryKey[];
  /** Plural name for the messages, e.g. "Assets" */
  label: string;
}

/**
 * Delete several items. Resolves once every delete has finished, then shows one
 * message: success, or how many failed (with the backend's reason).
 */
export function useDeleteMany({ path, invalidate, label }: DeleteOptions) {
  const refresh = useRefresh(...invalidate);
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`${path}${id}/`)));
      return results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    },
    onSuccess: (failures, ids) => {
      if (failures.length === 0) {
        toast.success(`${label} deleted`);
      } else {
        toast.error(
          `${failures.length} of ${ids.length} could not be deleted. Hint: ${errorMessage(failures[0].reason)}`,
        );
      }
    },
    onSettled: refresh,
  });
}

/** Fields an operator changes on a plan (start, pause, finish, cancel). */
export interface MaintenanceUpdate {
  status: MaintenancePlan['status'];
  started_at?: string;
  finished_at?: string;
}

/** Change a maintenance plan's status; reloads the plan lists and assets (status sync). */
export function useUpdateMaintenance() {
  const refresh = useRefresh(queryKeys.myMaintenances, queryKeys.maintenances, queryKeys.assets);
  return useMutation({
    mutationFn: async ({ uuid, changes }: { uuid: string; changes: MaintenanceUpdate }) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(changes)) if (value) form.append(key, value);
      await api.patch(`/api/maintenance-plans/${uuid}/`, form);
    },
    onSuccess: () => toast.success('Maintenance updated'),
    onError: (error) => toast.error(`Error: ${errorMessage(error)}`),
    onSettled: refresh,
  });
}

/** Send a new invitation email to a user who has not set a password yet (older links stop working). */
export function useResendInvitation() {
  return useMutation({
    mutationFn: (profileUuid: string) => api.post(`/api/users/${profileUuid}/resend-invitation/`),
    onSuccess: () => toast.success('Invitation sent again'),
    onError: (error) => toast.error(`Error: ${errorMessage(error)}`),
  });
}

/** A line state change sent by an operator (button or report). */
export interface LineEventInput {
  machine: string;
  state: string;
  cell?: string;
  fault?: string;
  product?: string;
  quantity?: number;
  scrap?: number;
}

/** Send a line event; the new state comes back over the line's live socket. */
export function useSendLineEvent() {
  return useMutation({
    mutationFn: (event: LineEventInput) => api.post('/api/events/', event),
    onSuccess: () => toast.success('updated'),
    onError: (error) => toast.error(`Something went wrong! Please try again. Hint: ${errorMessage(error)}`),
  });
}

/** Field values sent to the backend; empty values ('' / null / undefined) are left out. */
export type FormValues = Record<string, string | number | Blob | null | undefined>;

/**
 * Create (POST `path`) or update (PATCH `path<uuid>/`) an item from form values,
 * sent as multipart form data (forms can include files). Shows "<label> created / updated",
 * or the backend's reason when saving failed.
 */
export function useSaveItem(
  path: string,
  label: string,
  /** Replaces the "<label> created" message; stays until closed */
  createdMessage?: string,
) {
  return useMutation({
    mutationFn: async ({ uuid, values }: { uuid?: string; values: FormValues }) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (value === '' || value === null || value === undefined) continue;
        form.append(key, value instanceof Blob ? value : String(value));
      }
      return uuid ? api.patch(`${path}${uuid}/`, form) : api.post(path, form);
    },
    onSuccess: (_, { uuid }) => {
      if (!uuid && createdMessage) toast.success(createdMessage, { autoClose: false });
      else toast.success(`${label} ${uuid ? 'updated' : 'created'}`);
    },
    onError: (error) => toast.error(`Something went wrong! ${errorMessage(error)}`),
  });
}
