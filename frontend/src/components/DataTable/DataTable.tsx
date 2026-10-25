import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Box,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';

import ConfirmDeleteDialog from './ConfirmDeleteDialog';
import DataTableToolbar from './DataTableToolbar';

// Generic list table: sorting, row selection, pagination and an action toolbar
// (add / view / edit / delete). Pages only describe their columns and dialogs.

type SortValue = string | number | boolean | null | undefined;

export interface Column<Row> {
  id: string;
  label: string;
  /** Cell content; defaults to row[id] */
  render?: (row: Row) => ReactNode;
  /** Value used for sorting; defaults to row[id] */
  sortValue?: (row: Row) => SortValue;
}

export interface DialogProps<Item> {
  open: boolean;
  /** Selected item for view / edit, null when adding */
  row: Item | null | undefined;
  onClose: () => void;
}

export interface FormProps<Item> extends DialogProps<Item> {
  onSaved: () => void;
}

export interface DataTableProps<Row, Item = Row> {
  title: string;
  rows: Row[];
  columns: Column<Row>[];
  getRowId?: (row: Row) => string;
  defaultOrderBy?: string;
  /**
   * Delete the given rows. Asked for confirmation first; the selection is cleared
   * once the returned promise settles (cancelling keeps it).
   */
  onDelete?: (ids: string[]) => Promise<unknown> | void;
  /** Plural, lower case name used in the delete confirmation (default: title) */
  deleteLabel?: string;
  onUpdate?: () => void;
  renderView?: (props: DialogProps<Item>) => ReactNode;
  renderForm?: (props: FormProps<Item>) => ReactNode;
  /** What the dialogs receive for the selected row (default: the row itself) */
  selectedItem?: (row: Row) => Item;
  allowEdit?: boolean;
  addLabel?: string;
}

type Dialog = null | 'view' | 'add' | 'edit';

const defaultRowId = (row: unknown) => (row as { uuid: string }).uuid;

function fieldOf<Row>(row: Row, id: string): unknown {
  return (row as Record<string, unknown>)[id];
}

function valueOf<Row>(column: Column<Row>, row: Row): SortValue {
  return column.sortValue ? column.sortValue(row) : (fieldOf(row, column.id) as SortValue);
}

function compare(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  return a < b ? -1 : 1;
}

export default function DataTable<Row, Item = Row>({
  title,
  rows,
  columns,
  getRowId = defaultRowId,
  defaultOrderBy,
  onDelete,
  deleteLabel,
  onUpdate,
  renderView,
  renderForm,
  selectedItem = (row: Row) => row as unknown as Item,
  allowEdit = true,
  addLabel,
}: DataTableProps<Row, Item>) {
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<string | undefined>(defaultOrderBy);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [dialog, setDialog] = useState<Dialog>(null);

  const sortColumn = columns.find((c) => c.id === orderBy);

  const visibleRows = useMemo(() => {
    const sorted = sortColumn
      ? [...rows].sort((a, b) => {
          const result = compare(valueOf(sortColumn, a), valueOf(sortColumn, b));
          return order === 'asc' ? result : -result;
        })
      : rows;
    return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [rows, sortColumn, order, page, rowsPerPage]);

  const handleSort = (columnId: string) => {
    const isAsc = orderBy === columnId && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(columnId);
  };

  const toggleRow = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const toggleAll = (event: ChangeEvent<HTMLInputElement>) =>
    setSelected(event.target.checked ? rows.map(getRowId) : []);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Rows picked when the confirmation opened (the dialog keeps showing them while it fades out).
  const [toDelete, setToDelete] = useState<string[]>([]);

  const askDelete = () => {
    setToDelete(selected);
    setConfirmingDelete(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.(toDelete);
      setSelected([]);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const closeDialog = () => setDialog(null);
  const handleSaved = () => {
    setDialog(null);
    onUpdate?.();
  };

  const selectedRow = rows.find((row) => getRowId(row) === selected[0]);
  const item = selectedRow ? selectedItem(selectedRow) : undefined;

  // Keep the table height stable on the last page.
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  return (
    <Box sx={{ width: '100%' }}>
      {renderView?.({ open: dialog === 'view', row: item, onClose: closeDialog })}
      {renderForm?.({
        open: dialog === 'add' || dialog === 'edit',
        row: dialog === 'edit' ? item : null,
        onClose: closeDialog,
        onSaved: handleSaved,
      })}
      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmingDelete}
          label={deleteLabel ?? title.toLowerCase()}
          count={toDelete.length}
          busy={deleting}
          onConfirm={confirmDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}

      <Paper sx={{ width: '100%', mb: 2 }}>
        <DataTableToolbar
          title={title}
          numSelected={selected.length}
          addLabel={addLabel}
          onAdd={renderForm ? () => setDialog('add') : undefined}
          onView={renderView ? () => setDialog('view') : undefined}
          onEdit={renderForm && allowEdit ? () => setDialog('edit') : undefined}
          onDelete={onDelete ? askDelete : undefined}
        />
        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-label={`${title} table`}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selected.length > 0 && selected.length < rows.length}
                    checked={rows.length > 0 && selected.length === rows.length}
                    onChange={toggleAll}
                    slotProps={{
                      input: { 'aria-label': `select all ${title}` },
                    }}
                  />
                </TableCell>
                {columns.map((column, index) => (
                  <TableCell
                    key={column.id}
                    padding={index === 0 ? 'none' : 'normal'}
                    sortDirection={orderBy === column.id ? order : false}
                  >
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleSort(column.id)}
                    >
                      {column.label}
                      {orderBy === column.id ? (
                        <Box component="span" sx={visuallyHidden}>
                          {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row, index) => {
                const id = getRowId(row);
                const isSelected = selected.includes(id);
                const labelId = `data-table-checkbox-${index}`;
                return (
                  <TableRow
                    hover
                    key={id}
                    onClick={() => toggleRow(id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={-1}
                    selected={isSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isSelected}
                        slotProps={{
                          input: { 'aria-labelledby': labelId },
                        }}
                      />
                    </TableCell>
                    {columns.map((column, colIndex) => (
                      <TableCell
                        key={column.id}
                        {...(colIndex === 0
                          ? { component: 'th' as const, id: labelId, scope: 'row', padding: 'none' as const }
                          : {})}
                      >
                        {column.render ? column.render(row) : (fieldOf(row, column.id) as ReactNode)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {emptyRows > 0 && (
                <TableRow style={{ height: 53 * emptyRows }}>
                  <TableCell colSpan={columns.length + 1} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 15]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>
    </Box>
  );
}
