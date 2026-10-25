import { LinearProgress, type LinearProgressProps } from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

import DataTable, { type Column } from '../../components/DataTable';
import ListPage from '../../components/ListPage';
import { queryKeys, useAssets, useDeleteMany, useRefresh } from '../../data/queries';
import type { Asset, AssetStatus } from '../../data/types';
import AssetsPapers from '../Dashboards/AssetsDashboard/Components/AssetsPapers';
import AssetEditForm from './AssetForm/AssetEditForm';
import AssetModal from './AssetForm/AssetModal';

const statusColors: Record<AssetStatus, LinearProgressProps['color']> = {
  Active: 'success',
  Inactive: 'secondary',
  'Under Maintenance': 'error',
  Retired: 'secondary',
};

const timeOf = (value: string | null) => (value ? new Date(value).getTime() : undefined);

const columns: Column<Asset>[] = [
  { id: 'name', label: 'Asset name' },
  { id: 'ref', label: 'Reference' },
  { id: 'serial_number', label: 'Serial number' },
  { id: 'asset_type', label: 'Asset type' },
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
  { id: 'location', label: 'Location' },
  {
    id: 'warranty_expiration_date',
    label: 'End of warranty',
    sortValue: (row) => timeOf(row.warranty_expiration_date),
    render: (row) =>
      row.warranty_expiration_date && (
        <>
          {new Date(row.warranty_expiration_date).toLocaleString()}
          <LinearProgress
            color={Date.now() < timeOf(row.warranty_expiration_date)! ? 'success' : 'warning'}
            variant="determinate"
            value={75}
          />
        </>
      ),
  },
];

export default function AssetsPage() {
  const assets = useAssets();
  const refresh = useRefresh(queryKeys.assets);
  // Deleting an asset also deletes its maintenance plans, cells and faults.
  const remove = useDeleteMany({
    path: '/api/assets/',
    label: 'Assets',
    invalidate: [queryKeys.assets, queryKeys.maintenances, queryKeys.cells, queryKeys.faults],
  });
  const rows = assets.data ?? [];

  return (
    <ListPage
      icon={<PrecisionManufacturingIcon />}
      title="Assets table"
      loading={assets.isPending || remove.isPending}
    >
      <AssetsPapers assets={rows} />
      <DataTable
        title="Assets"
        rows={rows}
        columns={columns}
        onDelete={remove.mutateAsync}
        onUpdate={refresh}
        renderView={({ open, row, onClose }) => <AssetModal open={open} asset={row} onClose={onClose} />}
        renderForm={({ open, row, onClose, onSaved }) => (
          <AssetEditForm open={open} asset={row} onClose={onClose} onSaved={onSaved} />
        )}
      />
    </ListPage>
  );
}
