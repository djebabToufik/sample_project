import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

interface ConfirmDeleteDialogProps {
  open: boolean;
  /** Plural, lower case, e.g. "assets" */
  label: string;
  count: number;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDeleteDialog({
  open,
  label,
  count,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-description"
    >
      <DialogTitle id="confirm-delete-title">
        Are you sure you want to delete the selected {label}?
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-delete-description" sx={{ mb: 2 }}>
          <strong>
            You have selected {count} {label} to delete
          </strong>
        </DialogContentText>
        <DialogContentText>
          This action is irreversible, other related data will be also deleted. Please make sure that this
          data is not relevant to you any more
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onConfirm} disabled={busy}>
          Yes, I am sure!
        </Button>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
