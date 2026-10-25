import type { ReactNode } from 'react';
import { IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PreviewIcon from '@mui/icons-material/Preview';

interface DataTableToolbarProps {
  title: string;
  numSelected: number;
  addLabel?: string;
  onAdd?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Title + actions above a DataTable:
// nothing selected -> Add; one row -> View / Edit / Delete; several rows -> Delete.
// An action is hidden when its handler is not given.
export default function DataTableToolbar({
  title,
  numSelected,
  addLabel,
  onAdd,
  onView,
  onEdit,
  onDelete,
}: DataTableToolbarProps) {
  const action = (label: string, onClick: (() => void) | undefined, icon: ReactNode) =>
    onClick && (
      <Tooltip title={label} key={label}>
        <IconButton onClick={onClick} aria-label={label}>
          {icon}
        </IconButton>
      </Tooltip>
    );

  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: (theme) => theme.alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        }),
      }}
    >
      {numSelected > 0 ? (
        <Typography
          variant="subtitle1"
          component="div"
          sx={{
            color: 'inherit',
            flex: '1 1 100%',
          }}
        >
          {numSelected} selected
        </Typography>
      ) : (
        <Typography sx={{ flex: '1 1 100%' }} variant="h6" component="div">
          {title}
        </Typography>
      )}

      {numSelected === 0 && action(addLabel || `Add new ${title.toLowerCase()}`, onAdd, <AddOutlined />)}
      {numSelected === 1 && [action('View', onView, <PreviewIcon />), action('Edit', onEdit, <EditIcon />)]}
      {numSelected > 0 && action('Delete', onDelete, <DeleteIcon />)}
    </Toolbar>
  );
}
