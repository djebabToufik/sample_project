import FmdBadIcon from '@mui/icons-material/FmdBad';

import DataTable, { type Column } from '../../components/DataTable';
import ListPage from '../../components/ListPage';
import { queryKeys, useAssets, useDeleteMany, useFaults, useRefresh } from '../../data/queries';
import type { Fault } from '../../data/types';
import FaultEditForm from './FaultsForm/FaultEditForm';
import FaultsModal from './FaultsForm/FaultsModal';

const columns: Column<Fault>[] = [
  { id: 'name', label: 'Fault name' },
  { id: 'machine', label: 'Line', render: (row) => row.machine?.name, sortValue: (row) => row.machine?.name },
];

export default function FaultsPage() {
  const faults = useFaults();
  const assets = useAssets();
  const refresh = useRefresh(queryKeys.faults);
  const remove = useDeleteMany({ path: '/api/faults/', label: 'Faults', invalidate: [queryKeys.faults] });

  return (
    <ListPage
      icon={<FmdBadIcon />}
      title="Faults table"
      loading={faults.isPending || assets.isPending || remove.isPending}
    >
      <DataTable
        title="Faults"
        rows={faults.data ?? []}
        columns={columns}
        onDelete={remove.mutateAsync}
        onUpdate={refresh}
        renderView={({ open, row, onClose }) => <FaultsModal open={open} fault={row} onClose={onClose} />}
        renderForm={({ open, row, onClose, onSaved }) => (
          <FaultEditForm
            open={open}
            fault={row}
            onClose={onClose}
            onSaved={onSaved}
            assets={assets.data ?? []}
          />
        )}
      />
    </ListPage>
  );
}
