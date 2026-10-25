import LineInfo from '../../../components/form/LineInfo';
import ViewDrawer, { InfoRow, InfoSection } from '../../../components/form/ViewDrawer';
import type { Fault } from '../../../data/types';

interface FaultsModalProps {
  open: boolean;
  fault: Fault | null | undefined;
  onClose: () => void;
}

export default function FaultsModal({ open, fault, onClose }: FaultsModalProps) {
  if (!fault) return null;
  return (
    <ViewDrawer open={open} title="View Fault" onClose={onClose}>
      <InfoSection title="Basic Information">
        <LineInfo machine={fault.machine}>
          <InfoRow label="Fault Name" value={fault.name} />
        </LineInfo>
      </InfoSection>
    </ViewDrawer>
  );
}
