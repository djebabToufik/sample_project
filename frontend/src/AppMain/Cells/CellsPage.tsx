import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';

import DataTable, { type Column } from '../../components/DataTable';
import ListPage from '../../components/ListPage';
import { queryKeys, useAssets, useCells, useDeleteMany, useRefresh } from '../../data/queries';
import type { Cell } from '../../data/types';
import CellEditForm from './CellsForm/CellEditForm';
import CellsModal from './CellsForm/CellsModal';

const columns: Column<Cell>[] = [
  { id: 'name', label: 'Cell name' },
  { id: 'machine', label: 'Line', render: (row) => row.machine?.name, sortValue: (row) => row.machine?.name },
];

export default function CellsPage() {
  const cells = useCells();
  const assets = useAssets();
  const refresh = useRefresh(queryKeys.cells);
  const remove = useDeleteMany({ path: '/api/cells/', label: 'Cells', invalidate: [queryKeys.cells] });

  return (
    <ListPage
      icon={<DashboardCustomizeIcon />}
      title="Cells table"
      loading={cells.isPending || assets.isPending || remove.isPending}
    >
      <DataTable
        title="Cells"
        rows={cells.data ?? []}
        columns={columns}
        defaultOrderBy="name"
        onDelete={remove.mutateAsync}
        onUpdate={refresh}
        renderView={({ open, row, onClose }) => <CellsModal open={open} cell={row} onClose={onClose} />}
        renderForm={({ open, row, onClose, onSaved }) => (
          <CellEditForm
            open={open}
            cell={row}
            onClose={onClose}
            onSaved={onSaved}
            assets={assets.data ?? []}
          />
        )}
      />
    </ListPage>
  );
}
