// Shapes of the data the backend API returns (Django REST serializers).
// Dates are ISO strings; uuids are strings.

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  last_login?: string | null;
  date_joined?: string;
}

export interface Organization {
  uuid: string;
  name: string;
}

export type ProfileType = 'Admin' | 'Reporter';

/** /api/users/ and the profile in /api/auth/session/ */
export interface UserProfile {
  uuid: string;
  type: ProfileType;
  user: User;
  organization?: Organization | null;
  profile_photo?: string;
  /** Invited, but no password set yet */
  invitation_pending?: boolean;
}

export type AssetStatus = 'Active' | 'Inactive' | 'Under Maintenance' | 'Retired';
export type AssetType = 'Vehicle' | 'Equipment' | 'Building' | 'Furniture' | 'IT' | 'Other';

/** /api/assets/ */
export interface Asset {
  uuid: string;
  name: string;
  ref: string;
  serial_number: string;
  asset_type: AssetType;
  status: AssetStatus;
  location: string;
  /** Signed link; null when no photo was uploaded (show brand.assetPlaceholder) */
  photo?: string | null;
  purchase_date?: string | null;
  warranty_expiration_date: string | null;
  created_at?: string;
  last_updated_at?: string;
  cost?: string;
  current_value?: string | null;
  state?: string;
  /** Energy (kW) and cost per hour, used by the Energy dashboard */
  running_hour_consumption_kw?: number;
  on_hour_consumption_kw?: number;
  running_hour_cost?: number;
  on_hour_cost?: number;
}

export type MaintenanceStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type MaintenancePriority = 'Low' | 'Medium' | 'High';
export type MaintenanceType = 'Planned' | 'UnPlanned' | 'Other';

/** /api/maintenance-plans/ (read: users and asset are nested objects) */
export interface MaintenancePlan {
  uuid: string;
  name: string;
  ref: string;
  created_by: Pick<User, 'id' | 'username'> | null;
  assigned_to: Pick<User, 'id' | 'username'> | null;
  asset: Asset | null;
  planned_starting_date: string | null;
  planned_finished: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  /** Signed link; null when no instructions were uploaded */
  instructions?: string | null;
  estimated_cost?: string | null;
}

/** /api/cells/ */
export interface Cell {
  uuid: string;
  name: string;
  machine: Asset;
}

/** /api/faults/ */
export interface Fault {
  uuid: string;
  name: string;
  machine: Asset;
}

/** /api/products/ */
export interface Product {
  uuid: string;
  product_id: string;
  product_name: string;
  ideal_cycle: number;
}

/** OEE figures for a period (backend state/util.py calculate_oee). Ratios are 0-1, durations in hours. */
export interface OeeSummary {
  /** null: nothing to measure it on (no production time, no pieces reported) */
  availability: number | null;
  performance: number | null;
  quality: number | null;
  /** Percent, 0-100; null when the line had no production time (off or idle) */
  oee: number | null;
  machine_on_duration: number;
  machine_run_duration: number;
  machine_break_in_duration: number;
  machine_break_out_duration: number;
  machine_failure_duration: number;
  machine_fault_duration: number;
  out_of_order_duration: number;
}

/** A line state change (run, stop, fault...) with its related objects. */
export interface MachineEvent {
  uuid: string;
  state: string;
  created_at: string;
  machine: Asset | null;
  cell: Cell | null;
  fault: Fault | null;
  product?: Product | null;
  quantity: number;
  scrap: number;
  is_filled: boolean;
}

/** Downtimes (fault, failure, out of order) of a period on one fault or cell. */
export interface DowntimeCount {
  uuid: string;
  name: string;
  count: number;
}

/** /api/downtime/?machine=&created_at__gte=&created_at__lte= */
export interface DowntimeData {
  oee_selected_period: OeeSummary;
  oee_last_24h: OeeSummary;
  /** The line, with its energy and cost rates */
  machine: Asset;
  /** Every fault / cell of the line, zeros included */
  downtime_per_fault: DowntimeCount[];
  downtime_per_cell: DowntimeCount[];
}

/** ws /ws/machine-data/: the latest events of a line */
export interface MachineDataMessage {
  data: MachineEvent[];
}

/** ws /ws/machine-oee/: OEE of the last 24 h, one OEE per hour, and the latest event */
export interface MachineOeeMessage {
  data: OeeSummary;
  oee: OeeSummary[];
  list: MachineEvent[];
}
