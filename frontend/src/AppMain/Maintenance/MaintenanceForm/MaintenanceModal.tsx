import ViewDrawer, { InfoSection } from '../../../components/form/ViewDrawer';
import type { MaintenancePlan } from '../../../data/types';
import AssetCard from '../../OperatorView/AssetCard';
import MaintenanceCard from '../../OperatorView/MaintenanceCard';

interface MaintenanceModalProps {
  open: boolean;
  maintenance: MaintenancePlan | null | undefined;
  onClose: () => void;
}

export default function MaintenanceModal({ open, maintenance, onClose }: MaintenanceModalProps) {
  return (
    <ViewDrawer open={open} title="View Maintenance Plan" onClose={onClose}>
      <InfoSection title="Asset">
        <AssetCard asset={maintenance?.asset} />
      </InfoSection>
      <InfoSection title="Maintenance Details">
        <MaintenanceCard maintenance={maintenance} />
      </InfoSection>
    </ViewDrawer>
  );
}
