import BarChartIcon from '@mui/icons-material/BarChart';

import ListPage from '../../../components/ListPage';
import { useAssets, useMaintenances, useUsers } from '../../../data/queries';
import MaintenanceMetrics from './Components/MaintenanceMetrics';
import MaintenancePapers from './Components/MaintenancePapers';
import MaintenancesGraph from './Components/MaintenancesGraph';

export default function MaintenanceDashboard() {
  const maintenances = useMaintenances();
  const assets = useAssets();
  const users = useUsers();
  const plans = maintenances.data ?? [];

  return (
    <ListPage
      icon={<BarChartIcon />}
      title="Maintenance dashboard"
      loading={maintenances.isPending || assets.isPending || users.isPending}
    >
      <MaintenancePapers maintenances={plans} />
      <MaintenanceMetrics maintenances={plans} />
      <MaintenancesGraph maintenances={plans} users={users.data ?? []} assets={assets.data ?? []} />
    </ListPage>
  );
}
