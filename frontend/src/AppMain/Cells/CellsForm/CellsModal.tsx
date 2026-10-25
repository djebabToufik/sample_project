import LineInfo from '../../../components/form/LineInfo';
import ViewDrawer, { InfoRow, InfoSection } from '../../../components/form/ViewDrawer';
import type { Cell } from '../../../data/types';

interface CellsModalProps {
  open: boolean;
  cell: Cell | null | undefined;
  onClose: () => void;
}

export default function CellsModal({ open, cell, onClose }: CellsModalProps) {
  if (!cell) return null;
  return (
    <ViewDrawer open={open} title="View Cell" onClose={onClose}>
      <InfoSection title="Basic Information">
        <LineInfo machine={cell.machine}>
          <InfoRow label="Cell Name" value={cell.name} />
        </LineInfo>
      </InfoSection>
    </ViewDrawer>
  );
}
