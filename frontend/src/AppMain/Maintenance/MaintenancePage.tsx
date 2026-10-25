import { LinearProgress, type LinearProgressProps } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';

import DataTable, { type Column } from '../../components/DataTable';
import ListPage from '../../components/ListPage';
import {
  queryKeys,
  useAssets,
  useDeleteMany,
  useMaintenances,
  useRefresh,
  useUsers,
} from '../../data/queries';
import type { MaintenancePlan, MaintenanceStatus } from '../../data/types';
import MaintenancePapers from '../Dashboards/MaintenanceDashboard/Components/MaintenancePapers';
import MaintenanceEditForm from './MaintenanceForm/MaintenanceEditForm';
import MaintenanceModal from './MaintenanceForm/MaintenanceModal';

const statusColors: Record<MaintenanceStatus, LinearProgressProps['color']> = {
  Completed: 'success',
  Cancelled: 'secondary',
  'In Progress': 'primary',
  Pending: 'error',
};

const formatDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '');
const timeOf = (value: string | null | undefined) => (value ? new Date(value).getTime() : undefined);

const columns: Column<MaintenancePlan>[] = [
  { id: 'name', label: 'Name' },
  { id: 'ref', label: 'Reference' },
  {
    id: 'created_by',
    label: 'Created',
    render: (row) => row.created_by?.username,
    sortValue: (row) => row.created_by?.username,
  },
  {
    id: 'assigned_to',
    label: 'Assigned',
    render: (row) => row.assigned_to?.username,
    sortValue: (row) => row.assigned_to?.username,
  },
  { id: 'asset', label: 'Asset', render: (row) => row.asset?.name, sortValue: (row) => row.asset?.name },
  {
    id: 'planned_starting_date',
    label: 'Planned at',
    render: (row) => formatDate(row.planned_starting_date),
    sortValue: (row) => timeOf(row.planned_starting_date),
  },
  {
    id: 'started_at',
    label: 'Started',
    render: (row) => (row.started_at ? formatDate(row.started_at) : 'Not started'),
    sortValue: (row) => timeOf(row.started_at),
  },
  { id: 'type', label: 'Type' },
  { id: 'priority', label: 'Priority' },
  {
    id: 'status',
    label: 'Status',
    render: (row) => (
      <>
        {row.status}
        <LinearProgress color={statusColors[row.status]} variant="determinate" value={50} />
      </>
    ),
  },
];

export default function MaintenancePage() {
  const maintenances = useMaintenances();
  const assets = useAssets();
  const users = useUsers();
  // Saving a plan can change its asset's status (backend sync), so reload assets too.
  const refresh = useRefresh(queryKeys.maintenances, queryKeys.assets);
  const remove = useDeleteMany({
    path: '/api/maintenance-plans/',
    label: 'Maintenance plans',
    invalidate: [queryKeys.maintenances],
  });
  const rows = maintenances.data ?? [];

  return (
    <ListPage
      icon={<ConstructionIcon />}
      title="Planned maintenance table"
      loading={maintenances.isPending || assets.isPending || users.isPending || remove.isPending}
    >
      <MaintenancePapers maintenances={rows} />
      <DataTable
        title="Maintenance planning"
        addLabel="Add new"
        deleteLabel="maintenance plans"
        rows={rows}
        columns={columns}
        onDelete={remove.mutateAsync}
        onUpdate={refresh}
        renderView={({ open, row, onClose }) => (
          <MaintenanceModal open={open} maintenance={row} onClose={onClose} />
        )}
        renderForm={({ open, row, onClose, onSaved }) => (
          <MaintenanceEditForm
            open={open}
            maintenancePlan={row}
            onClose={onClose}
            onSaved={onSaved}
            users={users.data ?? []}
            assets={assets.data ?? []}
          />
        )}
      />
    </ListPage>
  );
}
